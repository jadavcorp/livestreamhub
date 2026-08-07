import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../db';
import { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// In-memory token blacklist for session management (revoked on logout/password change)
export const tokenBlacklist = new Set<string>();

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    if (tokenBlacklist.has(token)) return null;
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  (req as any).user = payload;
  (req as any).token = token;
  next();
}

export function login(username: string, password: string): { token: string; user: JwtPayload } | null {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);
  const payload: JwtPayload = { id: user.id, username: user.username };
  return { token: signToken(payload), user: payload };
}

export function changePassword(userId: number, oldPassword: string, newPassword: string): boolean {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user || !bcrypt.compareSync(oldPassword, user.password_hash)) return false;
  if (newPassword.length < 6) throw new Error('New password must be at least 6 characters');
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
  return true;
}

export function logout(token: string) {
  tokenBlacklist.add(token);
}
