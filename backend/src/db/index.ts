import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// __dirname is available under CommonJS
const projectRoot = path.resolve(__dirname, '../..');

export const STORAGE_DIR = process.env.STORAGE_DIR || path.join(projectRoot, 'storage');
export const VIDEOS_DIR = process.env.VIDEOS_DIR || path.join(STORAGE_DIR, 'videos');
export const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR || path.join(STORAGE_DIR, 'thumbnails');
export const HLS_DIR = process.env.HLS_DIR || path.join(STORAGE_DIR, 'hls');
export const BACKUPS_DIR = process.env.BACKUPS_DIR || path.join(STORAGE_DIR, 'backups');
export const LOGS_DIR = process.env.LOGS_DIR || path.join(STORAGE_DIR, 'logs');
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(STORAGE_DIR, 'uploads');
export const DB_PATH = process.env.SQLITE_PATH || path.join(STORAGE_DIR, 'livestream-hub.db');

[STORAGE_DIR, VIDEOS_DIR, THUMBNAILS_DIR, HLS_DIR, BACKUPS_DIR, LOGS_DIR, UPLOADS_DIR].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      thumbnail_path TEXT,
      duration REAL DEFAULT 0,
      size INTEGER DEFAULT 0,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      fps REAL DEFAULT 0,
      codec TEXT,
      format TEXT,
      folder_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      thumbnail_path TEXT,
      shuffle INTEGER DEFAULT 0,
      repeat INTEGER DEFAULT 1,
      loop_forever INTEGER DEFAULT 1,
      duration REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlist_items (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stream_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      destination TEXT NOT NULL,
      rtmp_url TEXT NOT NULL,
      stream_key TEXT NOT NULL,
      source_type TEXT NOT NULL,
      video_id TEXT,
      playlist_id TEXT,
      loop INTEGER DEFAULT 1,
      repeat_forever INTEGER DEFAULT 1,
      resolution TEXT DEFAULT '720p',
      custom_width INTEGER,
      custom_height INTEGER,
      fps INTEGER DEFAULT 30,
      video_bitrate INTEGER DEFAULT 2500,
      audio_bitrate INTEGER DEFAULT 128,
      encoder TEXT DEFAULT 'x264',
      preset TEXT DEFAULT 'veryfast',
      audio_codec TEXT DEFAULT 'aac',
      hls_preview INTEGER DEFAULT 1,
      auto_restart INTEGER DEFAULT 1,
      crossfade REAL DEFAULT 0,
      volume_normalize INTEGER DEFAULT 0,
      watermark TEXT,
      scroll_text TEXT,
      timestamp_overlay TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      stop_time TEXT,
      repeat TEXT DEFAULT 'none',
      days_of_week TEXT,
      day_of_month INTEGER,
      auto_start INTEGER DEFAULT 1,
      auto_stop INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      last_run TEXT,
      next_run TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (profile_id) REFERENCES stream_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT DEFAULT 'info',
      message TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ffmpeg_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id TEXT NOT NULL,
      level TEXT DEFAULT 'info',
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_videos_folder ON videos(folder_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_items_video ON playlist_items(video_id);
    CREATE INDEX IF NOT EXISTS idx_ffmpeg_logs_stream ON ffmpeg_logs(stream_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
  `);

  // Seed default settings
  const defaultSettings: Record<string, string> = {
    default_bitrate: '2500',
    default_resolution: '720p',
    default_fps: '30',
    default_encoder: 'x264',
    default_preset: 'veryfast',
    upload_folder: VIDEOS_DIR,
    backup_folder: BACKUPS_DIR,
    ffmpeg_path: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
    ffprobe_path: process.env.FFPROBE_PATH || '/usr/bin/ffprobe',
    timezone: 'UTC',
    auto_update: 'false',
    hls_enabled: 'true',
    watchdog_enabled: 'true',
    notifications_enabled: 'true',
    volume_normalization: 'false',
    crossfade_duration: '0',
  };

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }

  // Seed admin user if none exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`[db] Created default admin user: ${username} (change password immediately)`);
  }

  // Seed root folder
  const folderCount = db.prepare('SELECT COUNT(*) as count FROM folders').get() as { count: number };
  if (folderCount.count === 0) {
    db.prepare('INSERT INTO folders (id, name, parent_id, path) VALUES (?, ?, NULL, ?)').run(
      uuid(),
      'Videos',
      VIDEOS_DIR
    );
  }
}

init();

export default db;
