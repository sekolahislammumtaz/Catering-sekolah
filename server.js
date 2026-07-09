const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get local date string YYYY-MM-DD
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Middleware to check authentication
async function requireLogin(req, res, next) {
  const token = req.cookies.session_token;
  if (token && token.startsWith('session_')) {
    const content = token.substring(8); // Remove "session_"
    const parts = content.split('_');
    parts.pop(); // Remove timestamp
    const username = parts.join('_'); // Join the remaining parts back
    
    try {
      const user = await db.findUser(username);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (e) {
      console.error('Error in requireLogin auth check:', e);
    }
  }
  res.status(401).json({ success: false, message: 'Unauthorized. Silakan login terlebih dahulu.' });
}

// Auth APIs
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
  }
  
  try {
    const user = await db.findUser(username);
    
    if (user && user.password === password) {
      // Generate session token containing the username
      const token = `session_${user.username}_${Date.now()}`;
      // Set cookie valid for 1 day
      res.cookie('session_token', token, { 
        httpOnly: true, 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
      });
      return res.json({ success: true, username: user.username });
    } else {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal login: ' + err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session_token');
  res.json({ success: true, message: 'Berhasil logout' });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies.session_token;
  if (token && token.startsWith('session_')) {
    const content = token.substring(8);
    const parts = content.split('_');
    parts.pop();
    const username = parts.join('_');
    return res.json({ loggedIn: true, username });
  }
  res.status(401).json({ loggedIn: false });
});

// Student APIs
app.get('/api/students', requireLogin, async (req, res) => {
  const today = getLocalDateString();
  try {
    const students = await db.getStudents(req.user.username);
    
    // Enrich student records with remaining quota calculation
    const enrichedStudents = students.map(student => {
      const dates = student.catering_dates || [];
      const remainingDates = dates.filter(d => d >= today);
      const consumedDates = dates.filter(d => d < today);
      
      const remaining_quota = remainingDates.length;
      const consumed_quota = consumedDates.length;
      
      let status = 'active';
      if (remaining_quota === 0) {
        status = 'expired';
      } else if (remaining_quota === 1 || remaining_quota === 2) {
        status = 'low';
      }
      
      return {
        ...student,
        remaining_quota,
        consumed_quota,
        status,
        remaining_dates: remainingDates,
        consumed_dates: consumedDates
      };
    });
    
    res.json(enrichedStudents);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat siswa: ' + err.message });
  }
});

app.post('/api/students', requireLogin, async (req, res) => {
  const { name, class_name, start_date, initial_quota, parent_whatsapp } = req.body;
  
  if (!name || !class_name || !start_date || !initial_quota || !parent_whatsapp) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
  }
  
  if (parseInt(initial_quota) <= 0) {
    return res.status(400).json({ success: false, message: 'Kuota catering harus lebih besar dari 0' });
  }
  
  try {
    const student = await db.addStudent(name, class_name, start_date, initial_quota, parent_whatsapp, req.user.username);
    res.status(201).json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menambahkan siswa: ' + error.message });
  }
});

app.put('/api/students/:id', requireLogin, async (req, res) => {
  const { id } = req.params;
  const { name, class_name, start_date, initial_quota, parent_whatsapp } = req.body;
  
  try {
    const student = await db.getStudentById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    }
    if (student.created_by !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Siswa ini milik sekolah lain.' });
    }
    
    const updated = await db.updateStudent(id, { name, class_name, start_date, initial_quota, parent_whatsapp });
    res.json({ success: true, student: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengedit siswa: ' + error.message });
  }
});

app.delete('/api/students/:id', requireLogin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const student = await db.getStudentById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    }
    if (student.created_by !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Siswa ini milik sekolah lain.' });
    }
    
    const success = await db.deleteStudent(id);
    if (success) {
      res.json({ success: true, message: 'Siswa berhasil dihapus' });
    } else {
      res.status(500).json({ success: false, message: 'Gagal menghapus siswa' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menghapus siswa: ' + error.message });
  }
});

app.post('/api/students/:id/sick', requireLogin, async (req, res) => {
  const { id } = req.params;
  const { date } = req.body;
  
  if (!date) {
    return res.status(400).json({ success: false, message: 'Tanggal tidak masuk wajib diisi' });
  }
  
  try {
    const student = await db.getStudentById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    }
    if (student.created_by !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }
    
    const result = await db.markStudentSick(id, date);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mencatat tidak masuk: ' + error.message });
  }
});

app.delete('/api/students/:id/sick/:date', requireLogin, async (req, res) => {
  const { id, date } = req.params;
  
  try {
    const student = await db.getStudentById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    }
    if (student.created_by !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }
    
    const result = await db.unmarkStudentSick(id, date);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menghapus catatan tidak masuk: ' + error.message });
  }
});

app.post('/api/students/:id/whatsapp-sent', requireLogin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const student = await db.getStudentById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    }
    if (student.created_by !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }
    
    const updated = await db.updateStudentWhatsAppSent(id, true);
    res.json({ success: true, student: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui status WhatsApp: ' + error.message });
  }
});

// Holiday APIs
app.get('/api/holidays', requireLogin, async (req, res) => {
  try {
    const holidays = await db.getHolidays(req.user.username);
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat hari libur: ' + err.message });
  }
});

app.post('/api/holidays', requireLogin, async (req, res) => {
  const { date, description } = req.body;
  
  if (!date || !description) {
    return res.status(400).json({ success: false, message: 'Tanggal dan keterangan wajib diisi' });
  }
  
  try {
    const result = await db.addHoliday(date, description, req.user.username);
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menambahkan hari libur: ' + error.message });
  }
});

app.delete('/api/holidays/:id', requireLogin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const holidays = await db.getHolidays();
    const holiday = holidays.find(h => h.id === id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Hari libur tidak ditemukan' });
    }
    if (holiday.created_by !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }
    
    const success = await db.deleteHoliday(id);
    if (success) {
      res.json({ success: true, message: 'Hari libur berhasil dihapus' });
    } else {
      res.status(500).json({ success: false, message: 'Gagal menghapus hari libur' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus hari libur: ' + err.message });
  }
});

// Dashboard summary stats
app.get('/api/dashboard-summary', requireLogin, async (req, res) => {
  const today = getLocalDateString();
  
  try {
    const students = await db.getStudents(req.user.username);
    const holidays = await db.getHolidays(req.user.username);
    
    let totalStudents = students.length;
    let activeCount = 0;
    let lowCount = 0;
    let expiredCount = 0;
    
    const lowQuotaStudents = [];
    
    students.forEach(student => {
      const dates = student.catering_dates || [];
      const remaining = dates.filter(d => d >= today).length;
      
      if (remaining === 0) {
        expiredCount++;
      } else {
        activeCount++;
        if (remaining === 1 || remaining === 2) {
          lowCount++;
          lowQuotaStudents.push({
            id: student.id,
            name: student.name,
            class_name: student.class_name,
            remaining_quota: remaining,
            parent_whatsapp: student.parent_whatsapp || '',
            whatsapp_sent: student.whatsapp_sent || false
          });
        }
      }
    });

    // Calculate weekly summary (Monday - Friday of the current week)
    const [year, month, day] = today.split('-').map(Number);
    const todayDate = new Date(year, month - 1, day);
    const dayOfWeek = todayDate.getDay(); // 0 = Sun, 6 = Sat
    
    // Find Monday of the current week
    const mondayOffset = todayDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(year, month - 1, mondayOffset);
    
    const weekDays = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      weekDays.push(`${yStr}-${mStr}-${dStr}`);
    }
    
    let weeklyTotalPortions = 0;
    const weeklyBreakdown = weekDays.map(dateStr => {
      const dayHolidays = holidays.filter(h => h.date === dateStr);
      const isHoliday = dayHolidays.length > 0;
      
      // Students of this user who have catering scheduled on this day
      const studentsForDay = [];
      students.forEach(student => {
        const dates = student.catering_dates || [];
        if (dates.includes(dateStr)) {
          studentsForDay.push({
            id: student.id,
            name: student.name,
            class_name: student.class_name
          });
        }
      });
      
      const portionCount = isHoliday ? 0 : studentsForDay.length;
      weeklyTotalPortions += portionCount;
      
      return {
        date: dateStr,
        isHoliday,
        holidayDescription: isHoliday ? dayHolidays[0].description : null,
        portions: portionCount,
        students: studentsForDay
      };
    });
    
    res.json({
      totalStudents,
      activeCount,
      lowCount,
      expiredCount,
      lowQuotaStudents,
      totalHolidays: holidays.length,
      today,
      weeklySummary: {
        totalPortions: weeklyTotalPortions,
        breakdown: weeklyBreakdown
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat ringkasan: ' + err.message });
  }
});

// User Management APIs (Super Admin: mumtaz only)
function requireAdmin(req, res, next) {
  if (req.user && req.user.username.toLowerCase() === 'mumtaz') {
    return next();
  }
  res.status(403).json({ success: false, message: 'Akses ditolak. Rute ini hanya untuk administrator utama.' });
}

app.get('/api/users', requireLogin, requireAdmin, async (req, res) => {
  try {
    const users = (await db.getUsers()).map(u => ({ id: u.id, username: u.username }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat user: ' + err.message });
  }
});

app.post('/api/users', requireLogin, requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
  }
  try {
    const result = await db.addUser(username, password);
    if (result.success) {
      res.status(201).json({ success: true, user: { id: result.user.id, username: result.user.username } });
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menambah user: ' + err.message });
  }
});

app.put('/api/users/:id/reset-password', requireLogin, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password baru wajib diisi' });
  }
  try {
    const result = await db.resetUserPassword(id, password);
    if (result.success) {
      res.json({ success: true, message: 'Password berhasil direset' });
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mereset password: ' + err.message });
  }
});

// Fallback to login or index for unknown routes
app.get('*', (req, res, next) => {
  // If requesting api routes, pass to next handlers (already handled above, will 404)
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Otherwise, client-side routing or just serve index
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
