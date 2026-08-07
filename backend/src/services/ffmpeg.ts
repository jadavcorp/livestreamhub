import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import db from '../db';
import { HLS_DIR, LOGS_DIR } from '../db';
import { ActiveStream, StreamProfile, Video } from '../types';
import { getSettings } from '../utils/settings';
import { logger } from '../utils/logger';

interface StreamHandle {
  active: ActiveStream;
  profile: StreamProfile;
  videos: Video[];
  currentIndex: number;
  process: ChildProcess | null;
  ffmpegArgs: string[];
  hlsPath: string;
  stopRequested: boolean;
  stats: {
    bitrate: number;
    fps: number;
    frame: number;
    dropped: number;
    resolution: string;
    lastStatsAt: number;
  };
}

class FFmpegManager extends EventEmitter {
  private streams = new Map<string, StreamHandle>();
  private watchdogTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  startWatchdog() {
    if (this.watchdogTimer) return;
    this.watchdogTimer = setInterval(() => this.checkHealth(), 10000);
    logger.system('Watchdog started', 'Monitoring FFmpeg processes every 10s');
  }

  stopWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private checkHealth() {
    for (const [id, handle] of this.streams) {
      if (handle.active.status === 'running' && handle.process && handle.process.exitCode !== null) {
        // Process died unexpectedly
        logger.stream(`Stream ${handle.profile.name} process exited with code ${handle.process.exitCode}`, handle.active.id);
        if (!handle.stopRequested && handle.profile.auto_restart) {
          this.restart(id).catch((e) => logger.error('Auto-restart failed', String(e)));
        } else {
          handle.active.status = 'crashed';
          handle.active.last_error = `FFmpeg exited with code ${handle.process.exitCode}`;
          this.emit('status', handle.active);
        }
      }
    }
  }

  getActiveStreams(): ActiveStream[] {
    return Array.from(this.streams.values()).map((h) => ({ ...h.active }));
  }

  getActiveStream(id: string): ActiveStream | undefined {
    const h = this.streams.get(id);
    return h ? { ...h.active } : undefined;
  }

  async start(profile: StreamProfile): Promise<ActiveStream> {
    if (this.streams.has(profile.id)) {
      throw new Error('Stream already running for this profile');
    }

    // Gather source videos
    let videos: Video[] = [];
    if (profile.source_type === 'single' && profile.video_id) {
      const v = db.prepare('SELECT * FROM videos WHERE id = ?').get(profile.video_id) as Video | undefined;
      if (!v) throw new Error('Source video not found');
      videos = [v];
    } else if (profile.source_type === 'playlist' && profile.playlist_id) {
      const rows = db.prepare(`
        SELECT v.* FROM playlist_items pi
        JOIN videos v ON v.id = pi.video_id
        WHERE pi.playlist_id = ?
        ORDER BY pi.position ASC
      `).all(profile.playlist_id) as Video[];
      if (rows.length === 0) throw new Error('Playlist is empty');
      videos = rows;
    } else {
      throw new Error('No video source configured');
    }

    const hlsPath = path.join(HLS_DIR, profile.id);
    if (profile.hls_preview) {
      fs.mkdirSync(hlsPath, { recursive: true });
    }

    const active: ActiveStream = {
      id: profile.id,
      profile_id: profile.id,
      profile,
      status: 'starting',
      current_bitrate: 0,
      current_fps: 0,
      current_resolution: this.resolutionLabel(profile.resolution, profile.custom_width, profile.custom_height),
      dropped_frames: 0,
      elapsed: 0,
      current_video_index: 0,
      current_video_title: videos[0]?.title,
      hls_url: profile.hls_preview ? `/hls/${profile.id}/index.m3u8` : undefined,
      restart_count: 0,
    };

    const handle: StreamHandle = {
      active,
      profile,
      videos,
      currentIndex: 0,
      process: null,
      ffmpegArgs: [],
      hlsPath,
      stopRequested: false,
      stats: { bitrate: 0, fps: 0, frame: 0, dropped: 0, resolution: active.current_resolution, lastStatsAt: Date.now() },
    };

    this.streams.set(profile.id, handle);
    this.emit('status', active);

    await this.playCurrent(handle);
    return active;
  }

  private buildArgs(handle: StreamHandle, video: Video): string[] {
    const { profile } = handle;
    const settings = getSettings();
    const ffmpegPath = profile.encoder;
    const args: string[] = ['-hide_banner', '-loglevel', 'info', '-stats'];

    // Input
    args.push('-re', '-i', video.filepath);

    // Video encoding
    const [w, h] = this.resolutionDimensions(profile.resolution, profile.custom_width, profile.custom_height);
    const useHw = profile.encoder !== 'x264';

    let vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${profile.fps},format=yuv420p`;

    // Overlays
    if (profile.watermark?.enabled && profile.watermark.path) {
      args.push('-i', profile.watermark.path);
      const opacity = profile.watermark.opacity ?? 0.8;
      const x = profile.watermark.x || 'main_w-overlay_w-20';
      const y = profile.watermark.y || '20';
      vf += `;[1:v]format=rgba,colorchannelmixer=aa=${opacity}[wm];[0:v][wm]overlay=${x}:${y}`;
    }
    if (profile.scroll_text?.enabled && profile.scroll_text.text) {
      const text = profile.scroll_text.text.replace(/'/g, "\\'").replace(/:/g, '\\:');
      const fontSize = profile.scroll_text.font_size || 24;
      const color = profile.scroll_text.color || 'white';
      if (profile.scroll_text.scroll) {
        vf += `;drawtext=text='${text}':fontcolor=${color}:fontsize=${fontSize}:x=w-mod(max(t*100\\,0)\\,(w+text_w)):y=h-line_h-30:borderw=2:bordercolor=black`;
      } else {
        const x = profile.scroll_text.x || '(w-text_w)/2';
        const y = profile.scroll_text.y || 'h-line_h-30';
        vf += `;drawtext=text='${text}':fontcolor=${color}:fontsize=${fontSize}:x=${x}:y=${y}:borderw=2:bordercolor=black`;
      }
    }
    if (profile.timestamp_overlay?.enabled) {
      vf += `;drawtext=text='%{localtime\\:%Y-%m-%d %H\\\\:%M\\\\:%S}':fontcolor=white:fontsize=20:x=10:y=10:box=1:boxcolor=black@0.5`;
    }

    args.push('-vf', vf);

    // Encoder selection
    if (profile.encoder === 'nvenc') {
      args.push('-c:v', 'h264_nvenc', '-preset', 'p4', '-b:v', `${profile.video_bitrate}k`, '-maxrate', `${profile.video_bitrate * 1.5}k`, '-bufsize', `${profile.video_bitrate * 2}k`, '-g', String(profile.fps * 2), '-pix_fmt', 'yuv420p');
    } else if (profile.encoder === 'vaapi') {
      args.push('-vaapi_device', '/dev/dri/renderD128', '-c:v', 'h264_vaapi', '-b:v', `${profile.video_bitrate}k`, '-maxrate', `${profile.video_bitrate * 1.5}k`, '-g', String(profile.fps * 2));
    } else if (profile.encoder === 'qsv') {
      args.push('-c:v', 'h264_qsv', '-preset', profile.preset, '-b:v', `${profile.video_bitrate}k`, '-maxrate', `${profile.video_bitrate * 1.5}k`, '-g', String(profile.fps * 2));
    } else {
      args.push('-c:v', 'libx264', '-preset', profile.preset, '-b:v', `${profile.video_bitrate}k`, '-maxrate', `${profile.video_bitrate * 1.5}k`, '-bufsize', `${profile.video_bitrate * 2}k`, '-g', String(profile.fps * 2), '-pix_fmt', 'yuv420p', '-profile:v', 'main');
    }

    // Audio
    if (profile.audio_codec === 'copy') {
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', profile.audio_codec === 'mp3' ? 'libmp3lame' : 'aac', '-b:a', `${profile.audio_bitrate}k`, '-ar', '44100', '-ac', '2');
    }

    if (profile.volume_normalize) {
      // Insert loudnorm audio filter (simplified)
      args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
    }

    // HLS preview output (tee to RTMP + HLS)
    const rtmpDest = `${profile.rtmp_url}/${profile.stream_key}`;
    if (profile.hls_preview) {
      const hlsFile = path.join(handle.hlsPath, 'index.m3u8');
      args.push(
        '-f', 'tee',
        '-map', '0:v:0', '-map', '0:a:0?',
        `-f flv:${rtmpDest}|hls_segment_filename=${path.join(handle.hlsPath, 'seg_%05d.ts')}:hls_time=2:hls_list_size=6:hls_flags=delete_segments+append_list ${hlsFile}`
      );
    } else {
      args.push('-f', 'flv', rtmpDest);
    }

    args.push('-y');
    return args;
  }

  private async playCurrent(handle: StreamHandle) {
    if (handle.stopRequested) return;
    if (handle.currentIndex >= handle.videos.length) {
      if (handle.profile.loop || handle.profile.repeat_forever) {
        // Shuffle if configured
        if (handle.profile.source_type === 'playlist') {
          const pl = db.prepare('SELECT shuffle FROM playlists WHERE id = ?').get(handle.profile.playlist_id!) as any;
          if (pl?.shuffle) {
            handle.videos = this.shuffle([...handle.videos]);
          }
        }
        handle.currentIndex = 0;
      } else {
        // End of playlist - stop
        this.stop(handle.profile.id).catch(() => {});
        return;
      }
    }

    const video = handle.videos[handle.currentIndex];
    handle.active.current_video_index = handle.currentIndex;
    handle.active.current_video_title = video.title;
    handle.active.status = 'running';
    handle.active.started_at = handle.active.started_at || new Date().toISOString();

    const settings = getSettings();
    const args = this.buildArgs(handle, video);
    handle.ffmpegArgs = args;

    logger.ffmpeg(handle.profile.id, 'info', `Starting FFmpeg for video: ${video.title}`);
    logger.ffmpeg(handle.profile.id, 'info', `Command: ${settings.ffmpeg_path} ${args.join(' ')}`);
    logger.stream(`Streaming "${video.title}" to ${handle.profile.name}`);

    const proc = spawn(settings.ffmpeg_path, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    handle.process = proc;
    handle.active.pid = proc.pid;
    this.emit('status', handle.active);

    let stderrBuf = '';
    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderrBuf += text;
      const lines = stderrBuf.split('\n');
      stderrBuf = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) this.parseFFmpegStats(handle, line);
      }
    });

    proc.stdout.on('data', () => { /* consume */ });

    proc.on('close', (code, signal) => {
      logger.ffmpeg(handle.profile.id, code === 0 ? 'info' : 'warn', `FFmpeg exited code=${code} signal=${signal}`);
      if (handle.stopRequested) return;

      // Move to next video if clean exit
      if (code === 0 || signal === null) {
        handle.currentIndex++;
        this.playCurrent(handle).catch((e) => {
          logger.error('Error playing next video', String(e));
        });
      } else {
        // Crashed
        if (handle.profile.auto_restart && !handle.stopRequested) {
          handle.active.restart_count++;
          logger.stream(`Restarting stream (attempt ${handle.active.restart_count})`);
          setTimeout(() => this.playCurrent(handle), 3000);
        } else {
          handle.active.status = 'crashed';
          handle.active.last_error = `FFmpeg exited with code ${code}`;
          this.emit('status', handle.active);
        }
      }
    });

    proc.on('error', (err) => {
      logger.ffmpeg(handle.profile.id, 'error', `FFmpeg spawn error: ${err.message}`);
      handle.active.status = 'error';
      handle.active.last_error = err.message;
      this.emit('status', handle.active);
    });
  }

  private parseFFmpegStats(handle: StreamHandle, line: string) {
    // Parse bitrate/fps/frame from FFmpeg stats line e.g.:
    // frame=  123 fps= 30 q=23.0 size=    1024kB time=00:00:04.10 bitrate=2048.5kbits/s speed=1x
    const frameMatch = line.match(/frame=\s*(\d+)/);
    const fpsMatch = line.match(/fps=\s*([\d.]+)/);
    const bitrateMatch = line.match(/bitrate=\s*([\d.]+)kbits\/s/);
    const droppedMatch = line.match(/drop_frames=\s*(\d+)/);

    let updated = false;
    if (frameMatch) { handle.stats.frame = parseInt(frameMatch[1], 10); updated = true; }
    if (fpsMatch) { handle.stats.fps = parseFloat(fpsMatch[1]); handle.active.current_fps = handle.stats.fps; updated = true; }
    if (bitrateMatch) { handle.stats.bitrate = parseFloat(bitrateMatch[1]); handle.active.current_bitrate = handle.stats.bitrate; updated = true; }
    if (droppedMatch) { handle.stats.dropped = parseInt(droppedMatch[1], 10); handle.active.dropped_frames = handle.stats.dropped; updated = true; }

    // Log non-stats lines
    if (!line.includes('frame=') && !line.includes('Press [q]') && !line.includes('configuration:')) {
      const lower = line.toLowerCase();
      const level: 'info' | 'warn' | 'error' = lower.includes('error') ? 'error' : lower.includes('warning') ? 'warn' : 'info';
      logger.ffmpeg(handle.profile.id, level, line.trim().slice(0, 500));
    }

    if (updated) this.emit('stats', handle.active);
  }

  async stop(id: string): Promise<void> {
    const handle = this.streams.get(id);
    if (!handle) return;
    handle.stopRequested = true;
    handle.active.status = 'stopping';
    this.emit('status', handle.active);

    if (handle.process && handle.process.exitCode === null) {
      // Graceful stop - send 'q' via stdin if available, otherwise SIGTERM
      try {
        handle.process.kill('SIGINT');
      } catch { /* ignore */ }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (handle.process && handle.process.exitCode === null) {
        handle.process.kill('SIGKILL');
      }
    }

    // Clean up HLS
    if (handle.profile.hls_preview && fs.existsSync(handle.hlsPath)) {
      try {
        for (const f of fs.readdirSync(handle.hlsPath)) {
          if (f.endsWith('.ts') || f.endsWith('.m3u8')) {
            fs.unlinkSync(path.join(handle.hlsPath, f));
          }
        }
      } catch { /* ignore */ }
    }

    handle.active.status = 'idle';
    this.streams.delete(id);
    this.emit('status', handle.active);
    this.emit('stopped', id);
    logger.stream(`Stream "${handle.profile.name}" stopped`);
  }

  async restart(id: string): Promise<ActiveStream | undefined> {
    const handle = this.streams.get(id);
    if (!handle) return;
    const profile = handle.profile;
    await this.stop(id);
    await new Promise((r) => setTimeout(r, 1500));
    return this.start(profile);
  }

  async resumeOnBoot(): Promise<void> {
    // Resume streams that were running before reboot (profiles with auto_restart and a marker)
    const marker = path.join(LOGS_DIR, 'running-streams.json');
    if (!fs.existsSync(marker)) return;
    try {
      const ids = JSON.parse(fs.readFileSync(marker, 'utf-8')) as string[];
      const settings = getSettings();
      if (!process.env.AUTO_RESUME_ON_BOOT || process.env.AUTO_RESUME_ON_BOOT === 'false') return;
      for (const id of ids) {
        const profile = db.prepare('SELECT * FROM stream_profiles WHERE id = ?').get(id) as StreamProfile | undefined;
        if (profile) {
          logger.system(`Resuming stream after boot: ${profile.name}`);
          try { await this.start(profile); } catch (e) { logger.error('Resume failed', String(e)); }
        }
      }
    } catch { /* ignore */ }
    finally { try { fs.unlinkSync(marker); } catch { /* ignore */ } }
  }

  saveRunningMarker(): void {
    const ids = Array.from(this.streams.values())
      .filter((h) => h.active.status === 'running' || h.active.status === 'starting')
      .map((h) => h.profile.id);
    try {
      fs.writeFileSync(path.join(LOGS_DIR, 'running-streams.json'), JSON.stringify(ids));
    } catch { /* ignore */ }
  }

  private resolutionDimensions(res: string, cw?: number, ch?: number): [number, number] {
    switch (res) {
      case '480p': return [854, 480];
      case '720p': return [1280, 720];
      case '1080p': return [1920, 1080];
      case '1440p': return [2560, 1440];
      case '2160p': return [3840, 2160];
      case 'custom': return [cw || 1280, ch || 720];
      default: return [1280, 720];
    }
  }

  private resolutionLabel(res: string, cw?: number, ch?: number): string {
    if (res === 'custom' && cw && ch) return `${cw}x${ch}`;
    const [w, h] = this.resolutionDimensions(res, cw, ch);
    return `${w}x${h}`;
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  stopAll() {
    for (const id of Array.from(this.streams.keys())) {
      this.stop(id).catch(() => {});
    }
    this.saveRunningMarker();
  }
}

export const ffmpegManager = new FFmpegManager();
