const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrate() {
  const dbUrl = process.env.DATABASE_URL || process.argv[2];
  
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable is missing.');
    console.error('Usage: DATABASE_URL=your_postgres_url node migrate-local-db.js');
    console.error('OR: node migrate-local-db.js your_postgres_url');
    process.exit(1);
  }

  const dbPath = path.join(__dirname, 'data', 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.error('ERROR: Local data file data/db.json was not found.');
    process.exit(1);
  }

  let localData;
  try {
    const fileContent = fs.readFileSync(dbPath, 'utf8');
    localData = JSON.parse(fileContent);
  } catch (err) {
    console.error('ERROR: Failed to read or parse data/db.json:', err.message);
    process.exit(1);
  }

  console.log('Connecting to PostgreSQL database...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  
  try {
    console.log('Ensuring database schema exists...');
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS holidays (
        id VARCHAR(50) PRIMARY KEY,
        date VARCHAR(10) NOT NULL,
        description VARCHAR(255) NOT NULL,
        created_by VARCHAR(100) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        class_name VARCHAR(100) NOT NULL,
        start_date VARCHAR(10) NOT NULL,
        initial_quota INTEGER NOT NULL,
        catering_dates TEXT[] NOT NULL DEFAULT '{}',
        sick_dates TEXT[] NOT NULL DEFAULT '{}',
        created_by VARCHAR(100) NOT NULL
      );
    `);

    console.log('Starting migration...');
    await client.query('BEGIN');

    // 1. Migrate Users
    if (localData.users && Array.isArray(localData.users)) {
      console.log(`Migrating ${localData.users.length} users...`);
      for (const u of localData.users) {
        await client.query(
          'INSERT INTO users (id, username, password) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password',
          [u.id, u.username, u.password]
        );
      }
    }

    // 2. Migrate Holidays
    if (localData.holidays && Array.isArray(localData.holidays)) {
      console.log(`Migrating ${localData.holidays.length} holidays...`);
      for (const h of localData.holidays) {
        // Prevent duplicate date + created_by
        const { rows } = await client.query('SELECT id FROM holidays WHERE date = $1 AND created_by = $2', [h.date, h.created_by || 'mumtaz']);
        if (rows.length === 0) {
          await client.query(
            'INSERT INTO holidays (id, date, description, created_by) VALUES ($1, $2, $3, $4)',
            [h.id, h.date, h.description, h.created_by || 'mumtaz']
          );
        } else {
          await client.query(
            'UPDATE holidays SET description = $1 WHERE id = $2',
            [h.description, rows[0].id]
          );
        }
      }
    }

    // 3. Migrate Students
    if (localData.students && Array.isArray(localData.students)) {
      console.log(`Migrating ${localData.students.length} students...`);
      for (const s of localData.students) {
        await client.query(
          'INSERT INTO students (id, name, class_name, start_date, initial_quota, catering_dates, sick_dates, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, class_name = EXCLUDED.class_name, start_date = EXCLUDED.start_date, initial_quota = EXCLUDED.initial_quota, catering_dates = EXCLUDED.catering_dates, sick_dates = EXCLUDED.sick_dates, created_by = EXCLUDED.created_by',
          [s.id, s.name, s.class_name, s.start_date, s.initial_quota, s.catering_dates || [], s.sick_dates || [], s.created_by || 'mumtaz']
        );
      }
    }

    await client.query('COMMIT');
    console.log('MIGRATION COMPLETED SUCCESSFULLY!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('MIGRATION FAILED:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
