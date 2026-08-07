import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import db from '../db';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

function getPlaylistDuration(playlistId: string): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(v.duration), 0) as d
    FROM playlist_items pi JOIN videos v ON v.id = pi.video_id
    WHERE pi.playlist_id = ?
  `).get(playlistId) as any;
  return row?.d || 0;
}

function refreshPlaylistDuration(id: string) {
  const d = getPlaylistDuration(id);
  db.prepare('UPDATE playlists SET duration = ? WHERE id = ?').run(d, id);
}

router.get('/', (req, res) => {
  const playlists = db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = p.id) as items_count
    FROM playlists p ORDER BY p.created_at DESC
  `).all();
  res.json({ playlists });
});

router.get('/:id', (req, res) => {
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
  if (!playlist) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare(`
    SELECT pi.*, v.id as vid, v.title, v.duration, v.thumbnail_path, v.size, v.width, v.height, v.filename, v.original_name
    FROM playlist_items pi JOIN videos v ON v.id = pi.video_id
    WHERE pi.playlist_id = ? ORDER BY pi.position ASC
  `).all(req.params.id);
  res.json({ playlist, items });
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  shuffle: z.boolean().optional(),
  repeat: z.boolean().optional(),
  loop_forever: z.boolean().optional(),
  videoIds: z.array(z.string()).optional(),
});

router.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const id = uuid();
  const data = parsed.data;

  db.prepare(`
    INSERT INTO playlists (id, name, description, shuffle, repeat, loop_forever, duration)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(id, data.name, data.description || null, data.shuffle ? 1 : 0, data.repeat !== false ? 1 : 0, data.loop_forever !== false ? 1 : 0);

  if (data.videoIds && data.videoIds.length) {
    const stmt = db.prepare('INSERT INTO playlist_items (id, playlist_id, video_id, position) VALUES (?, ?, ?, ?)');
    data.videoIds.forEach((vid, i) => stmt.run(uuid(), id, vid, i));
  }
  refreshPlaylistDuration(id);
  logger.info(`Playlist created: ${data.name}`);
  res.json({ id });
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  shuffle: z.boolean().optional(),
  repeat: z.boolean().optional(),
  loop_forever: z.boolean().optional(),
  thumbnail_path: z.string().optional(),
});

router.patch('/:id', (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const fields: string[] = [];
  const values: any[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`);
    values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
  }
  if (fields.length === 0) return res.json({ success: true });
  values.push(req.params.id);
  db.prepare(`UPDATE playlists SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);
  logger.info('Playlist deleted', req.params.id);
  res.json({ success: true });
});

// Duplicate
router.post('/:id/duplicate', (req, res) => {
  const src = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id) as any;
  if (!src) return res.status(404).json({ error: 'Not found' });
  const id = uuid();
  db.prepare(`
    INSERT INTO playlists (id, name, description, thumbnail_path, shuffle, repeat, loop_forever, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, `${src.name} (Copy)`, src.description, src.thumbnail_path, src.shuffle, src.repeat, src.loop_forever, src.duration);
  const items = db.prepare('SELECT video_id, position FROM playlist_items WHERE playlist_id = ? ORDER BY position').all(req.params.id) as any[];
  const stmt = db.prepare('INSERT INTO playlist_items (id, playlist_id, video_id, position) VALUES (?, ?, ?, ?)');
  items.forEach((it) => stmt.run(uuid(), id, it.video_id, it.position));
  res.json({ id });
});

// Add videos
router.post('/:id/videos', (req, res) => {
  const { videoIds } = req.body as { videoIds: string[] };
  if (!Array.isArray(videoIds)) return res.status(400).json({ error: 'videoIds array required' });
  const max = (db.prepare('SELECT COALESCE(MAX(position), -1) as m FROM playlist_items WHERE playlist_id = ?').get(req.params.id) as any).m;
  const stmt = db.prepare('INSERT INTO playlist_items (id, playlist_id, video_id, position) VALUES (?, ?, ?, ?)');
  videoIds.forEach((vid, i) => stmt.run(uuid(), req.params.id, vid, max + 1 + i));
  refreshPlaylistDuration(req.params.id);
  res.json({ success: true });
});

// Remove video
router.delete('/:id/videos/:itemId', (req, res) => {
  db.prepare('DELETE FROM playlist_items WHERE id = ? AND playlist_id = ?').run(req.params.itemId, req.params.id);
  refreshPlaylistDuration(req.params.id);
  res.json({ success: true });
});

// Reorder
router.post('/:id/reorder', (req, res) => {
  const { order } = req.body as { order: { id: string; position: number }[] };
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
  const stmt = db.prepare('UPDATE playlist_items SET position = ? WHERE id = ? AND playlist_id = ?');
  const tx = db.transaction((items: any[]) => {
    items.forEach((it) => stmt.run(it.position, it.id, req.params.id));
  });
  tx(order);
  res.json({ success: true });
});

export default router;
