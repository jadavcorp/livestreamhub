import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import db, { VIDEOS_DIR } from '../db';
import { authenticate } from '../middleware/auth';
import { probeVideo, generateThumbnail, isVideoFile } from '../services/media';
import { logger } from '../utils/logger';
import { formatDuration } from '../services/system';
import { Video } from '../types';

const router = Router();
router.use(authenticate);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folderId = (req.body.folderId as string) || undefined;
    let destDir = VIDEOS_DIR;
    if (folderId) {
      const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId) as any;
      if (folder) destDir = folder.path;
    }
    fs.mkdirSync(destDir, { recursive: true });
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const id = uuid();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 * 1024 }, // 100 GB
  fileFilter: (req, file, cb) => {
    if (isVideoFile(file.originalname)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

// List videos
router.get('/', (req: Request, res: Response) => {
  const folderId = req.query.folderId as string | undefined;
  const search = req.query.search as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM videos WHERE 1=1';
  const params: any[] = [];
  if (folderId) { sql += ' AND folder_id = ?'; params.push(folderId); }
  if (search) { sql += ' AND title LIKE ?'; params.push(`%${search}%`); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const videos = db.prepare(sql).all(...params);

  let countSql = 'SELECT COUNT(*) as c FROM videos WHERE 1=1';
  const countParams: any[] = [];
  if (folderId) { countSql += ' AND folder_id = ?'; countParams.push(folderId); }
  if (search) { countSql += ' AND title LIKE ?'; countParams.push(`%${search}%`); }
  const total = (db.prepare(countSql).get(...countParams) as any).c;

  res.json({ videos, total, page, pages: Math.ceil(total / limit) });
});

// Get single video
router.get('/:id', (req: Request, res: Response) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as Video | undefined;
  if (!video) return res.status(404).json({ error: 'Not found' });
  res.json({ video });
});

// Upload (single or multiple via array)
router.post('/upload', upload.array('files', 20), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const folderId = (req.body.folderId as string) || null;
  const results: any[] = [];

  for (const file of files) {
    try {
      const id = path.basename(file.filename, path.extname(file.filename));
      const title = path.parse(file.originalname).name;
      const probe = await probeVideo(file.path);
      const thumbnail = await generateThumbnail(id, file.path, probe.duration);

      const video: Video = {
        id,
        title,
        original_name: file.originalname,
        filename: file.filename,
        filepath: file.path,
        thumbnail_path: thumbnail || undefined,
        duration: probe.duration,
        size: probe.size,
        width: probe.width,
        height: probe.height,
        fps: probe.fps,
        codec: probe.codec,
        format: probe.format,
        folder_id: folderId || undefined,
        created_at: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO videos (id, title, original_name, filename, filepath, thumbnail_path, duration, size, width, height, fps, codec, format, folder_id)
        VALUES (@id, @title, @original_name, @filename, @filepath, @thumbnail_path, @duration, @size, @width, @height, @fps, @codec, @format, @folder_id)
      `).run(video);

      logger.upload(`Video uploaded: ${title}`, `${file.originalname} (${(probe.size / 1024 / 1024).toFixed(1)} MB)`);
      results.push({ success: true, video });
    } catch (e: any) {
      logger.error(`Upload failed: ${file.originalname}`, e.message);
      results.push({ success: false, filename: file.originalname, error: e.message });
    }
  }

  res.json({ results });
});

// Rename
router.patch('/:id', (req: Request, res: Response) => {
  const { title, folderId } = req.body;
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as Video | undefined;
  if (!video) return res.status(404).json({ error: 'Not found' });

  if (title) db.prepare('UPDATE videos SET title = ? WHERE id = ?').run(title, req.params.id);
  if (folderId !== undefined) db.prepare('UPDATE videos SET folder_id = ? WHERE id = ?').run(folderId || null, req.params.id);
  const updated = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  res.json({ video: updated });
});

// Delete
router.delete('/:id', (req: Request, res: Response) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as Video | undefined;
  if (!video) return res.status(404).json({ error: 'Not found' });

  // Remove file
  try { if (fs.existsSync(video.filepath)) fs.unlinkSync(video.filepath); } catch { /* ignore */ }
  // Remove thumbnail
  if (video.thumbnail_path) {
    const thumb = path.join(process.cwd(), video.thumbnail_path);
    try { if (fs.existsSync(thumb)) fs.unlinkSync(thumb); } catch { /* ignore */ }
  }
  db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
  logger.info(`Video deleted: ${video.title}`);
  res.json({ success: true });
});

// Download
router.get('/:id/download', (req: Request, res: Response) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as Video | undefined;
  if (!video) return res.status(404).json({ error: 'Not found' });
  if (!fs.existsSync(video.filepath)) return res.status(404).json({ error: 'File missing' });
  res.download(video.filepath, video.original_name);
});

// Stream/play (progressive)
router.get('/:id/play', (req: Request, res: Response) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as Video | undefined;
  if (!video) return res.status(404).json({ error: 'Not found' });
  if (!fs.existsSync(video.filepath)) return res.status(404).json({ error: 'File missing' });

  const stat = fs.statSync(video.filepath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(video.filepath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(video.filepath).pipe(res);
  }
});

// Stats/count
router.get('/meta/stats', (req: Request, res: Response) => {
  const total = (db.prepare('SELECT COUNT(*) as c FROM videos').get() as any).c;
  const sizeRow = db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM videos').get() as any;
  res.json({ count: total, totalSize: sizeRow.total });
});

export default router;
