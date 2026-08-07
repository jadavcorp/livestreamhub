import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';

import db, { STORAGE_DIR, VIDEOS_DIR, THUMBNAILS_DIR, HLS_DIR, LOGS_DIR } from './db';
import { logger } from './utils/logger';
import { ffmpegManager } from './services/ffmpeg';
import { scheduler } from './services/scheduler';

import authRoutes from './routes/auth';
import videosRoutes from './routes/videos';
import playlistsRoutes from './routes/playlists';
import streamsRoutes from './routes/streams';
import schedulesRoutes from './routes/schedules';
import logsRoutes from './routes/logs';
import settingsRoutes from './routes/settings';
import foldersRoutes from './routes/folders';
import backupRoutes from './routes/backup';
import systemRoutes from './routes/system';
import dashboardRoutes from './routes/dashboard';

const app = express();
const server = http.createServer(app);

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Global rate limiter (API)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Serve static storage (thumbnails, HLS preview, uploaded files)
app.use('/thumbnails', express.static(THUMBNAILS_DIR, { maxAge: '1h' }));
app.use('/hls', express.static(HLS_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (filePath.endsWith('.ts')) {
      res.setHeader('Cache-Control', 'public, max-age=10');
      res.setHeader('Content-Type', 'video/mp2t');
    }
  },
}));

// Serve built frontend (static export)
const frontendPath = path.join(__dirname, '../../frontend/out');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  logger.info('Serving frontend from', frontendPath);
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/streams', streamsRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/system', systemRoutes);

// Health endpoint (no auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() });
});

// SPA fallback for frontend
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/thumbnails/') || req.path.startsWith('/hls/')) return next();
  const indexFile = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).json({ error: 'Not found', message: 'Frontend not built. Run: cd frontend && npm install && npm run build' });
  }
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err.stack || err.message);
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// WebSocket for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<any>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.send(JSON.stringify({ type: 'connected', message: 'LiveStream Hub WebSocket connected' }));
});

function broadcast(event: string, data: any) {
  const msg = JSON.stringify({ type: event, data });
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

ffmpegManager.on('status', (active) => broadcast('stream:status', active));
ffmpegManager.on('stats', (active) => broadcast('stream:stats', active));
ffmpegManager.on('stopped', (id) => broadcast('stream:stopped', { id }));

// Start
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, async () => {
  logger.system(`LiveStream Hub backend running on http://${HOST}:${PORT}`);
  logger.system(`Storage directory: ${STORAGE_DIR}`);

  // Start services
  ffmpegManager.startWatchdog();
  scheduler.start();

  // Resume streams after boot
  await ffmpegManager.resumeOnBoot();

  logger.system('LiveStream Hub ready');
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.system(`Received ${signal}, shutting down...`);
  ffmpegManager.stopAll();
  scheduler.stop();
  wss.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (e) => logger.error('uncaughtException', e.stack || e.message));
process.on('unhandledRejection', (e) => logger.error('unhandledRejection', String(e)));
