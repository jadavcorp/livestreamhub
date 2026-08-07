import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate } from '../middleware/auth';
import { ffmpegManager } from '../services/ffmpeg';
import { getSystemStats } from '../services/system';
import { getActivityLogs } from '../utils/logger';

const router = Router();
router.use(authenticate);

router.get('/stats', async (req: Request, res: Response) => {
  const totalVideos = (db.prepare('SELECT COUNT(*) as c FROM videos').get() as any).c;
  const totalPlaylists = (db.prepare('SELECT COUNT(*) as c FROM playlists').get() as any).c;
  const activeStreams = ffmpegManager.getActiveStreams();
  const running = activeStreams.filter((s) => s.status === 'running' || s.status === 'starting').length;
  const stopped = activeStreams.filter((s) => s.status === 'idle' || s.status === 'crashed' || s.status === 'error').length;

  const sys = await getSystemStats();

  // Aggregate current bitrate/fps/resolution across running streams
  const currentBitrate = activeStreams.reduce((sum, s) => sum + (s.current_bitrate || 0), 0);
  const currentFps = activeStreams.length ? activeStreams[0].current_fps : 0;
  const currentRes = activeStreams.length ? activeStreams[0].current_resolution : '—';

  const recent = getActivityLogs(15);

  res.json({
    totalVideos,
    totalPlaylists,
    runningStreams: running,
    stoppedStreams: stopped,
    activeStreams,
    cpu: sys.cpu,
    memory: sys.mem,
    disk: sys.disk,
    network: sys.network,
    uptime: sys.uptime,
    currentBitrate,
    currentFps,
    currentResolution: currentRes,
    recentActivity: recent,
  });
});

export default router;
