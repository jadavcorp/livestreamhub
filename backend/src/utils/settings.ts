import db from '../db';
import { Settings } from '../types';

export function getSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  rows.forEach((r) => { map[r.key] = r.value; });

  return {
    default_bitrate: parseInt(map.default_bitrate || '2500', 10),
    default_resolution: map.default_resolution || '720p',
    default_fps: parseInt(map.default_fps || '30', 10),
    default_encoder: map.default_encoder || 'x264',
    default_preset: map.default_preset || 'veryfast',
    upload_folder: map.upload_folder || './storage/videos',
    backup_folder: map.backup_folder || './storage/backups',
    ffmpeg_path: map.ffmpeg_path || '/usr/bin/ffmpeg',
    ffprobe_path: map.ffprobe_path || '/usr/bin/ffprobe',
    timezone: map.timezone || 'UTC',
    auto_update: map.auto_update === 'true',
    hls_enabled: map.hls_enabled !== 'false',
    watchdog_enabled: map.watchdog_enabled !== 'false',
    notifications_enabled: map.notifications_enabled !== 'false',
    volume_normalization: map.volume_normalization === 'true',
    crossfade_duration: parseFloat(map.crossfade_duration || '0'),
  };
}

export function updateSetting(key: string, value: string | number | boolean): void {
  const v = typeof value === 'string' ? value : String(value);
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, v);
}

export function updateSettings(partial: Partial<Settings>): void {
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) updateSetting(key, value);
  }
}
