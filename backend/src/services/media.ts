import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { getSettings } from '../utils/settings';
import { THUMBNAILS_DIR, VIDEOS_DIR } from '../db';

const execFileP = promisify(execFile);

export interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  format: string;
  size: number;
}

export async function probeVideo(filepath: string): Promise<ProbeResult> {
  const settings = getSettings();
  const args = [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filepath,
  ];

  try {
    const { stdout } = await execFileP(settings.ffprobe_path, args, { maxBuffer: 10 * 1024 * 1024 });
    const data = JSON.parse(stdout);
    const videoStream = (data.streams || []).find((s: any) => s.codec_type === 'video');
    const format = data.format || {};

    let fps = 0;
    if (videoStream?.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
      fps = den ? Math.round((num / den) * 100) / 100 : 0;
    }

    const stat = fs.statSync(filepath);
    return {
      duration: parseFloat(format.duration || '0'),
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      fps,
      codec: videoStream?.codec_name || 'unknown',
      format: (format.format_name || '').split(',')[0] || path.extname(filepath).slice(1),
      size: stat.size,
    };
  } catch (e) {
    // Fallback: size only
    const stat = fs.statSync(filepath);
    return { duration: 0, width: 0, height: 0, fps: 0, codec: 'unknown', format: path.extname(filepath).slice(1), size: stat.size };
  }
}

export async function generateThumbnail(videoId: string, filepath: string, duration: number): Promise<string | null> {
  const settings = getSettings();
  const outPath = path.join(THUMBNAILS_DIR, `${videoId}.jpg`);
  const seek = Math.min(Math.max(duration * 0.1, 1), 30);

  return new Promise((resolve) => {
    const args = [
      '-y', '-ss', String(seek), '-i', filepath,
      '-vframes', '1', '-vf', 'scale=640:-1', '-q:v', '3', outPath,
    ];
    const { execFile } = require('child_process');
    execFile(settings.ffmpeg_path, args, { timeout: 30000 }, (err: Error | null) => {
      if (err) {
        resolve(null);
      } else {
        resolve(`/thumbnails/${videoId}.jpg`);
      }
    });
  });
}

export function isVideoFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase().slice(1);
  return ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v', 'flv', 'ts', 'wmv'].includes(ext);
}

export async function validateFFmpeg(): Promise<{ ffmpeg: boolean; ffprobe: boolean; ffmpegVersion: string; ffprobeVersion: string; encoders: string[] }> {
  const settings = getSettings();
  const result = { ffmpeg: false, ffprobe: false, ffmpegVersion: '', ffprobeVersion: '', encoders: [] as string[] };

  try {
    const { stdout } = await execFileP(settings.ffmpeg_path, ['-version']);
    result.ffmpeg = true;
    result.ffmpegVersion = stdout.split('\n')[0];
  } catch { /* */ }

  try {
    const { stdout } = await execFileP(settings.ffprobe_path, ['-version']);
    result.ffprobe = true;
    result.ffprobeVersion = stdout.split('\n')[0];
  } catch { /* */ }

  try {
    const { stdout } = await execFileP(settings.ffmpeg_path, ['-encoders']);
    if (stdout.includes('h264_nvenc')) result.encoders.push('nvenc');
    if (stdout.includes('h264_vaapi')) result.encoders.push('vaapi');
    if (stdout.includes('h264_qsv')) result.encoders.push('qsv');
    result.encoders.push('x264');
  } catch { /* */ }

  return result;
}
