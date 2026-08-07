export interface Video {
  id: string;
  title: string;
  original_name: string;
  filename: string;
  filepath: string;
  thumbnail_path?: string;
  duration: number;
  size: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  format: string;
  folder_id?: string;
  created_at: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  thumbnail_path?: string;
  shuffle: boolean;
  repeat: boolean;
  loop_forever: boolean;
  duration: number;
  items_count: number;
  created_at: string;
}

export interface StreamProfile {
  id: string;
  name: string;
  destination: 'youtube' | 'rtmp';
  rtmp_url: string;
  stream_key: string;
  source_type: 'single' | 'playlist';
  video_id?: string;
  playlist_id?: string;
  loop: boolean;
  repeat_forever: boolean;
  resolution: string;
  fps: number;
  video_bitrate: number;
  audio_bitrate: number;
  encoder: string;
  preset: string;
  audio_codec?: string;
  hls_preview: boolean;
  auto_restart: boolean;
  volume_normalize?: boolean;
  crossfade?: number;
  created_at: string;
}

export interface ActiveStream {
  id: string;
  profile_id: string;
  profile?: StreamProfile;
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'error' | 'crashed';
  pid?: number;
  started_at?: string;
  current_bitrate: number;
  current_fps: number;
  current_resolution: string;
  dropped_frames: number;
  elapsed: number;
  current_video_index: number;
  current_video_title?: string;
  hls_url?: string;
  last_error?: string;
  restart_count: number;
}

export interface DashboardStats {
  totalVideos: number;
  totalPlaylists: number;
  runningStreams: number;
  stoppedStreams: number;
  activeStreams: ActiveStream[];
  cpu: { usage: number; cores: number; model: string; loadAvg: number[] };
  memory: { total: number; used: number; free: number; usagePercent: number };
  disk: { total: number; used: number; free: number; usagePercent: number };
  network: { rx_sec: number; tx_sec: number };
  uptime: number;
  currentBitrate: number;
  currentFps: number;
  currentResolution: string;
  recentActivity: ActivityLog[];
}

export interface ActivityLog {
  id: number;
  type: string;
  message: string;
  details?: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  profile_id: string;
  profile_name?: string;
  name: string;
  start_date: string;
  start_time: string;
  stop_time?: string;
  repeat: string;
  auto_start: boolean;
  auto_stop: boolean;
  enabled: boolean;
  next_run?: string;
  created_at: string;
}

export interface Settings {
  default_bitrate: number;
  default_resolution: string;
  default_fps: number;
  default_encoder: string;
  default_preset: string;
  upload_folder: string;
  backup_folder: string;
  ffmpeg_path: string;
  ffprobe_path: string;
  timezone: string;
  auto_update: boolean;
  hls_enabled: boolean;
  watchdog_enabled: boolean;
  notifications_enabled: boolean;
  volume_normalization: boolean;
  crossfade_duration: number;
}

export interface SystemStats {
  cpu: { usage: number; cores: number; model: string; loadAvg: number[] };
  mem: { total: number; used: number; free: number; usagePercent: number };
  disk: { total: number; used: number; free: number; usagePercent: number };
  network: { rx_sec: number; tx_sec: number };
  uptime: number;
  processCount: number;
  temperature?: number;
}

export interface FFmpegInfo {
  ffmpeg: boolean;
  ffprobe: boolean;
  ffmpegVersion: string;
  ffprobeVersion: string;
  encoders: string[];
}
