import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import db from '../db';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

const schema = z.object({
  profile_id: z.string().min(1),
  name: z.string().min(1).max(200),
  start_date: z.string().min(1),
  start_time: z.string().min(1),
  stop_time: z.string().optional(),
  repeat: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
  days_of_week: z.array(z.number()).optional(),
  day_of_month: z.number().min(1).max(31).optional(),
  auto_start: z.boolean().optional(),
  auto_stop: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

router.get('/', (req, res) => {
  const schedules = db.prepare(`
    SELECT s.*, p.name as profile_name FROM schedules s
    LEFT JOIN stream_profiles p ON p.id = s.profile_id
    ORDER BY s.created_at DESC
  `).all();
  res.json({ schedules: schedules.map((s: any) => ({ ...s, days_of_week: s.days_of_week ? s.days_of_week.split(',').map(Number) : [] })) });
});

router.post('/', (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const d = parsed.data;
  const id = uuid();
  db.prepare(`
    INSERT INTO schedules (id, profile_id, name, start_date, start_time, stop_time, repeat, days_of_week, day_of_month, auto_start, auto_stop, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, d.profile_id, d.name, d.start_date, d.start_time, d.stop_time || null,
    d.repeat || 'none',
    d.days_of_week ? d.days_of_week.join(',') : null,
    d.day_of_month || null,
    d.auto_start !== false ? 1 : 0,
    d.auto_stop ? 1 : 0,
    d.enabled !== false ? 1 : 0
  );
  logger.info(`Schedule created: ${d.name}`);
  res.json({ id });
});

router.put('/:id', (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const d = parsed.data;
  db.prepare(`
    UPDATE schedules SET profile_id=?, name=?, start_date=?, start_time=?, stop_time=?, repeat=?, days_of_week=?, day_of_month=?, auto_start=?, auto_stop=?, enabled=?
    WHERE id=?
  `).run(
    d.profile_id, d.name, d.start_date, d.start_time, d.stop_time || null,
    d.repeat || 'none',
    d.days_of_week ? d.days_of_week.join(',') : null,
    d.day_of_month || null,
    d.auto_start !== false ? 1 : 0,
    d.auto_stop ? 1 : 0,
    d.enabled !== false ? 1 : 0,
    req.params.id
  );
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
