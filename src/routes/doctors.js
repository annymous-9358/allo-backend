import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all doctors
router.get('/', authenticate, (req, res) => {
  const docs = db.prepare('SELECT * FROM doctors').all();
  const availStmt = db.prepare('SELECT day, slot FROM doctor_availability WHERE doctor_id=? ORDER BY day, slot');
  const enriched = docs.map(d => ({
    ...d,
    availability: availStmt.all(d.id).reduce((acc, row) => {
      let dayEntry = acc.find(a=>a.day===row.day);
      if (!dayEntry) { dayEntry = { day: row.day, slots: [] }; acc.push(dayEntry); }
      dayEntry.slots.push(row.slot);
      return acc;
    }, [])
  }));
  res.json(enriched);
});

// Get doctor by id
router.get('/:id', authenticate, (req, res) => {
  const doc = db.prepare('SELECT * FROM doctors WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Doctor not found' });
  const slots = db.prepare('SELECT day, slot FROM doctor_availability WHERE doctor_id=?').all(doc.id)
    .reduce((acc,row)=>{ let d = acc.find(a=>a.day===row.day); if(!d){d={day:row.day,slots:[]};acc.push(d);} d.slots.push(row.slot); return acc;},[]);
  res.json({ ...doc, availability: slots });
});

// Create doctor
router.post('/', authenticate, (req, res) => {
  const { name, specialization, gender, location, imageUrl, availability = [] } = req.body;
  if (!name) return res.status(400).json({ message: 'Name required' });
  const info = db.prepare('INSERT INTO doctors (name,specialization,gender,location,imageUrl) VALUES (?,?,?,?,?)')
    .run(name, specialization || '', gender || '', location || '', imageUrl || '');
  if (availability.length) {
    const stmt = db.prepare('INSERT INTO doctor_availability (doctor_id,day,slot) VALUES (?,?,?)');
    const insertMany = db.transaction(av => { av.forEach(dayEntry => dayEntry.slots.forEach(slot => stmt.run(info.lastInsertRowid, dayEntry.day, slot))); });
    insertMany(availability);
  }
  const created = db.prepare('SELECT * FROM doctors WHERE id=?').get(info.lastInsertRowid);
  // Return enriched with availability for consistency
  res.status(201).json({ ...created, availability });
});

// Update doctor
router.put('/:id', authenticate, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM doctors WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ message: 'Not found' });
  const { name = existing.name, specialization = existing.specialization, gender = existing.gender, location = existing.location, imageUrl = existing.imageUrl, availability } = req.body;
  db.prepare('UPDATE doctors SET name=?, specialization=?, gender=?, location=?, imageUrl=? WHERE id=?')
    .run(name, specialization, gender, location, imageUrl, id);
  if (availability) {
    db.prepare('DELETE FROM doctor_availability WHERE doctor_id=?').run(id);
    const stmt = db.prepare('INSERT INTO doctor_availability (doctor_id,day,slot) VALUES (?,?,?)');
    const insertMany = db.transaction(av => { av.forEach(dayEntry => dayEntry.slots.forEach(slot => stmt.run(id, dayEntry.day, slot))); });
    insertMany(availability);
  }
  const updated = db.prepare('SELECT * FROM doctors WHERE id=?').get(id);
  res.json(updated);
});

// Delete doctor
router.delete('/:id', authenticate, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM doctors WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ message: 'Not found' });
  db.prepare('DELETE FROM doctors WHERE id=?').run(id);
  res.json(existing);
});

export default router;
