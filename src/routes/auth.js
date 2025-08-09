import { Router } from 'express';
import db from '../db.js';
import bcrypt from 'bcryptjs';
import { issueToken, issueRefreshToken, verifyRefresh } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username & password required' });
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = issueToken(user);
  const refreshToken = issueRefreshToken(user);
  res.json({ token, refreshToken, user: { id: user.id, name: user.name, role: user.role, username: user.username } });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken required' });
  try {
    const decoded = verifyRefresh(refreshToken);
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(decoded.id);
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });
    const token = issueToken(user);
    res.json({ token });
  } catch (e) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
});

export default router;
