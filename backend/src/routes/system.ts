import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getSystemStats } from '../services/system';
import { validateFFmpeg } from '../services/media';

const router = Router();
router.use(authenticate);

router.get('/stats', async (req, res) => {
  const stats = await getSystemStats();
  res.json(stats);
});

router.get('/ffmpeg-info', async (req, res) => {
  const info = await validateFFmpeg();
  res.json(info);
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

export default router;
