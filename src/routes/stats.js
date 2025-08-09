import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req, res) => {
  try {
    const queueCount = db.prepare('SELECT COUNT(*) as c FROM queue').get().c;
    const doctorsCount = db.prepare('SELECT COUNT(*) as c FROM doctors').get().c;
    const todayISO = new Date().toISOString().split('T')[0];
    const appointmentsToday = db.prepare('SELECT COUNT(*) as c FROM appointments WHERE dateTime LIKE ?').get(`${todayISO}%`).c;
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const totalSlotsToday = db.prepare('SELECT COUNT(*) as c FROM doctor_availability WHERE day=?').get(dayName).c;
    const remainingSlots = Math.max(totalSlotsToday - appointmentsToday, 0);
    return res.json({ queueCount, doctorsCount, appointmentsToday, totalSlotsToday, remainingSlots, dayName });
  } catch (e) {
    console.error('Stats error', e);
    return res.status(500).json({ message: 'Failed to compute stats' });
  }
});

export default router;
