import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import db from '../db';
import { authenticate } from '../middleware/auth';
import { ffmpegManager } from '../services/ffmpeg';
import { logger } from '../utils/logger';
import { StreamProfile } from '../types';
import { getFFmpegLogs, clearFFmpegLogs } from '../utils/logger';

const router = Router();
router.use(authenticate);

const overlaySchema = z.object({
  type: z.enum(['none', 'image', 'text', 'timestamp']),
  enabled: z.boolean(),
  path: z.string().optional(),
  text: z.string().optional(),
  font_size: z.number().optional(),
  color: z.string().optional(),
  x: z.string().optional(),
  y: z.string().optional(),
  opacity: z.number().optional(),
  scroll: z.boolean().optional(),
}).optional();

const profileSchema = z.object({
  name: z.string().min(1).max(200),
  destination: z.enum(['youtube', 'rtmp']),
  rtmp_url: z.string().min(1),
  stream_key: z.string().min(1),
  source_type: z.enum(['single', 'playlist']),
  video_id: z.string().optional(),
  playlist_id: z.string().optional(),
  loop: z.boolean().optional(),
  repeat_forever: z.boolean().optional(),
  resolution: z.enum(['480p', '720p', '1080p', '1440p', '2160p', 'custom']),
  custom_width: z.number().optional(),
  custom_height: z.number().optional(),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
  video_bitrate: z.number().min(100).max(100000),
  audio_bitrate: z.number().min(32).max(1024),
  encoder: z.enum(['x264', 'nvenc', 'vaapi', 'qsv']),
  preset: z.enum(['ultrafast', 'veryfast', 'fast', 'medium', 'slow']),
  audio_codec: z.enum(['aac', 'mp3', 'copy']).optional(),
  hls_preview: z.boolean().optional(),
  auto_restart: z.boolean().optional(),
  crossfade: z.number().optional(),
  volume_normalize: z.boolean().optional(),
  watermark: overlaySchema,
  scroll_text: overlaySchema,
  timestamp_overlay: overlaySchema,
});

function rowToProfile(row: any): StreamProfile {
  return {
    ...row,
    loop: !!row.loop,
    repeat_forever: !!row.repeat_forever,
    hls_preview: !!row.hls_preview,
    auto_restart: !!row.auto_restart,
    volume_normalize: !!row.volume_normalize,
    shuffle: undefined,
    watermark: row.watermark ? JSON.parse(row.watermark) : undefined,
    scroll_text: row.scroll_text ? JSON.parse(row.scroll_text) : undefined,
    timestamp_overlay: row.timestamp_overlay ? JSON.parse(row.timestamp_overlay) : undefined,
  };
}

// List profiles
router.get('/profiles', (req, res) => {
  const rows = db.prepare('SELECT * FROM stream_profiles ORDER BY created_at DESC').all();
  const profiles = rows.map(rowToProfile);
  res.json({ profiles });
});

router.get('/profiles/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM stream_profiles WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ profile: rowToProfile(row) });
});

// Create profile
router.post('/profiles', (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const d = parsed.data;
  const id = uuid();

  db.prepare(`
    INSERT INTO stream_profiles (
      id, name, destination, rtmp_url, stream_key, source_type, video_id, playlist_id,
      loop, repeat_forever, resolution, custom_width, custom_height, fps, video_bitrate,
      audio_bitrate, encoder, preset, audio_codec, hls_preview, auto_restart, crossfade,
      volume_normalize, watermark, scroll_text, timestamp_overlay
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, d.name, d.destination, d.rtmp_url, d.stream_key, d.source_type,
    d.video_id || null, d.playlist_id || null,
    d.loop ? 1 : 0, d.repeat_forever !== false ? 1 : 0,
    d.resolution, d.custom_width || null, d.custom_height || null,
    d.fps, d.video_bitrate, d.audio_bitrate, d.encoder, d.preset,
    d.audio_codec || 'aac', d.hls_preview !== false ? 1 : 0,
    d.auto_restart !== false ? 1 : 0, d.crossfade || 0,
    d.volume_normalize ? 1 : 0,
    d.watermark ? JSON.stringify(d.watermark) : null,
    d.scroll_text ? JSON.stringify(d.scroll_text) : null,
    d.timestamp_overlay ? JSON.stringify(d.timestamp_overlay) : null
  );

  logger.info(`Stream profile created: ${d.name}`);
  res.json({ id });
});

// Update profile
router.put('/profiles/:id', (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const d = parsed.data;
  const existing = db.prepare('SELECT id FROM stream_profiles WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE stream_profiles SET
      name=?, destination=?, rtmp_url=?, stream_key=?, source_type=?, video_id=?, playlist_id=?,
      loop=?, repeat_forever=?, resolution=?, custom_width=?, custom_height=?, fps=?,
      video_bitrate=?, audio_bitrate=?, encoder=?, preset=?, audio_codec=?, hls_preview=?,
      auto_restart=?, crossfade=?, volume_normalize=?, watermark=?, scroll_text=?, timestamp_overlay=?
    WHERE id=?
  `).run(
    d.name, d.destination, d.rtmp_url, d.stream_key, d.source_type,
    d.video_id || null, d.playlist_id || null,
    d.loop ? 1 : 0, d.repeat_forever !== false ? 1 : 0,
    d.resolution, d.custom_width || null, d.custom_height || null,
    d.fps, d.video_bitrate, d.audio_bitrate, d.encoder, d.preset,
    d.audio_codec || 'aac', d.hls_preview !== false ? 1 : 0,
    d.auto_restart !== false ? 1 : 0, d.crossfade || 0,
    d.volume_normalize ? 1 : 0,
    d.watermark ? JSON.stringify(d.watermark) : null,
    d.scroll_text ? JSON.stringify(d.scroll_text) : null,
    d.timestamp_overlay ? JSON.stringify(d.timestamp_overlay) : null,
    req.params.id
  );
  res.json({ success: true });
});

router.delete('/profiles/:id', (req, res) => {
  // Stop if running
  if (ffmpegManager.getActiveStream(req.params.id)) {
    ffmpegManager.stop(req.params.id).catch(() => {});
  }
  db.prepare('DELETE FROM stream_profiles WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Active streams
router.get('/active', (req, res) => {
  res.json({ streams: ffmpegManager.getActiveStreams() });
});

// Start
router.post('/:id/start', async (req, res) => {
  const row = db.prepare('SELECT * FROM stream_profiles WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Profile not found' });
  try {
    const active = await ffmpegManager.start(rowToProfile(row));
    res.json({ stream: active });
  } catch (e: any) {
    logger.error('Start stream failed', e.message);
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/stop', async (req, res) => {
  await ffmpegManager.stop(req.params.id);
  res.json({ success: true });
});

router.post('/:id/restart', async (req, res) => {
  const active = await ffmpegManager.restart(req.params.id);
  res.json({ stream: active });
});

// FFmpeg logs for a stream
router.get('/:id/logs', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 500;
  const offset = parseInt(req.query.offset as string) || 0;
  const search = req.query.search as string | undefined;
  const logs = getFFmpegLogs(req.params.id, limit, offset, search);
  res.json({ logs });
});

router.delete('/:id/logs', (req, res) => {
  clearFFmpegLogs(req.params.id);
  res.json({ success: true });
});

export default router;
