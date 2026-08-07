import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getActivityLogs, clearActivityLogs, clearFFmpegLogs } from '../utils/logger';
import { LOGS_DIR } from '../db';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticate);

router.get('/activity', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 200;
  const offset = parseInt(req.query.offset as string) || 0;
  const type = req.query.type as string | undefined;
  const logs = getActivityLogs(limit, offset, type);
  res.json({ logs });
});

router.delete('/activity', (req, res) => {
  clearActivityLogs();
  res.json({ success: true });
});

router.delete('/ffmpeg/:streamId?', (req, res) => {
  clearFFmpegLogs(req.params.streamId);
  res.json({ success: true });
});

router.get('/download', (req, res) => {
  const logFile = path.join(LOGS_DIR, 'app.log');
  if (!fs.existsSync(logFile)) return res.status(404).json({ error: 'No log file' });
  res.download(logFile, 'livestream-hub.log');
});

export default router;
