import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const dbFile = path.join(process.cwd(), 'data', 'app.db');
const dataDir = path.dirname(dbFile);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbFile);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Schema
const createStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specialization TEXT,
    gender TEXT,
    location TEXT,
    imageUrl TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS doctor_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    slot TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patientId INTEGER,
    patientName TEXT,
    doctorId INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    doctorName TEXT,
    dateTime TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patientId INTEGER,
    patientName TEXT,
    queueNumber INTEGER,
    status TEXT,
    arrivalTime TEXT,
    reason TEXT,
    priority TEXT
  )`
];

for (const stmt of createStatements) db.prepare(stmt).run();

// Seed if empty
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('password123', 10);
  db.prepare('INSERT INTO users (username,password,name,role) VALUES (?,?,?,?)')
    .run('frontdesk',hash,'Front Desk Staff','staff');
  const adminHash = bcrypt.hashSync('adminpass', 10);
  db.prepare('INSERT INTO users (username,password,name,role) VALUES (?,?,?,?)')
    .run('admin',adminHash,'System Admin','admin');
}

const doctorCount = db.prepare('SELECT COUNT(*) as c FROM doctors').get().c;
if (doctorCount === 0) {
  const insertDoctor = db.prepare('INSERT INTO doctors (name,specialization,gender,location,imageUrl) VALUES (?,?,?,?,?)');
  const insertAvail = db.prepare('INSERT INTO doctor_availability (doctor_id,day,slot) VALUES (?,?,?)');
  const d1 = insertDoctor.run('Dr. John Smith','Cardiology','Male','Main Building - 2nd Floor','https://via.placeholder.com/150').lastInsertRowid;
  const d2 = insertDoctor.run('Dr. Sarah Johnson','Pediatrics','Female','Children\'s Wing - 1st Floor','https://via.placeholder.com/150').lastInsertRowid;
  [['Monday',['09:00','10:00','11:00']],['Wednesday',['14:00','15:00','16:00']],['Friday',['09:00','10:00','11:00']]].forEach(([day,slots])=> slots.forEach(slot=> insertAvail.run(d1,day,slot)));
  [['Tuesday',['09:00','10:00','11:00']],['Thursday',['09:00','10:00','11:00']]].forEach(([day,slots])=> slots.forEach(slot=> insertAvail.run(d2,day,slot)));
}

const apptCount = db.prepare('SELECT COUNT(*) as c FROM appointments').get().c;
if (apptCount === 0) {
  const doc1 = db.prepare('SELECT id,name FROM doctors WHERE name=?').get('Dr. John Smith');
  const doc2 = db.prepare('SELECT id,name FROM doctors WHERE name=?').get('Dr. Sarah Johnson');
  db.prepare('INSERT INTO appointments (patientId,patientName,doctorId,doctorName,dateTime,status,reason) VALUES (?,?,?,?,?,?,?)')
    .run(101,'Alice Brown',doc1.id,doc1.name,'2025-08-10T10:00:00','booked','Regular checkup');
  db.prepare('INSERT INTO appointments (patientId,patientName,doctorId,doctorName,dateTime,status,reason) VALUES (?,?,?,?,?,?,?)')
    .run(102,'Bob Taylor',doc2.id,doc2.name,'2025-08-10T15:00:00','completed','Flu symptoms');
}

const queueCount = db.prepare('SELECT COUNT(*) as c FROM queue').get().c;
if (queueCount === 0) {
  db.prepare('INSERT INTO queue (patientId,patientName,queueNumber,status,arrivalTime,reason,priority) VALUES (?,?,?,?,?,?,?)')
    .run(106,'Frank Lee',1,'waiting','2025-08-09T09:15:00','High fever','normal');
  db.prepare('INSERT INTO queue (patientId,patientName,queueNumber,status,arrivalTime,reason,priority) VALUES (?,?,?,?,?,?,?)')
    .run(107,'Grace Kim',2,'with_doctor','2025-08-09T09:30:00','Sore throat','normal');
}

// Ensure all user passwords are hashed (migration for previously plain text entries)
const userPwRows = db.prepare('SELECT id, password FROM users').all();
const updatePw = db.prepare('UPDATE users SET password=? WHERE id=?');
userPwRows.forEach(u => {
  if (!u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
    const hash = bcrypt.hashSync(u.password, 10);
    updatePw.run(hash, u.id);
  }
});

export default db;
