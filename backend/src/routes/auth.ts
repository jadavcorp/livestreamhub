import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, login, logout, changePassword } from '../middleware/auth';
import db from '../db';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', loginLimiter, (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const result = login(parsed.data.username, parsed.data.password);
  if (!result) return res.status(401).json({ error: 'Invalid credentials' });

  res.json({ token: result.token, user: result.user });
});

router.post('/logout', authenticate, (req: Request, res: Response) => {
  const token = (req as any).token as string;
  logout(token);
  res.json({ success: true });
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ?').get(user.id);
  res.json({ user: row });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(200),
});

router.post('/change-password', authenticate, (req: Request, res: Response) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const user = (req as any).user;
  try {
    const ok = changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
