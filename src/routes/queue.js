import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

// IDs auto-increment

const router = Router();

router.get('/', authenticate, (req, res) => {
  const items = db.prepare('SELECT * FROM queue ORDER BY queueNumber ASC').all();
  res.json(items);
});

router.post('/', authenticate, (req, res) => {
  const { patientId, patientName, reason, priority } = req.body;
  const max = db.prepare('SELECT COALESCE(MAX(queueNumber),0) as m FROM queue').get().m;
  const queueNumber = max + 1;
  const stmt = db.prepare('INSERT INTO queue (patientId,patientName,queueNumber,status,arrivalTime,reason,priority) VALUES (?,?,?,?,?,?,?)');
  const info = stmt.run(patientId, patientName, queueNumber, 'waiting', new Date().toISOString(), reason, priority || 'normal');
  const item = db.prepare('SELECT * FROM queue WHERE id=?').get(info.lastInsertRowid);
  res.status(201).json(item);
});

router.put('/:id/status', authenticate, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM queue WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ message: 'Not found' });
  const status = req.body.status || existing.status;
  const tx = db.transaction(() => {
    if (status === 'completed') {
      // mark completed and clear queueNumber
      db.prepare('UPDATE queue SET status=?, queueNumber=NULL WHERE id=?').run(status, id);
      renumberQueue();
    } else {
      db.prepare('UPDATE queue SET status=? WHERE id=?').run(status, id);
    }
  });
  // helper to renumber active entries
  function renumberQueue() {
    const active = db.prepare("SELECT id FROM queue WHERE status != 'completed' ORDER BY queueNumber ASC").all();
    const update = db.prepare('UPDATE queue SET queueNumber=? WHERE id=?');
    active.forEach((row, idx) => update.run(idx + 1, row.id));
  }
  tx();
  res.json(db.prepare('SELECT * FROM queue WHERE id=?').get(id));
});

router.delete('/:id', authenticate, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM queue WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ message: 'Not found' });
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM queue WHERE id=?').run(id);
    const active = db.prepare("SELECT id FROM queue WHERE status != 'completed' ORDER BY queueNumber ASC").all();
    const update = db.prepare('UPDATE queue SET queueNumber=? WHERE id=?');
    active.forEach((row, idx) => update.run(idx + 1, row.id));
  });
  tx();
  res.json(existing);
});

router.put('/:id/prioritize', authenticate, (req, res) => {
  const id = req.params.id;
  const item = db.prepare('SELECT * FROM queue WHERE id=?').get(id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  // Shift existing queueNumbers +1
  const tx = db.transaction(() => {
    db.prepare('UPDATE queue SET queueNumber = queueNumber + 1').run();
    db.prepare('UPDATE queue SET priority=?, queueNumber=1 WHERE id=?').run('urgent', id);
  });
  tx();
  const updated = db.prepare('SELECT * FROM queue WHERE id=?').get(id);
  res.json(updated);
});

// Downgrade (set priority to normal) keeping current relative order
router.put('/:id/normalize', authenticate, (req, res) => {
  const id = req.params.id;
  const item = db.prepare('SELECT * FROM queue WHERE id=?').get(id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  db.prepare('UPDATE queue SET priority=? WHERE id=?').run('normal', id);
  const updated = db.prepare('SELECT * FROM queue WHERE id=?').get(id);
  res.json(updated);
});

export default router;
