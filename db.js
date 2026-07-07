const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) ? false : {
    rejectUnauthorized: false
  }
});

// Helper to calculate active catering dates (skipping Sat, Sun, holidays, and sick days)
function calculateCateringDates(startDateStr, quotaDays, holidaysList, sickDatesList) {
  const dates = [];
  const holidaySet = new Set((holidaysList || []).map(h => h.date));
  const sickSet = new Set(sickDatesList || []);
  
  // Parse startDateStr (YYYY-MM-DD) carefully in local time
  const [year, month, day] = startDateStr.split('-').map(Number);
  const current = new Date(year, month - 1, day);
  
  let safetyCounter = 0;
  const maxIterations = 2000; // Safe limit
  
  while (dates.length < quotaDays && safetyCounter < maxIterations) {
    safetyCounter++;
    
    const curYear = current.getFullYear();
    const curMonth = String(current.getMonth() + 1).padStart(2, '0');
    const curDay = String(current.getDate()).padStart(2, '0');
    const dateStr = `${curYear}-${curMonth}-${curDay}`;
    
    const dayOfWeek = current.getDay(); // 0 = Sun, 6 = Sat
    
    const isHoliday = holidaySet.has(dateStr);
    const isSick = sickSet.has(dateStr);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (!isWeekend && !isHoliday && !isSick) {
      dates.push(dateStr);
    }
    
    // Move to next day
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// Recalculate catering dates for all students based on current holidays
async function recalculateAllStudents() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: students } = await client.query('SELECT * FROM students');
    
    for (const student of students) {
      const { rows: holidays } = await client.query(
        'SELECT * FROM holidays WHERE created_by = $1',
        [student.created_by]
      );
      
      const catering_dates = calculateCateringDates(
        student.start_date,
        student.initial_quota,
        holidays,
        student.sick_dates || []
      );
      
      await client.query(
        'UPDATE students SET catering_dates = $1 WHERE id = $2',
        [catering_dates, student.id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recalculating students:', err);
  } finally {
    client.release();
  }
}

// Initialize tables automatically
async function initDB() {
  const client = await pool.connect();
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `);

    // Create holidays table
    await client.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id VARCHAR(50) PRIMARY KEY,
        date VARCHAR(10) NOT NULL,
        description VARCHAR(255) NOT NULL,
        created_by VARCHAR(100) NOT NULL
      )
    `);

    // Create students table
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        class_name VARCHAR(100) NOT NULL,
        start_date VARCHAR(10) NOT NULL,
        initial_quota INTEGER NOT NULL,
        catering_dates TEXT[] NOT NULL DEFAULT '{}',
        sick_dates TEXT[] NOT NULL DEFAULT '{}',
        created_by VARCHAR(100) NOT NULL
      )
    `);

    // Seed default user mumtaz if users table is empty
    const res = await client.query('SELECT * FROM users WHERE username = $1', ['mumtaz']);
    if (res.rows.length === 0) {
      await client.query('INSERT INTO users (id, username, password) VALUES ($1, $2, $3)', ['1', 'mumtaz', 'Simumtaz123']);
      console.log('Database Seed: Default user "mumtaz" created.');
    }
  } catch (err) {
    console.error('Error initializing PostgreSQL database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Trigger inisialisasi async
initDB().then(() => {
  console.log('PostgreSQL database successfully initialized.');
}).catch((e) => {
  console.error('Database initialization failed:', e);
});

module.exports = {
  // Users
  getUsers: async () => {
    const { rows } = await pool.query('SELECT * FROM users');
    return rows;
  },
  findUser: async (username) => {
    const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    return rows[0] || null;
  },
  addUser: async (username, password) => {
    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
      if (rows.length > 0) {
        return { success: false, message: 'Username sudah digunakan' };
      }
      const newUser = { id: uuidv4(), username, password };
      await pool.query('INSERT INTO users (id, username, password) VALUES ($1, $2, $3)', [newUser.id, newUser.username, newUser.password]);
      return { success: true, user: newUser };
    } catch (e) {
      console.error('Error adding user:', e);
      return { success: false, message: 'Gagal menambahkan user' };
    }
  },
  resetUserPassword: async (id, password) => {
    try {
      const { rows } = await pool.query('UPDATE users SET password = $2 WHERE id = $1 RETURNING *', [id, password]);
      if (rows.length === 0) return { success: false, message: 'User tidak ditemukan' };
      return { success: true, user: rows[0] };
    } catch (e) {
      console.error('Error resetting password:', e);
      return { success: false, message: 'Gagal mereset password' };
    }
  },

  // Students
  getStudents: async (username) => {
    if (!username) {
      const { rows } = await pool.query('SELECT * FROM students');
      return rows;
    }
    const { rows } = await pool.query('SELECT * FROM students WHERE created_by = $1', [username]);
    return rows;
  },
  getStudentById: async (id) => {
    const { rows } = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    return rows[0] || null;
  },
  addStudent: async (name, class_name, start_date, initial_quota, username) => {
    const { rows: holidays } = await pool.query('SELECT * FROM holidays WHERE created_by = $1', [username]);
    const catering_dates = calculateCateringDates(start_date, parseInt(initial_quota), holidays, []);
    
    const newStudent = {
      id: uuidv4(),
      name,
      class_name,
      start_date,
      initial_quota: parseInt(initial_quota),
      catering_dates,
      sick_dates: [],
      created_by: username
    };
    
    await pool.query(
      'INSERT INTO students (id, name, class_name, start_date, initial_quota, catering_dates, sick_dates, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [newStudent.id, newStudent.name, newStudent.class_name, newStudent.start_date, newStudent.initial_quota, newStudent.catering_dates, newStudent.sick_dates, newStudent.created_by]
    );
    return newStudent;
  },
  updateStudent: async (id, updateData) => {
    const { rows: studentRows } = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (studentRows.length === 0) return null;
    const student = studentRows[0];
    
    const name = updateData.name !== undefined ? updateData.name : student.name;
    const class_name = updateData.class_name !== undefined ? updateData.class_name : student.class_name;
    
    let start_date = student.start_date;
    let initial_quota = student.initial_quota;
    let needsRecalc = false;
    
    if (updateData.start_date !== undefined && updateData.start_date !== student.start_date) {
      start_date = updateData.start_date;
      needsRecalc = true;
    }
    if (updateData.initial_quota !== undefined && parseInt(updateData.initial_quota) !== student.initial_quota) {
      initial_quota = parseInt(updateData.initial_quota);
      needsRecalc = true;
    }
    
    let catering_dates = student.catering_dates;
    if (needsRecalc) {
      const { rows: holidays } = await pool.query('SELECT * FROM holidays WHERE created_by = $1', [student.created_by]);
      catering_dates = calculateCateringDates(
        start_date, 
        initial_quota, 
        holidays, 
        student.sick_dates || []
      );
    }
    
    const { rows } = await pool.query(
      'UPDATE students SET name = $1, class_name = $2, start_date = $3, initial_quota = $4, catering_dates = $5 WHERE id = $6 RETURNING *',
      [name, class_name, start_date, initial_quota, catering_dates, id]
    );
    return rows[0];
  },
  deleteStudent: async (id) => {
    const res = await pool.query('DELETE FROM students WHERE id = $1', [id]);
    return res.rowCount > 0;
  },
  markStudentSick: async (id, dateStr) => {
    const { rows: studentRows } = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (studentRows.length === 0) return { success: false, message: 'Siswa tidak ditemukan' };
    const student = studentRows[0];
    
    if (!student.sick_dates) student.sick_dates = [];
    
    // Check if weekend
    const [year, month, day] = dateStr.split('-').map(Number);
    const dObj = new Date(year, month - 1, day);
    const dayOfWeek = dObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { success: false, message: 'Hari Sabtu atau Minggu tidak memotong kuota (tidak perlu ditandai tidak masuk)' };
    }
    
    // Check if already exists
    if (student.sick_dates.includes(dateStr)) {
      return { success: false, message: 'Siswa sudah ditandai tidak masuk pada tanggal tersebut' };
    }
    
    const sick_dates = [...student.sick_dates, dateStr];
    
    const { rows: holidays } = await pool.query('SELECT * FROM holidays WHERE created_by = $1', [student.created_by]);
    const catering_dates = calculateCateringDates(
      student.start_date,
      student.initial_quota,
      holidays,
      sick_dates
    );
    
    const { rows } = await pool.query(
      'UPDATE students SET sick_dates = $1, catering_dates = $2 WHERE id = $3 RETURNING *',
      [sick_dates, catering_dates, id]
    );
    return { success: true, student: rows[0] };
  },
  unmarkStudentSick: async (id, dateStr) => {
    const { rows: studentRows } = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (studentRows.length === 0) return { success: false, message: 'Siswa tidak ditemukan' };
    const student = studentRows[0];
    
    if (!student.sick_dates) student.sick_dates = [];
    
    const sick_dates = student.sick_dates.filter(d => d !== dateStr);
    
    const { rows: holidays } = await pool.query('SELECT * FROM holidays WHERE created_by = $1', [student.created_by]);
    const catering_dates = calculateCateringDates(
      student.start_date,
      student.initial_quota,
      holidays,
      sick_dates
    );
    
    const { rows } = await pool.query(
      'UPDATE students SET sick_dates = $1, catering_dates = $2 WHERE id = $3 RETURNING *',
      [sick_dates, catering_dates, id]
    );
    return { success: true, student: rows[0] };
  },

  // Holidays
  getHolidays: async (username) => {
    if (!username) {
      const { rows } = await pool.query('SELECT * FROM holidays');
      return rows;
    }
    const { rows } = await pool.query('SELECT * FROM holidays WHERE created_by = $1', [username]);
    return rows;
  },
  addHoliday: async (date, description, username) => {
    // Check if weekend (Sat=6, Sun=0)
    const [year, month, day] = date.split('-').map(Number);
    const dObj = new Date(year, month - 1, day);
    const dayOfWeek = dObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { success: false, message: 'Tidak bisa menambahkan hari libur pada hari Sabtu atau Minggu' };
    }
    
    // Check if already exists for this user
    const { rows } = await pool.query('SELECT * FROM holidays WHERE date = $1 AND created_by = $2', [date, username]);
    if (rows.length > 0) {
      return { success: false, message: 'Tanggal tersebut sudah terdaftar sebagai hari libur' };
    }
    
    const newHoliday = {
      id: uuidv4(),
      date,
      description,
      created_by: username
    };
    await pool.query(
      'INSERT INTO holidays (id, date, description, created_by) VALUES ($1, $2, $3, $4)',
      [newHoliday.id, newHoliday.date, newHoliday.description, newHoliday.created_by]
    );
    
    // Recalculate all students' catering dates since a new holiday is added!
    await recalculateAllStudents();
    
    return { success: true, holiday: newHoliday };
  },
  deleteHoliday: async (id) => {
    const res = await pool.query('DELETE FROM holidays WHERE id = $1', [id]);
    const success = res.rowCount > 0;
    
    if (success) {
      // Recalculate all students' catering dates since a holiday was removed!
      await recalculateAllStudents();
    }
    return success;
  },
  
  // Export helper function just in case
  calculateCateringDates,
  recalculateAllStudents
};
