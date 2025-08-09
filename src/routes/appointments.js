import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

// IDs auto-increment in DB

const router = Router();

router.get('/', authenticate, (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const p = Number(page); const l = Number(limit);
  const offset = (p-1)*l;
  const rows = db.prepare('SELECT * FROM appointments ORDER BY dateTime LIMIT ? OFFSET ?').all(l, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM appointments').get().c;
  res.json({ data: rows, page: p, total, totalPages: Math.ceil(total/l) });
});

router.get('/doctor/:doctorId', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM appointments WHERE doctorId=? ORDER BY dateTime').all(req.params.doctorId);
  res.json(rows);
});

router.get('/patient/:patientId', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM appointments WHERE patientId=? ORDER BY dateTime').all(req.params.patientId);
  res.json(rows);
});

// Get available slots for a doctor on a specific date (YYYY-MM-DD)
router.get('/available-slots/:doctorId/:date', authenticate, (req, res) => {
  const { doctorId, date } = req.params;
  const doctor = db.prepare('SELECT * FROM doctors WHERE id=?').get(doctorId);
  if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
  const weekday = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const slots = db.prepare('SELECT slot FROM doctor_availability WHERE doctor_id=? AND day=? ORDER BY slot').all(doctorId, weekday).map(r=>r.slot);
  const taken = db.prepare("SELECT strftime('%H:%M', dateTime) as slot FROM appointments WHERE doctorId=? AND date(dateTime)=date(?)").all(doctorId, date).map(r=>r.slot);
  const available = slots.filter(s => !taken.includes(s));
  res.json({ date, doctorId: Number(doctorId), weekday, slots: available });
});

router.post('/', authenticate, (req, res) => {
  const { patientId, patientName, doctorId, dateTime, reason } = req.body;
  if (!patientName || !doctorId || !dateTime) return res.status(400).json({ message: 'Missing required fields' });
  const doctor = db.prepare('SELECT * FROM doctors WHERE id=?').get(doctorId);
  if (!doctor) return res.status(400).json({ message: 'Invalid doctorId' });
  // Validate slot fits availability
  const datePart = dateTime.split('T')[0];
  const timePart = dateTime.split('T')[1]?.substring(0,5);
  if (!timePart) return res.status(400).json({ message: 'Invalid time format' });
  const weekday = new Date(datePart + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const allowed = db.prepare('SELECT 1 FROM doctor_availability WHERE doctor_id=? AND day=? AND slot=?').get(doctorId, weekday, timePart);
  if (!allowed) return res.status(400).json({ message: 'Time not in doctor availability' });
  const conflict = db.prepare("SELECT 1 FROM appointments WHERE doctorId=? AND date(dateTime)=date(?) AND strftime('%H:%M', dateTime)=?").get(doctorId, datePart, timePart);
  if (conflict) return res.status(409).json({ message: 'Slot already booked' });
  const stmt = db.prepare('INSERT INTO appointments (patientId,patientName,doctorId,doctorName,dateTime,status,reason) VALUES (?,?,?,?,?,?,?)');
  const info = stmt.run(patientId || null, patientName, doctorId, doctor.name, dateTime, 'booked', reason || '');
  const appt = db.prepare('SELECT * FROM appointments WHERE id=?').get(info.lastInsertRowid);
  res.status(201).json(appt);
});

router.put('/:id', authenticate, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM appointments WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ message: 'Not found' });
  const { dateTime = existing.dateTime, status = existing.status, reason = existing.reason } = req.body;
  db.prepare('UPDATE appointments SET dateTime=?, status=?, reason=? WHERE id=?').run(dateTime, status, reason, id);
  const updated = db.prepare('SELECT * FROM appointments WHERE id=?').get(id);
  res.json(updated);
});

router.put('/:id/cancel', authenticate, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM appointments WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ message: 'Not found' });
  db.prepare('UPDATE appointments SET status=? WHERE id=?').run('canceled', id);
  const updated = db.prepare('SELECT * FROM appointments WHERE id=?').get(id);
  res.json(updated);
});

export default router;
