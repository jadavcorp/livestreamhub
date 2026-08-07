import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getSettings, updateSettings } from '../utils/settings';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ settings: getSettings() });
});

const schema = z.object({
  default_bitrate: z.number().min(100).max(100000).optional(),
  default_resolution: z.string().optional(),
  default_fps: z.number().optional(),
  default_encoder: z.string().optional(),
  default_preset: z.string().optional(),
  upload_folder: z.string().optional(),
  backup_folder: z.string().optional(),
  ffmpeg_path: z.string().optional(),
  ffprobe_path: z.string().optional(),
  timezone: z.string().optional(),
  auto_update: z.boolean().optional(),
  hls_enabled: z.boolean().optional(),
  watchdog_enabled: z.boolean().optional(),
  notifications_enabled: z.boolean().optional(),
  volume_normalization: z.boolean().optional(),
  crossfade_duration: z.number().optional(),
});

router.put('/', (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  updateSettings(parsed.data as any);
  res.json({ success: true, settings: getSettings() });
});

export default router;
