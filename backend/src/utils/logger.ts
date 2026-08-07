import db from '../db';
import { LOGS_DIR } from '../db';
import fs from 'fs';
import path from 'path';
import { ActivityLog, FFmpegLog } from '../types';

type Level = 'info' | 'warn' | 'error' | 'debug' | 'success' | 'stream' | 'upload' | 'system';

const logFile = path.join(LOGS_DIR, 'app.log');

function writeFileLog(level: string, message: string) {
  try {
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
    fs.appendFileSync(logFile, line);
    // Rotate if > 10MB
    try {
      const stat = fs.statSync(logFile);
      if (stat.size > 10 * 1024 * 1024) {
        fs.renameSync(logFile, logFile + '.1');
      }
    } catch { /* ignore */ }
  } catch { /* ignore */ }
}

export const logger = {
  info: (msg: string, details?: string) => log('info', msg, details),
  warn: (msg: string, details?: string) => log('warn', msg, details),
  error: (msg: string, details?: string) => log('error', msg, details),
  success: (msg: string, details?: string) => log('success', msg, details),
  stream: (msg: string, details?: string) => log('stream', msg, details),
  upload: (msg: string, details?: string) => log('upload', msg, details),
  system: (msg: string, details?: string) => log('system', msg, details),
  ffmpeg: (streamId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string) => {
    try {
      db.prepare('INSERT INTO ffmpeg_logs (stream_id, level, message) VALUES (?, ?, ?)').run(
        streamId, level, message.slice(0, 2000)
      );
      writeFileLog(`ffmpeg:${streamId}`, `[${level}] ${message}`);
    } catch { /* ignore */ }
  },
};

function log(level: Level, message: string, details?: string) {
  const timestamp = new Date().toISOString();
  const consoleMsg = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (level === 'error') console.error(consoleMsg);
  else if (level === 'warn') console.warn(consoleMsg);
  else console.log(consoleMsg);

  writeFileLog(level, message + (details ? ` | ${details}` : ''));

  try {
    db.prepare(
      'INSERT INTO activity_logs (type, message, details) VALUES (?, ?, ?)'
    ).run(level, message.slice(0, 1000), details ? details.slice(0, 4000) : null);
    // Keep last 5000 activity logs
    db.prepare('DELETE FROM activity_logs WHERE id NOT IN (SELECT id FROM activity_logs ORDER BY id DESC LIMIT 5000)').run();
  } catch { /* ignore */ }
}

export function getActivityLogs(limit = 100, offset = 0, type?: string): ActivityLog[] {
  if (type) {
    return db.prepare('SELECT * FROM activity_logs WHERE type = ? ORDER BY id DESC LIMIT ? OFFSET ?').all(type, limit, offset) as ActivityLog[];
  }
  return db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset) as ActivityLog[];
}

export function getFFmpegLogs(streamId: string, limit = 500, offset = 0, search?: string): FFmpegLog[] {
  if (search) {
    return db.prepare(
      'SELECT * FROM ffmpeg_logs WHERE stream_id = ? AND message LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(streamId, `%${search}%`, limit, offset) as FFmpegLog[];
  }
  return db.prepare(
    'SELECT * FROM ffmpeg_logs WHERE stream_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'
  ).all(streamId, limit, offset) as FFmpegLog[];
}

export function clearFFmpegLogs(streamId?: string): void {
  if (streamId) db.prepare('DELETE FROM ffmpeg_logs WHERE stream_id = ?').run(streamId);
  else db.prepare('DELETE FROM ffmpeg_logs').run();
}

export function clearActivityLogs(): void {
  db.prepare('DELETE FROM activity_logs').run();
}
