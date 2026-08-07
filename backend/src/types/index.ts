export type Encoder = 'x264' | 'nvenc' | 'vaapi' | 'qsv';
export type Preset = 'ultrafast' | 'veryfast' | 'fast' | 'medium' | 'slow';
export type Destination = 'youtube' | 'rtmp';
export type VideoSource = 'single' | 'playlist';
export type StreamStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error' | 'crashed';
export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';
export type OverlayType = 'none' | 'image' | 'text' | 'timestamp';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
  last_login?: string;
}

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
  created_at: string;
  items_count?: number;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  video_id: string;
  position: number;
  video?: Video;
}

export interface Overlay {
  type: OverlayType;
  enabled: boolean;
  path?: string;
  text?: string;
  font_size?: number;
  color?: string;
  x?: string;
  y?: string;
  opacity?: number;
  scroll?: boolean;
}

export interface StreamProfile {
  id: string;
  name: string;
  destination: Destination;
  rtmp_url: string;
  stream_key: string;
  source_type: VideoSource;
  video_id?: string;
  playlist_id?: string;
  loop: boolean;
  repeat_forever: boolean;
  resolution: '480p' | '720p' | '1080p' | '1440p' | '2160p';
  custom_width?: number;
  custom_height?: number;
  fps: 24 | 30 | 60;
  video_bitrate: number;
  audio_bitrate: number;
  encoder: Encoder;
  preset: Preset;
  audio_codec: 'aac' | 'mp3' | 'copy';
  hls_preview: boolean;
  auto_restart: boolean;
  crossfade: number;
  volume_normalize: boolean;
  watermark?: Overlay;
  scroll_text?: Overlay;
  timestamp_overlay?: Overlay;
  created_at: string;
}

export interface ActiveStream {
  id: string;
  profile_id: string;
  profile?: StreamProfile;
  status: StreamStatus;
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

export interface Schedule {
  id: string;
  profile_id: string;
  profile?: StreamProfile;
  name: string;
  start_date: string;
  start_time: string;
  stop_time?: string;
  repeat: RepeatMode;
  days_of_week?: string;
  day_of_month?: number;
  auto_start: boolean;
  auto_stop: boolean;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  type: 'info' | 'warn' | 'error' | 'success' | 'stream' | 'upload' | 'system';
  message: string;
  details?: string;
  created_at: string;
}

export interface FFmpegLog {
  id: number;
  stream_id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id?: string;
  path: string;
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
  disk: { total: number; used: number; free: number; usagePercent: number; path: string };
  network: { rx_sec: number; tx_sec: number; iface: string };
  uptime: number;
  processCount: number;
  temperature?: number;
  timestamp: number;
}

export interface JwtPayload {
  id: number;
  username: string;
}
