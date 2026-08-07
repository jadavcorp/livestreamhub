'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { ToastContainer, toast } from '@/components/Toast';
import { apiClient } from '@/lib/api';
import { Settings as SettingsType } from '@/lib/types';

export default function SettingsPage() {
  const { data, mutate } = useSWR<{ settings: SettingsType }>('/api/settings', apiClient.fetcher);
  const [s, setS] = useState<SettingsType | null>(null);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => { if (data?.settings) setS(data.settings); }, [data]);

  const save = async () => {
    if (!s) return;
    await apiClient.put('/api/settings', s);
    toast('Settings saved', 'success');
    mutate();
  };

  const changePassword = async () => {
    if (pw.next !== pw.confirm) { toast('Passwords do not match', 'error'); return; }
    if (pw.next.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    try {
      await apiClient.post('/api/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      toast('Password changed', 'success');
      setPw({ current: '', next: '', confirm: '' });
    } catch (e: any) { toast(e.message, 'error'); }
  };

  if (!s) return <AppShell><div className="text-gray-500">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-500 text-sm">Configure defaults, paths and security</p>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Streaming Defaults</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Default Bitrate (kbps)</label><input type="number" className="input" value={s.default_bitrate} onChange={(e) => setS({ ...s, default_bitrate: +e.target.value })} /></div>
            <div><label className="label">Default Resolution</label>
              <select className="input" value={s.default_resolution} onChange={(e) => setS({ ...s, default_resolution: e.target.value })}>
                {['480p', '720p', '1080p', '1440p', '2160p'].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div><label className="label">Default FPS</label>
              <select className="input" value={s.default_fps} onChange={(e) => setS({ ...s, default_fps: +e.target.value })}>{[24, 30, 60].map((f) => <option key={f} value={f}>{f}</option>)}</select>
            </div>
            <div><label className="label">Default Encoder</label>
              <select className="input" value={s.default_encoder} onChange={(e) => setS({ ...s, default_encoder: e.target.value })}>
                {['x264', 'nvenc', 'vaapi', 'qsv'].map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div><label className="label">Default Preset</label>
              <select className="input" value={s.default_preset} onChange={(e) => setS({ ...s, default_preset: e.target.value })}>
                {['ultrafast', 'veryfast', 'fast', 'medium', 'slow'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Timezone</label><input className="input" value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} /></div>
          </div>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={s.hls_enabled} onChange={(e) => setS({ ...s, hls_enabled: e.target.checked })} /> HLS Preview</label>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={s.watchdog_enabled} onChange={(e) => setS({ ...s, watchdog_enabled: e.target.checked })} /> Watchdog</label>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={s.notifications_enabled} onChange={(e) => setS({ ...s, notifications_enabled: e.target.checked })} /> Notifications</label>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={s.volume_normalization} onChange={(e) => setS({ ...s, volume_normalization: e.target.checked })} /> Volume Normalize</label>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Paths</h3>
          <div><label className="label">Upload Folder</label><input className="input font-mono text-xs" value={s.upload_folder} onChange={(e) => setS({ ...s, upload_folder: e.target.value })} /></div>
          <div><label className="label">Backup Folder</label><input className="input font-mono text-xs" value={s.backup_folder} onChange={(e) => setS({ ...s, backup_folder: e.target.value })} /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">FFmpeg Path</label><input className="input font-mono text-xs" value={s.ffmpeg_path} onChange={(e) => setS({ ...s, ffmpeg_path: e.target.value })} /></div>
            <div><label className="label">FFprobe Path</label><input className="input font-mono text-xs" value={s.ffprobe_path} onChange={(e) => setS({ ...s, ffprobe_path: e.target.value })} /></div>
          </div>
          <button onClick={save} className="btn-primary">Save Settings</button>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Change Password</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="label">Current</label><input type="password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
            <div><label className="label">New</label><input type="password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
            <div><label className="label">Confirm</label><input type="password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          </div>
          <button onClick={changePassword} className="btn-secondary">Update Password</button>
        </div>
      </div>
      <ToastContainer />
    </AppShell>
  );
}
