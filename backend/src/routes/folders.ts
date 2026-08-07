import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import db, { VIDEOS_DIR } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const folders = db.prepare('SELECT * FROM folders ORDER BY name').all();
  res.json({ folders });
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  parent_id: z.string().optional(),
});

router.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const id = uuid();
  const parentPath = parsed.data.parent_id
    ? (db.prepare('SELECT path FROM folders WHERE id = ?').get(parsed.data.parent_id) as any)?.path || VIDEOS_DIR
    : VIDEOS_DIR;
  const folderPath = path.join(parentPath, parsed.data.name);
  fs.mkdirSync(folderPath, { recursive: true });
  db.prepare('INSERT INTO folders (id, name, parent_id, path) VALUES (?, ?, ?, ?)').run(
    id, parsed.data.name, parsed.data.parent_id || null, folderPath
  );
  res.json({ id });
});

router.delete('/:id', (req, res) => {
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id) as any;
  if (!folder) return res.status(404).json({ error: 'Not found' });
  // Don't delete root
  if (!folder.parent_id && folder.name === 'Videos') {
    return res.status(400).json({ error: 'Cannot delete root folder' });
  }
  db.prepare('UPDATE videos SET folder_id = NULL WHERE folder_id = ?').run(req.params.id);
  db.prepare('DELETE FROM folders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.patch('/:id', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ success: true });
});

export default router;
