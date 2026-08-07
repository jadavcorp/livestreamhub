import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import db, { BACKUPS_DIR, DB_PATH, VIDEOS_DIR, THUMBNAILS_DIR } from '../db';
import { logger } from '../utils/logger';
import { formatBytes } from './system';

const execP = promisify(exec);

export interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  created_at: string;
  includes_videos: boolean;
  includes_thumbnails: boolean;
}

export async function createBackup(options: {
  includeVideos: boolean;
  includeThumbnails: boolean;
  includeDatabase: boolean;
  includeSettings: boolean;
}): Promise<BackupInfo> {
  const id = `backup-${Date.now()}`;
  const tmpDir = path.join(BACKUPS_DIR, id);
  fs.mkdirSync(tmpDir, { recursive: true });

  logger.system('Creating backup', id);

  // Database backup - copy the SQLite file
  if (options.includeDatabase) {
    try {
      // Use better-sqlite3 online backup API (synchronous)
      await db.backup(path.join(tmpDir, 'livestream-hub.db'));
    } catch (e) {
      // Fallback: copy file
      try { fs.copyFileSync(DB_PATH, path.join(tmpDir, 'livestream-hub.db')); } catch { /* ignore */ }
    }
  }

  // Settings export
  if (options.includeSettings) {
    const settings = db.prepare('SELECT key, value FROM settings').all();
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify(settings, null, 2));
  }

  // Copy videos (symlink + tar will include)
  if (options.includeVideos && fs.existsSync(VIDEOS_DIR)) {
    // We'll tar them directly
  }
  if (options.includeThumbnails && fs.existsSync(THUMBNAILS_DIR)) {
    // tarred directly
  }

  const tarPath = path.join(BACKUPS_DIR, `${id}.tar.gz`);
  const tarTargets = [tmpDir];
  if (options.includeVideos) tarTargets.push(VIDEOS_DIR);
  if (options.includeThumbnails) tarTargets.push(THUMBNAILS_DIR);

  // Create tar.gz
  await execP(
    `tar -czf "${tarPath}" -C / "${tarTargets.map((t) => path.relative('/', t)).join('" "')}" 2>/dev/null || true`,
    { maxBuffer: 1024 * 1024 * 500 }
  );

  // Cleanup tmp
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }

  const stat = fs.statSync(tarPath);
  const info: BackupInfo = {
    id,
    filename: path.basename(tarPath),
    size: stat.size,
    created_at: new Date().toISOString(),
    includes_videos: options.includeVideos,
    includes_thumbnails: options.includeThumbnails,
  };

  logger.success('Backup created', `${info.filename} (${formatBytes(info.size)})`);
  return info;
}

export function listBackups(): BackupInfo[] {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  return fs.readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.tar.gz'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUPS_DIR, f));
      return {
        id: f.replace('.tar.gz', ''),
        filename: f,
        size: stat.size,
        created_at: stat.mtime.toISOString(),
        includes_videos: true,
        includes_thumbnails: true,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function restoreBackup(filename: string): Promise<void> {
  const tarPath = path.join(BACKUPS_DIR, filename);
  if (!fs.existsSync(tarPath)) throw new Error('Backup not found');

  logger.warn('Restoring backup', filename);
  // Extract to root
  await execP(`tar -xzf "${tarPath}" -C /`, { maxBuffer: 1024 * 1024 * 500 });
  logger.success('Backup restored. Restart may be required.');
}

export function deleteBackup(filename: string): void {
  const p = path.join(BACKUPS_DIR, filename);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
