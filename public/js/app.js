// Global application state
let state = {
  user: null,
  students: [],
  holidays: [],
  summary: null,
  activeTab: 'dashboard-section',
  users: []
};

// Date formatter helpers
const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateIndo(dateStr) {
  const d = parseLocalDate(dateStr);
  const dayName = INDO_DAYS[d.getDay()];
  const dateNum = d.getDate();
  const monthName = INDO_MONTHS[d.getMonth()];
  const yearNum = d.getFullYear();
  return `${dayName}, ${dateNum} ${monthName} ${yearNum}`;
}

function getDayNameIndo(dateStr) {
  const d = parseLocalDate(dateStr);
  return INDO_DAYS[d.getDay()];
}

// Initialise App
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth first
  const auth = await API.checkAuth();
  if (!auth) return; // API will auto-redirect
  
  state.user = auth.username;
  document.getElementById('admin-name').textContent = state.user;
  
  // Show User Management tab if user is mumtaz
  if (state.user && state.user.toLowerCase() === 'mumtaz') {
    document.getElementById('nav-users-wrapper').classList.remove('hidden');
  }
  
  // Set current date in header
  updateHeaderDate();
  
  // Load initial data
  await refreshData();
  
  // Setup Event Listeners
  setupEventListeners();
});

function updateHeaderDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  document.getElementById('current-date-text').textContent = formatDateIndo(todayStr);
}

// Refresh all dashboard data
async function refreshData() {
  try {
    const promises = [
      API.getStudents(),
      API.getHolidays(),
      API.getSummary()
    ];
    
    // Fetch users if user is mumtaz
    if (state.user && state.user.toLowerCase() === 'mumtaz') {
      promises.push(API.getUsers());
    }
    
    const results = await Promise.all(promises);
    
    state.students = results[0];
    state.holidays = results[1];
    state.summary = results[2];
    
    if (state.user && state.user.toLowerCase() === 'mumtaz') {
      state.users = results[3] || [];
      renderUserList();
    }
    
    // Render views
    renderDashboardSummary();
    renderStudentList();
    renderHolidaysList();
    renderNotifications();
  } catch (error) {
    console.error('Gagal mengambil data:', error);
    alert('Terjadi kesalahan koneksi server');
  }
}

// Refresh data silently to keep local state synced
async function refreshDataSilently() {
  try {
    const promises = [
      API.getStudents(),
      API.getHolidays(),
      API.getSummary()
    ];
    
    if (state.user && state.user.toLowerCase() === 'mumtaz') {
      promises.push(API.getUsers());
    }
    
    const results = await Promise.all(promises);
    
    state.students = results[0];
    state.holidays = results[1];
    state.summary = results[2];
    
    if (state.user && state.user.toLowerCase() === 'mumtaz') {
      state.users = results[3] || [];
    }
  } catch (e) {
    console.error('Silent refresh failed:', e);
  }
}

// Set up UI listeners
function setupEventListeners() {
  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
      await API.logout();
      window.location.href = '/login.html';
    }
  });

  // Tab Navigation
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSection = item.getAttribute('data-target');
      switchTab(targetSection);
    });
  });

  // Navigation redirection button inside dashboard
  document.getElementById('go-to-holidays-btn').addEventListener('click', () => {
    switchTab('holidays-section');
  });

  // Search & Filter Students
  document.getElementById('search-student').addEventListener('input', renderStudentList);
  document.getElementById('filter-status').addEventListener('change', renderStudentList);

  // Notification Bell Dropdown
  const bellBtn = document.getElementById('notification-bell');
  const notificationDropdown = document.getElementById('notification-dropdown');
  
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationDropdown.classList.toggle('hidden');
  });

  document.getElementById('clear-notifications').addEventListener('click', () => {
    notificationDropdown.classList.add('hidden');
  });

  // Close notification dropdown when click outside
  document.addEventListener('click', (e) => {
    if (!notificationDropdown.contains(e.target) && e.target !== bellBtn && !bellBtn.contains(e.target)) {
      notificationDropdown.classList.add('hidden');
    }
  });

  // Student Modal controls
  const studentModal = document.getElementById('student-modal');
  const addStudentBtn = document.getElementById('add-student-btn');
  const closeStudentModal = document.getElementById('close-student-modal');
  const cancelStudentModal = document.getElementById('cancel-student-modal');
  const studentForm = document.getElementById('student-form');

  const openStudentModalFn = (mode, student = null) => {
    studentModal.classList.remove('hidden');
    document.getElementById('student-form').reset();
    
    if (mode === 'add') {
      document.getElementById('modal-title').textContent = 'Tambah Catering Siswa';
      document.getElementById('student-id').value = '';
      document.getElementById('student-parent-whatsapp').value = '';
      // Default start date to today's school date (formatted local YYYY-MM-DD)
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      document.getElementById('student-start-date').value = todayStr;
    } else {
      document.getElementById('modal-title').textContent = 'Edit Catering Siswa';
      document.getElementById('student-id').value = student.id;
      document.getElementById('student-name').value = student.name;
      document.getElementById('student-class').value = student.class_name;
      document.getElementById('student-parent-whatsapp').value = student.parent_whatsapp || '';
      document.getElementById('student-start-date').value = student.start_date;
      document.getElementById('student-quota').value = student.initial_quota;
    }
  };

  addStudentBtn.addEventListener('click', () => openStudentModalFn('add'));
  closeStudentModal.addEventListener('click', () => studentModal.classList.add('hidden'));
  cancelStudentModal.addEventListener('click', () => studentModal.classList.add('hidden'));
  
  // Close modals clicking overlay
  studentModal.addEventListener('click', (e) => {
    if (e.target === studentModal) studentModal.classList.add('hidden');
  });

  // Autocomplete student history
  const nameInput = document.getElementById('student-name');
  const autocompleteList = document.getElementById('autocomplete-list');
  
  const closeAutocomplete = () => {
    autocompleteList.classList.add('hidden');
    autocompleteList.innerHTML = '';
  };

  nameInput.addEventListener('input', () => {
    const query = nameInput.value.toLowerCase().trim();
    if (!query) {
      closeAutocomplete();
      return;
    }

    // Get unique students history
    const history = [];
    const namesSeen = new Set();
    const sorted = [...(state.students || [])].sort((a, b) => b.start_date.localeCompare(a.start_date));
    sorted.forEach(s => {
      const lowerName = s.name.toLowerCase().trim();
      if (!namesSeen.has(lowerName)) {
        namesSeen.add(lowerName);
        history.push({
          name: s.name,
          class_name: s.class_name,
          parent_whatsapp: s.parent_whatsapp || ''
        });
      }
    });

    // Filter by query
    const matches = history.filter(s => s.name.toLowerCase().includes(query));
    if (matches.length === 0) {
      closeAutocomplete();
      return;
    }

    autocompleteList.innerHTML = '';
    matches.forEach(match => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.innerHTML = `
        <strong>${escapeHTML(match.name)}</strong>
        <span>Kelas: ${escapeHTML(match.class_name)} • WA: ${escapeHTML(match.parent_whatsapp || '-')}</span>
      `;
      item.addEventListener('click', () => {
        nameInput.value = match.name;
        document.getElementById('student-class').value = match.class_name;
        document.getElementById('student-parent-whatsapp').value = match.parent_whatsapp;
        closeAutocomplete();
      });
      autocompleteList.appendChild(item);
    });

    autocompleteList.classList.remove('hidden');
  });

  // Close autocomplete on click outside
  document.addEventListener('click', (e) => {
    if (e.target !== nameInput && !autocompleteList.contains(e.target)) {
      closeAutocomplete();
    }
  });

  // Student Form Submit
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('student-id').value;
    const name = nameInput.value.trim();
    const class_name = document.getElementById('student-class').value.trim();
    const parent_whatsapp = document.getElementById('student-parent-whatsapp').value.trim();
    const start_date = document.getElementById('student-start-date').value;
    const initial_quota = parseInt(document.getElementById('student-quota').value);

    const studentData = { name, class_name, start_date, initial_quota, parent_whatsapp };

    try {
      if (id) {
        // Edit mode
        await API.updateStudent(id, studentData);
      } else {
        // Add mode
        await API.addStudent(studentData);
      }
      studentModal.classList.add('hidden');
      await refreshData();
    } catch (err) {
      alert('Gagal menyimpan data katering: ' + err.message);
    }
  });

  // Holiday Form Submit
  const holidayForm = document.getElementById('holiday-form');
  holidayForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('holiday-date').value;
    const description = document.getElementById('holiday-desc').value.trim();

    try {
      const result = await API.addHoliday({ date, description });
      if (result.success) {
        holidayForm.reset();
        await refreshData();
      }
    } catch (err) {
      alert('Gagal menambahkan hari libur: ' + err.message);
    }
  });

  // Calendar Modal controls
  const calendarModal = document.getElementById('calendar-modal');
  const closeCalendarModal = document.getElementById('close-calendar-modal');
  const closeCalendarModalBtn = document.getElementById('close-calendar-modal-btn');
  
  const closeCal = () => calendarModal.classList.add('hidden');
  closeCalendarModal.addEventListener('click', closeCal);
  closeCalendarModalBtn.addEventListener('click', closeCal);
  calendarModal.addEventListener('click', (e) => {
    if (e.target === calendarModal) closeCal();
  });

  // Sick Modal controls
  const sickModal = document.getElementById('sick-modal');
  const closeSickModal = document.getElementById('close-sick-modal');
  const cancelSickModal = document.getElementById('cancel-sick-modal');
  const sickForm = document.getElementById('sick-form');

  const closeSick = () => sickModal.classList.add('hidden');
  closeSickModal.addEventListener('click', closeSick);
  cancelSickModal.addEventListener('click', closeSick);
  sickModal.addEventListener('click', (e) => {
    if (e.target === sickModal) closeSick();
  });

  // Sick Form Submit
  sickForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('sick-student-id').value;
    const date = document.getElementById('sick-date').value;

    try {
      const result = await API.markStudentSick(studentId, date);
      if (result.success) {
        sickModal.classList.add('hidden');
        await refreshData();
      } else {
        alert(result.message || 'Gagal menandai tidak masuk');
      }
    } catch (err) {
      alert('Gagal menandai tidak masuk: ' + err.message);
    }
  });

  // Toggle password visibility for New User
  const toggleNewPassBtn = document.getElementById('toggle-new-password');
  const newPassInput = document.getElementById('new-password');
  if (toggleNewPassBtn && newPassInput) {
    toggleNewPassBtn.addEventListener('click', () => {
      const isPass = newPassInput.type === 'password';
      newPassInput.type = isPass ? 'text' : 'password';
      toggleNewPassBtn.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });
  }

  // Toggle password visibility for Reset Password
  const toggleResetPassBtn = document.getElementById('toggle-reset-password');
  const resetPassInput = document.getElementById('reset-password');
  if (toggleResetPassBtn && resetPassInput) {
    toggleResetPassBtn.addEventListener('click', () => {
      const isPass = resetPassInput.type === 'password';
      resetPassInput.type = isPass ? 'text' : 'password';
      toggleResetPassBtn.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });
  }

  // User Form Submit (Super Admin adding new user)
  const userForm = document.getElementById('user-form');
  if (userForm) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('new-username').value.trim();
      const password = newPassInput.value;

      if (password.length < 6) {
        alert('Password harus minimal 6 karakter!');
        return;
      }

      try {
        const result = await API.addUser(username, password);
        if (result.success) {
          userForm.reset();
          newPassInput.type = 'password';
          toggleNewPassBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
          alert(`User admin ${username} berhasil didaftarkan!`);
          await refreshData();
        }
      } catch (err) {
        alert('Gagal menambahkan user baru: ' + err.message);
      }
    });
  }

  // Reset Password Modal controls
  const resetModal = document.getElementById('reset-password-modal');
  const closeResetModal = document.getElementById('close-reset-modal');
  const cancelResetModal = document.getElementById('cancel-reset-modal');
  const resetForm = document.getElementById('reset-password-form');

  if (resetModal && resetForm) {
    const closeReset = () => {
      resetModal.classList.add('hidden');
      resetForm.reset();
      resetPassInput.type = 'password';
      toggleResetPassBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
    };
    if (closeResetModal) closeResetModal.addEventListener('click', closeReset);
    if (cancelResetModal) cancelResetModal.addEventListener('click', closeReset);
    resetModal.addEventListener('click', (e) => {
      if (e.target === resetModal) closeReset();
    });

    // Reset Password Form Submit
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('reset-user-id').value;
      const username = document.getElementById('reset-username-label').textContent;
      const password = resetPassInput.value;

      if (password.length < 6) {
        alert('Password harus minimal 6 karakter!');
        return;
      }

      try {
        const result = await API.resetPassword(userId, password);
        if (result.success) {
          closeReset();
          alert(`Password untuk user ${username} berhasil direset!`);
          await refreshData();
        }
      } catch (err) {
        alert('Gagal mereset password: ' + err.message);
      }
    });
  }
}

function switchTab(sectionId) {
  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-target') === sectionId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Toggle content panels
  document.querySelectorAll('.tab-content').forEach(section => {
    if (section.id === sectionId) {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });

  // Update headers
  const titleEl = document.getElementById('section-title');
  const subtitleEl = document.getElementById('section-subtitle');
  
  if (sectionId === 'dashboard-section') {
    titleEl.textContent = 'Dashboard Summary';
    subtitleEl.textContent = 'Informasi administrasi katering hari ini.';
  } else if (sectionId === 'students-section') {
    titleEl.textContent = 'Manajemen Siswa Catering';
    subtitleEl.textContent = 'Kelola pesanan katering, kuota, dan kalender katering siswa.';
  } else if (sectionId === 'holidays-section') {
    titleEl.textContent = 'Tanggal Merah (Hari Libur)';
    subtitleEl.textContent = 'Atur hari libur nasional untuk menggeser jadwal katering.';
  } else if (sectionId === 'users-section') {
    titleEl.textContent = 'Manajemen User Admin';
    subtitleEl.textContent = 'Mendaftarkan admin sekolah baru dan mereset kata sandi.';
  }
  
  state.activeTab = sectionId;
}

// Render Dashboard Summary Page
function renderDashboardSummary() {
  const summary = state.summary;
  if (!summary) return;

  document.getElementById('stat-total-students').textContent = summary.totalStudents;
  document.getElementById('stat-active-students').textContent = summary.activeCount;
  document.getElementById('stat-low-quota').textContent = summary.lowCount;
  document.getElementById('stat-expired-quota').textContent = summary.expiredCount;

  // Set weekly catering total stat number
  if (document.getElementById('stat-weekly-catering') && summary.weeklySummary) {
    document.getElementById('stat-weekly-catering').textContent = summary.weeklySummary.totalPortions;
  }

  // Add css alert glow class if there are low quota students
  const alertCard = document.querySelector('.stat-card.alert-status');
  if (summary.lowCount > 0) {
    alertCard.style.borderColor = 'var(--color-red)';
    alertCard.style.background = 'linear-gradient(135deg, var(--color-panel) 80%, rgba(239, 68, 68, 0.05) 100%)';
  } else {
    alertCard.style.borderColor = 'var(--color-panel-border)';
    alertCard.style.background = 'var(--color-panel)';
  }

  // Render Low Quota students table inside dashboard
  const tableBody = document.getElementById('low-quota-students-table');
  tableBody.innerHTML = '';

  if (summary.lowQuotaStudents.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">Semua kuota catering siswa aman.</td>
      </tr>
    `;
  } else {
    summary.lowQuotaStudents.forEach(student => {
      const tr = document.createElement('tr');
      
      const sisaText = `${student.remaining_quota} Hari`;
      
      let waButton = '';
      if (student.remaining_quota === 1) {
        const btnClass = student.whatsapp_sent ? 'btn-wa-success' : 'btn-wa-danger';
        const btnIcon = student.whatsapp_sent ? 'fa-solid fa-circle-check' : 'fa-brands fa-whatsapp';
        const btnText = student.whatsapp_sent ? 'WA Terkirim' : 'Kirim WA';
        waButton = `
          <button class="btn ${btnClass} btn-sm send-wa-btn" data-id="${student.id}" data-name="${escapeHTML(student.name)}" data-phone="${escapeHTML(student.parent_whatsapp)}" title="Kirim notifikasi WhatsApp ke orang tua">
            <i class="${btnIcon}"></i> ${btnText}
          </button>
        `;
      }
      
      tr.innerHTML = `
        <td><strong>${escapeHTML(student.name)}</strong></td>
        <td>${escapeHTML(student.class_name)}</td>
        <td>
          <span class="status-badge low">${sisaText}</span>
        </td>
        <td>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-secondary btn-sm edit-quota-btn" data-id="${student.id}">
              <i class="fa-solid fa-plus-minus"></i> Edit Kuota
            </button>
            ${waButton}
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // Add handlers to edit quota buttons
    tableBody.querySelectorAll('.edit-quota-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-id');
        const student = state.students.find(s => s.id === studentId);
        if (student) {
          const studentModal = document.getElementById('student-modal');
          studentModal.classList.remove('hidden');
          document.getElementById('student-form').reset();
          document.getElementById('modal-title').textContent = 'Tambah / Perpanjang Kuota';
          document.getElementById('student-id').value = student.id;
          document.getElementById('student-name').value = student.name;
          document.getElementById('student-class').value = student.class_name;
          document.getElementById('student-parent-whatsapp').value = student.parent_whatsapp || '';
          document.getElementById('student-start-date').value = student.start_date;
          document.getElementById('student-quota').value = student.initial_quota;
        }
      });
    });

    // Add handlers to send wa buttons
    tableBody.querySelectorAll('.send-wa-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const studentId = btn.getAttribute('data-id');
        const studentName = btn.getAttribute('data-name');
        const parentPhone = btn.getAttribute('data-phone');
        
        if (!parentPhone) {
          alert('Nomor WhatsApp orang tua tidak terdaftar untuk siswa ini! Silakan edit siswa untuk menambahkan nomor WhatsApp.');
          return;
        }

        // Format phone number
        let cleanPhone = parentPhone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '62' + cleanPhone.slice(1);
        }
        if (!cleanPhone.startsWith('62') && cleanPhone.length > 0) {
          cleanPhone = '62' + cleanPhone;
        }

        const templateText = `Assalamu'alaikum warahmatullahi wabarakatuh.

Ayah/Bunda wali dari Ananda ${studentName} yang kami hormati,

Semoga Ayah/Bunda senantiasa diberikan kesehatan, keberkahan, dan kemudahan dalam setiap aktivitas.

Dengan hormat, kami informasikan bahwa layanan Catering Sekolah Ananda berakhir pada hari ini.

Apabila Ayah/Bunda berkenan untuk melanjutkan layanan Catering Sekolah, kami memohon kesediaannya untuk melakukan pembayaran melalui QRIS yang kami lampirkan di bawah ini.

Setelah pembayaran dilakukan, mohon berkenan mengirimkan bukti pembayaran kepada admin agar layanan catering Ananda dapat kami lanjutkan tanpa kendala.

Demikian informasi yang dapat kami sampaikan. Atas perhatian dan kerja sama Ayah/Bunda, kami ucapkan Jazakumullahu khairan katsiran.

Wassalamu'alaikum warahmatullahi wabarakatuh.`;

        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(templateText)}`;
        
        // Open WhatsApp in new tab
        window.open(waUrl, '_blank');

        // Mark as sent in DB & update UI
        try {
          await API.markWhatsAppSent(studentId);
          btn.className = 'btn btn-wa-success btn-sm send-wa-btn';
          btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> WA Terkirim';
          // Update local state silently
          await refreshDataSilently();
        } catch (err) {
          console.error('Gagal memperbarui status WhatsApp:', err);
        }
      });
    });
  }

  // Render Mini Holidays list
  const miniHolidays = document.getElementById('mini-holidays-list');
  miniHolidays.innerHTML = '';

  // Filter holidays in the future, sort them
  const today = summary.today;
  const upcomingHolidays = state.holidays
    .filter(h => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3); // Get top 3

  if (upcomingHolidays.length === 0) {
    miniHolidays.innerHTML = '<p class="text-center text-muted">Tidak ada hari libur terdekat.</p>';
  } else {
    upcomingHolidays.forEach(h => {
      const div = document.createElement('div');
      div.className = 'holiday-mini-item';
      div.innerHTML = `
        <div>
          <div class="holiday-mini-desc">${escapeHTML(h.description)}</div>
          <div class="holiday-mini-date">${getDayNameIndo(h.date)}, ${h.date}</div>
        </div>
      `;
      miniHolidays.appendChild(div);
    });
  }

  // Render Weekly Catering Table
  const weeklyTableBody = document.getElementById('weekly-catering-table-body');
  if (weeklyTableBody && summary.weeklySummary) {
    weeklyTableBody.innerHTML = '';
    
    summary.weeklySummary.breakdown.forEach(day => {
      const tr = document.createElement('tr');
      
      const dayName = getDayNameIndo(day.date);
      const formattedDate = day.date;
      
      let statusBadge = '<span class="status-badge active">Aktif</span>';
      let portionsText = `<strong>${day.portions} Porsi</strong>`;
      let studentNames = '-';
      
      if (day.isHoliday) {
        statusBadge = `<span class="status-badge expired" title="${escapeHTML(day.holidayDescription)}">Libur: ${escapeHTML(day.holidayDescription)}</span>`;
        portionsText = `<span class="text-muted">0 Porsi</span>`;
      } else if (day.students.length === 0) {
        statusBadge = '<span class="status-badge low">Tidak Ada Catering</span>';
        portionsText = '<span class="text-muted">0 Porsi</span>';
      } else {
        studentNames = day.students.map(s => `<strong>${escapeHTML(s.name)}</strong> (${escapeHTML(s.class_name)})`).join(', ');
      }
      
      tr.innerHTML = `
        <td><strong>${dayName}</strong></td>
        <td>${formattedDate}</td>
        <td>${statusBadge}</td>
        <td>${portionsText}</td>
        <td style="max-width: 400px; white-space: normal; word-break: break-word;">${studentNames}</td>
      `;
      weeklyTableBody.appendChild(tr);
    });
  }
}

// Render Notifications
function renderNotifications() {
  const summary = state.summary;
  const badge = document.getElementById('notification-badge');
  const list = document.getElementById('notification-list');
  
  list.innerHTML = '';
  
  if (!summary || summary.lowCount === 0) {
    badge.classList.add('hidden');
    badge.textContent = '0';
    list.innerHTML = '<p class="empty-state">Tidak ada notifikasi kuota kritis.</p>';
    return;
  }
  
  // Show badge with count
  badge.classList.remove('hidden');
  badge.textContent = summary.lowCount;
  
  summary.lowQuotaStudents.forEach(student => {
    const div = document.createElement('div');
    div.className = 'notification-item critical';
    div.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation notification-item-icon"></i>
      <div class="notification-item-content">
        <h4>Kuota Kritis: ${escapeHTML(student.name)}</h4>
        <p>Sisa kuota katering ${student.remaining_quota} hari (${escapeHTML(student.class_name)}).</p>
      </div>
    `;
    list.appendChild(div);
  });
}

// Render Students Table Page
function renderStudentList() {
  const tbody = document.getElementById('students-table-body');
  tbody.innerHTML = '';
  
  const searchVal = document.getElementById('search-student').value.toLowerCase();
  const filterVal = document.getElementById('filter-status').value;
  
  let filteredStudents = state.students;
  
  // Search filter
  if (searchVal) {
    filteredStudents = filteredStudents.filter(student => 
      student.name.toLowerCase().includes(searchVal) || 
      student.class_name.toLowerCase().includes(searchVal)
    );
  }
  
  // Status filter
  if (filterVal !== 'all') {
    filteredStudents = filteredStudents.filter(student => student.status === filterVal);
  }
  
  if (filteredStudents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-muted" style="padding: 30px;">
          Tidak ada data siswa catering yang ditemukan.
        </td>
      </tr>
    `;
    return;
  }
  
  filteredStudents.forEach(student => {
    const tr = document.createElement('tr');
    
    // Status Badge
    let statusText = 'Aktif';
    let statusClass = 'active';
    if (student.status === 'low') {
      statusText = 'Kuota Kritis';
      statusClass = 'low';
    } else if (student.status === 'expired') {
      statusText = 'Habis';
      statusClass = 'expired';
    }
    
    const remainingText = `${student.remaining_quota} / ${student.initial_quota} Hari`;
    
    // Last catering date is the end date
    const endDate = (student.catering_dates && student.catering_dates.length > 0) 
      ? student.catering_dates[student.catering_dates.length - 1] 
      : '-';
    
    tr.innerHTML = `
      <td><strong>${escapeHTML(student.name)}</strong></td>
      <td>${escapeHTML(student.class_name)}</td>
      <td>${student.start_date}</td>
      <td><strong>${endDate}</strong></td>
      <td>${student.initial_quota} Hari</td>
      <td>
        <span class="status-badge ${statusClass}">${remainingText}</span>
      </td>
      <td>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm view-cal-btn" data-id="${student.id}">
          <i class="fa-regular fa-calendar-days"></i> Kalender
        </button>
      </td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-icon mark-sick-btn" data-id="${student.id}" title="Laporkan Tidak Masuk" style="border-color: rgba(249, 115, 22, 0.4); color: #f97316;">
            <i class="fa-solid fa-stethoscope"></i>
          </button>
          <button class="btn btn-secondary btn-icon edit-student-btn" data-id="${student.id}" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-danger btn-icon delete-student-btn" data-id="${student.id}" title="Hapus">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Handlers for dynamic buttons
  tbody.querySelectorAll('.view-cal-btn').forEach(btn => {
    btn.addEventListener('click', () => openCateringCalendar(btn.getAttribute('data-id')));
  });

  tbody.querySelectorAll('.mark-sick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const studentId = btn.getAttribute('data-id');
      const sickModal = document.getElementById('sick-modal');
      sickModal.classList.remove('hidden');
      document.getElementById('sick-form').reset();
      document.getElementById('sick-student-id').value = studentId;
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      document.getElementById('sick-date').value = todayStr;
    });
  });

  tbody.querySelectorAll('.edit-student-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const student = state.students.find(s => s.id === btn.getAttribute('data-id'));
      if (student) {
        const studentModal = document.getElementById('student-modal');
        studentModal.classList.remove('hidden');
        document.getElementById('student-form').reset();
        document.getElementById('modal-title').textContent = 'Edit Catering Siswa';
        document.getElementById('student-id').value = student.id;
        document.getElementById('student-name').value = student.name;
        document.getElementById('student-class').value = student.class_name;
        document.getElementById('student-parent-whatsapp').value = student.parent_whatsapp || '';
        document.getElementById('student-start-date').value = student.start_date;
        document.getElementById('student-quota').value = student.initial_quota;
      }
    });
  });

  tbody.querySelectorAll('.delete-student-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const studentId = btn.getAttribute('data-id');
      const student = state.students.find(s => s.id === studentId);
      if (confirm(`Apakah Anda yakin ingin menghapus data katering siswa "${student.name}"?`)) {
        try {
          await API.deleteStudent(studentId);
          await refreshData();
        } catch (err) {
          alert('Gagal menghapus siswa: ' + err.message);
        }
      }
    });
  });
}

// Render Holidays Table Page
function renderHolidaysList() {
  const tbody = document.getElementById('holidays-table-body');
  tbody.innerHTML = '';
  
  // Sort holidays chronological
  const sortedHolidays = [...state.holidays].sort((a, b) => a.date.localeCompare(b.date));
  
  if (sortedHolidays.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted" style="padding: 20px;">
          Belum ada tanggal merah (hari libur) sekolah yang dimasukkan.
        </td>
      </tr>
    `;
    return;
  }
  
  sortedHolidays.forEach(h => {
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
      <td><strong>${h.date}</strong></td>
      <td>${escapeHTML(h.description)}</td>
      <td>${getDayNameIndo(h.date)}</td>
      <td>
        <button class="btn btn-danger btn-icon delete-holiday-btn" data-id="${h.id}" title="Hapus">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Delete handler
  tbody.querySelectorAll('.delete-holiday-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const holidayId = btn.getAttribute('data-id');
      const holiday = state.holidays.find(h => h.id === holidayId);
      if (confirm(`Hapus tanggal merah "${holiday.description}" (${holiday.date})? Ini akan menghitung ulang jadwal catering semua siswa.`)) {
        try {
          await API.deleteHoliday(holidayId);
          await refreshData();
        } catch (err) {
          alert('Gagal menghapus hari libur: ' + err.message);
        }
      }
    });
  });
}

// Custom Calendar Rendering logic inside Calendar Modal
function openCateringCalendar(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  document.getElementById('cal-student-name').textContent = student.name;
  document.getElementById('cal-student-info').textContent = 
    `${student.class_name} • Kuota Mulai: ${student.initial_quota} Hari • Sisa Kuota: ${student.remaining_quota} Hari`;

  const container = document.getElementById('calendar-view-container');
  container.innerHTML = '';

  const cateringDates = student.catering_dates || [];
  if (cateringDates.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">Belum ada tanggal katering terdaftar.</p>';
    document.getElementById('calendar-modal').classList.remove('hidden');
    return;
  }

  // Find all distinct months involved in catering
  // Dates are in YYYY-MM-DD
  const monthsInvolved = []; // array of { year, monthIndex (0-11) }
  cateringDates.forEach(dateStr => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const mIdx = m - 1;
    if (!monthsInvolved.some(item => item.year === y && item.monthIndex === mIdx)) {
      monthsInvolved.push({ year: y, monthIndex: mIdx });
    }
  });

  // Sort months
  monthsInvolved.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthIndex - b.monthIndex;
  });

  // We should also render the month of the start_date if it is not already included
  const [startY, startM, startD] = student.start_date.split('-').map(Number);
  const startMIdx = startM - 1;
  if (!monthsInvolved.some(item => item.year === startY && item.monthIndex === startMIdx)) {
    monthsInvolved.unshift({ year: startY, monthIndex: startMIdx });
  }

  // Get Today's local date string
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const holidayMap = {};
  state.holidays.forEach(h => {
    holidayMap[h.date] = h.description;
  });

  const cateringSet = new Set(cateringDates);
  const sickSet = new Set(student.sick_dates || []);

  // Render each month calendar
  monthsInvolved.forEach(({ year, monthIndex }) => {
    const monthCard = document.createElement('div');
    monthCard.className = 'calendar-month';
    
    const title = document.createElement('div');
    title.className = 'month-title';
    title.textContent = `${INDO_MONTHS[monthIndex]} ${year}`;
    monthCard.appendChild(title);
    
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    
    // Add Day Names headers (Mon to Sun)
    const dayHeaders = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    dayHeaders.forEach(dh => {
      const headerCell = document.createElement('div');
      headerCell.className = 'day-name';
      headerCell.textContent = dh;
      grid.appendChild(headerCell);
    });
    
    // Get first day of the month
    const firstDay = new Date(year, monthIndex, 1);
    // Align Monday as 0, Sunday as 6
    let startOffset = (firstDay.getDay() + 6) % 7; 
    
    // Empty spacer cells for start offset
    for (let i = 0; i < startOffset; i++) {
      const spacer = document.createElement('div');
      spacer.className = 'day-cell empty';
      grid.appendChild(spacer);
    }
    
    // Days in this month
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'day-cell';
      cell.textContent = day;
      
      const mStr = String(monthIndex + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const curDateStr = `${year}-${mStr}-${dStr}`;
      
      // Determine day attributes
      const dateObj = new Date(year, monthIndex, day);
      const dayOfWeek = dateObj.getDay(); // 0 = Sun, 6 = Sat
      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
      
      const isHoliday = holidayMap[curDateStr];
      const isSick = sickSet.has(curDateStr);
      const isCatering = cateringSet.has(curDateStr);
      const isToday = curDateStr === todayStr;
      
      // Styling priority
      if (isWeekendDay) {
        cell.classList.add('weekend');
      } else if (isHoliday) {
        cell.classList.add('holiday');
        cell.setAttribute('data-tooltip', isHoliday);
      } else if (isSick) {
        cell.classList.add('sick-day');
        cell.setAttribute('data-tooltip', 'Siswa Tidak Masuk');
      }
      
      if (isCatering) {
        if (curDateStr < todayStr) {
          cell.classList.add('catering-past');
          // Add miniature check icon
          const check = document.createElement('i');
          check.className = 'fa-solid fa-circle-check checkmark';
          cell.appendChild(check);
        } else {
          cell.classList.add('catering-active');
        }
        
        if (isToday) {
          cell.classList.add('today-active');
        }
      } else {
        if (isToday) {
          cell.classList.add('today');
        }
      }
      
      grid.appendChild(cell);
    }
    
    monthCard.appendChild(grid);
    container.appendChild(monthCard);
  });

  // Render sick days list at the bottom of the modal
  const sickSectionEl = document.getElementById('calendar-sick-section');
  const sickListEl = document.getElementById('calendar-sick-list');
  
  if (student.sick_dates && student.sick_dates.length > 0) {
    sickSectionEl.classList.remove('hidden');
    sickListEl.innerHTML = '';
    
    const sortedSickDates = [...student.sick_dates].sort((a, b) => a.localeCompare(b));
    sortedSickDates.forEach(dateStr => {
      const item = document.createElement('div');
      item.className = 'holiday-mini-item';
      item.style.borderLeftColor = '#f97316';
      item.style.padding = '8px 12px';
      item.innerHTML = `
        <div>
          <div style="font-size: 13px; font-weight: 600;">Tidak Masuk</div>
          <div style="font-size: 11px; color: var(--color-text-muted);">${getDayNameIndo(dateStr)}, ${dateStr}</div>
        </div>
        <button class="btn btn-danger btn-icon delete-sick-btn" data-student-id="${student.id}" data-date="${dateStr}" style="width: 28px; height: 28px; font-size: 11px;" title="Hapus catatan tidak masuk">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      `;
      sickListEl.appendChild(item);
    });
    
    // Add click listeners to delete sick day buttons
    sickListEl.querySelectorAll('.delete-sick-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sId = btn.getAttribute('data-student-id');
        const date = btn.getAttribute('data-date');
        if (confirm(`Hapus catatan tidak masuk tanggal ${date}? Kuota catering akan dihitung ulang.`)) {
          try {
            await API.unmarkStudentSick(sId, date);
            await refreshData();
            // Re-open/refresh calendar view immediately
            openCateringCalendar(sId);
          } catch (err) {
            alert('Gagal menghapus catatan tidak masuk: ' + err.message);
          }
        }
      });
    });
  } else {
    sickSectionEl.classList.add('hidden');
    sickListEl.innerHTML = '';
  }

  document.getElementById('calendar-modal').classList.remove('hidden');
}

// XSS escape helper
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Render users list (Super Admin only)
function renderUserList() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (state.users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center" style="padding: 30px; color: var(--color-text-muted);">Tidak ada user admin lain yang terdaftar.</td>
      </tr>
    `;
    return;
  }

  // Filter out mumtaz himself so they don't reset their own password here
  const otherUsers = state.users.filter(u => u.username.toLowerCase() !== 'mumtaz');

  if (otherUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center" style="padding: 30px; color: var(--color-text-muted);">Tidak ada user admin lain yang terdaftar.</td>
      </tr>
    `;
    return;
  }

  otherUsers.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHTML(user.username)}</strong></td>
      <td><span style="font-family: monospace; font-size: 12.5px; opacity: 0.85;">${user.id}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm reset-user-pass-btn" data-id="${user.id}" data-username="${escapeHTML(user.username)}">
          <i class="fa-solid fa-key"></i> Reset Password
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind click listeners for Reset Password buttons
  tbody.querySelectorAll('.reset-user-pass-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const username = btn.getAttribute('data-username');
      
      document.getElementById('reset-user-id').value = id;
      document.getElementById('reset-username-label').textContent = username;
      document.getElementById('reset-password-modal').classList.remove('hidden');
    });
  });
}
