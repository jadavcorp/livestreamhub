'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { ToastContainer, toast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { apiClient } from '@/lib/api';
import { StreamProfile, ActiveStream, Video, Playlist } from '@/lib/types';

const RESOLUTIONS = [
  { v: '480p', label: '480p (854×480)' },
  { v: '720p', label: '720p (1280×720)' },
  { v: '1080p', label: '1080p (1920×1080)' },
  { v: '1440p', label: '1440p (2560×1440)' },
  { v: '2160p', label: '4K (3840×2160)' },
];
const FPS = [24, 30, 60];
const BITRATES = [1000, 2500, 4500, 6000, 8000];
const AUDIO_BITRATES = [128, 192, 256, 320];
const ENCODERS = [
  { v: 'x264', label: 'x264 (CPU, universal)' },
  { v: 'nvenc', label: 'NVENC (NVIDIA GPU)' },
  { v: 'vaapi', label: 'VAAPI (Intel/AMD GPU)' },
  { v: 'qsv', label: 'QSV (Intel Quick Sync)' },
];
const PRESETS = ['ultrafast', 'veryfast', 'fast', 'medium', 'slow'];

const EMPTY: Partial<StreamProfile> = {
  name: '', destination: 'youtube', rtmp_url: 'rtmp://a.rtmp.youtube.com/live2', stream_key: '',
  source_type: 'playlist', resolution: '720p', fps: 30, video_bitrate: 2500, audio_bitrate: 128,
  encoder: 'x264', preset: 'veryfast', audio_codec: 'aac', hls_preview: true, auto_restart: true,
  loop: true, repeat_forever: true, volume_normalize: false,
};

export default function StreamsPage() {
  const { data: pData, mutate: refetchProfiles } = useSWR<{ profiles: StreamProfile[] }>('/api/streams/profiles', apiClient.fetcher);
  const { data: aData, mutate: refetchActive } = useSWR<{ streams: ActiveStream[] }>('/api/streams/active', apiClient.fetcher, { refreshInterval: 3000 });
  const { data: vidData } = useSWR<{ videos: Video[] }>('/api/videos?limit=500', apiClient.fetcher);
  const { data: plData } = useSWR<{ playlists: Playlist[] }>('/api/playlists', apiClient.fetcher);
  const { data: ffmpegInfo } = useSWR<{ encoders: string[] }>('/api/system/ffmpeg-info', apiClient.fetcher, { refreshInterval: 60000 });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StreamProfile | null>(null);
  const [form, setForm] = useState<Partial<StreamProfile>>(EMPTY);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (p: StreamProfile) => { setEditing(p); setForm(p); setShowForm(true); };

  const save = async () => {
    if (!form.name || !form.rtmp_url || !form.stream_key) {
      toast('Please fill name, RTMP URL and stream key', 'error'); return;
    }
    if (form.source_type === 'single' && !form.video_id) { toast('Select a video', 'error'); return; }
    if (form.source_type === 'playlist' && !form.playlist_id) { toast('Select a playlist', 'error'); return; }
    try {
      if (editing) {
        await apiClient.put(`/api/streams/profiles/${editing.id}`, form);
        toast('Profile updated', 'success');
      } else {
        await apiClient.post('/api/streams/profiles', form);
        toast('Profile created', 'success');
      }
      setShowForm(false);
      refetchProfiles();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const start = async (id: string) => {
    try { await apiClient.post(`/api/streams/${id}/start`); toast('Stream starting…', 'success'); refetchActive(); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const stop = async (id: string) => { await apiClient.post(`/api/streams/${id}/stop`); toast('Stream stopped'); refetchActive(); };
  const restart = async (id: string) => { await apiClient.post(`/api/streams/${id}/restart`); toast('Restarting…'); refetchActive(); };
  const del = async (p: StreamProfile) => {
    if (!confirm(`Delete profile "${p.name}"?`)) return;
    await apiClient.delete(`/api/streams/profiles/${p.id}`);
    refetchProfiles(); refetchActive();
  };

  const activeMap = new Map((aData?.streams || []).map((s) => [s.profile_id, s]));

  const set = <K extends keyof StreamProfile>(k: K, v: StreamProfile[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Streaming</h1>
            <p className="text-gray-500 text-sm">Manage stream profiles and go live to YouTube or custom RTMP</p>
          </div>
          <button onClick={openCreate} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Stream Profile
          </button>
        </div>

        {/* Active streams */}
        {aData && aData.streams.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-white">Active Streams</h2>
            <div className="grid gap-3">
              {aData.streams.map((s) => (
                <div key={s.id} className="card flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {s.status === 'running' ? <span className="live-dot" /> : <span className="w-2 h-2 rounded-full bg-amber-500" />}
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{s.profile?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{s.current_video_title} · {s.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <div><span className="text-white font-semibold">{s.current_bitrate.toFixed(0)}</span> kbps</div>
                    <div><span className="text-white font-semibold">{s.current_fps.toFixed(0)}</span> fps</div>
                    <div><span className="text-white font-semibold">{s.current_resolution}</span></div>
                    <div><span className="text-red-400 font-semibold">{s.dropped_frames}</span> dropped</div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/preview?id=${s.id}`} className="btn-secondary !py-1.5 text-xs">Preview</a>
                    <button onClick={() => restart(s.id)} className="btn-secondary !py-1.5 text-xs">Restart</button>
                    <button onClick={() => stop(s.id)} className="btn-danger !py-1.5 text-xs">Stop</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile list */}
        <div className="grid gap-3">
          {pData?.profiles.map((p) => {
            const active = activeMap.get(p.id);
            const isRunning = active?.status === 'running' || active?.status === 'starting';
            return (
              <div key={p.id} className="card flex items-center gap-4 flex-wrap">
                <div className="w-12 h-12 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
                  {p.destination === 'youtube' ? (
                    <svg className="w-7 h-7 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  ) : (
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white truncate">{p.name}</h3>
                    {isRunning && <span className="badge-live"><span className="live-dot !w-1.5 !h-1.5" />LIVE</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.destination === 'youtube' ? 'YouTube' : 'Custom RTMP'} · {p.resolution} · {p.fps}fps · {p.video_bitrate}kbps · {p.encoder}
                    {p.source_type === 'playlist' ? ' · Playlist loop' : ' · Single video'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isRunning ? (
                    <button onClick={() => stop(p.id)} className="btn-danger !py-1.5 text-xs">Stop</button>
                  ) : (
                    <button onClick={() => start(p.id)} className="btn-primary !py-1.5 text-xs">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      Start
                    </button>
                  )}
                  <button onClick={() => openEdit(p)} className="btn-secondary !py-1.5 text-xs">Edit</button>
                  <a href={`/preview?id=${p.id}`} className="btn-secondary !py-1.5 text-xs">Logs</a>
                  <button onClick={() => del(p)} className="btn-secondary !py-1.5 text-xs hover:!border-red-500/50 hover:!text-red-400">Delete</button>
                </div>
              </div>
            );
          })}
          {!pData?.profiles.length && (
            <div className="card text-center py-16">
              <p className="text-gray-400 font-medium">No stream profiles yet</p>
              <p className="text-gray-600 text-sm mt-1">Create one to begin 24/7 streaming</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Stream Profile' : 'New Stream Profile'} size="xl">
        <div className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Stream Name</label>
              <input className="input" value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="My 24/7 Channel" />
            </div>
          </div>

          {/* Destination */}
          <div>
            <label className="label">Destination</label>
            <div className="grid grid-cols-2 gap-2">
              {(['youtube', 'rtmp'] as const).map((d) => (
                <button key={d} type="button" onClick={() => set('destination', d)}
                  className={`p-3 rounded-lg border text-sm font-medium transition ${form.destination === d ? 'border-brand bg-brand/10 text-brand-light' : 'border-bg-border text-gray-400 hover:border-gray-600'}`}>
                  {d === 'youtube' ? 'YouTube Live' : 'Custom RTMP'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">RTMP URL</label>
              <input className="input font-mono text-xs" value={form.rtmp_url || ''} onChange={(e) => set('rtmp_url', e.target.value)}
                placeholder={form.destination === 'youtube' ? 'rtmp://a.rtmp.youtube.com/live2' : 'rtmp://your-server/live'} />
            </div>
            <div>
              <label className="label">Stream Key</label>
              <input className="input font-mono text-xs" type="password" value={form.stream_key || ''} onChange={(e) => set('stream_key', e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" />
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="label">Video Source</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(['single', 'playlist'] as const).map((d) => (
                <button key={d} type="button" onClick={() => set('source_type', d)}
                  className={`p-3 rounded-lg border text-sm font-medium transition ${form.source_type === d ? 'border-brand bg-brand/10 text-brand-light' : 'border-bg-border text-gray-400'}`}>
                  {d === 'single' ? 'Single Video' : 'Playlist (Loop)'}
                </button>
              ))}
            </div>
            {form.source_type === 'single' ? (
              <select className="input" value={form.video_id || ''} onChange={(e) => set('video_id', e.target.value)}>
                <option value="">Select a video…</option>
                {vidData?.videos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
              </select>
            ) : (
              <select className="input" value={form.playlist_id || ''} onChange={(e) => set('playlist_id', e.target.value)}>
                <option value="">Select a playlist…</option>
                {plData?.playlists.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.items_count} videos)</option>)}
              </select>
            )}
            <div className="flex gap-4 mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.loop !== false} onChange={(e) => set('loop', e.target.checked)} /> Loop single video
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.repeat_forever !== false} onChange={(e) => set('repeat_forever', e.target.checked)} /> Repeat forever
              </label>
            </div>
          </div>

          {/* Quality */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="label">Resolution</label>
              <select className="input" value={form.resolution} onChange={(e) => set('resolution', e.target.value as any)}>
                {RESOLUTIONS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Frame Rate</label>
              <select className="input" value={form.fps} onChange={(e) => set('fps', parseInt(e.target.value) as any)}>
                {FPS.map((f) => <option key={f} value={f}>{f} fps</option>)}
              </select>
            </div>
            <div>
              <label className="label">Video Bitrate (kbps)</label>
              <select className="input" value={form.video_bitrate} onChange={(e) => set('video_bitrate', parseInt(e.target.value))}>
                {BITRATES.map((b) => <option key={b} value={b}>{b} kbps</option>)}
              </select>
            </div>
            <div>
              <label className="label">Audio Bitrate (kbps)</label>
              <select className="input" value={form.audio_bitrate} onChange={(e) => set('audio_bitrate', parseInt(e.target.value))}>
                {AUDIO_BITRATES.map((b) => <option key={b} value={b}>{b} kbps</option>)}
              </select>
            </div>
            <div>
              <label className="label">Encoder {ffmpegInfo?.encoders && <span className="text-gray-600">({ffmpegInfo.encoders.filter(e => e !== 'x264').join(', ') || 'CPU only'})</span>}</label>
              <select className="input" value={form.encoder} onChange={(e) => set('encoder', e.target.value as any)}>
                {ENCODERS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Preset</label>
              <select className="input" value={form.preset} onChange={(e) => set('preset', e.target.value as any)}>
                {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Options */}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 p-3 rounded-lg border border-bg-border cursor-pointer">
              <input type="checkbox" checked={form.hls_preview !== false} onChange={(e) => set('hls_preview', e.target.checked)} />
              <div><p className="text-sm text-white">HLS Live Preview</p><p className="text-xs text-gray-500">Watch stream in browser</p></div>
            </label>
            <label className="flex items-center gap-2 p-3 rounded-lg border border-bg-border cursor-pointer">
              <input type="checkbox" checked={form.auto_restart !== false} onChange={(e) => set('auto_restart', e.target.checked)} />
              <div><p className="text-sm text-white">Auto Restart</p><p className="text-xs text-gray-500">Restart if FFmpeg crashes</p></div>
            </label>
            <label className="flex items-center gap-2 p-3 rounded-lg border border-bg-border cursor-pointer">
              <input type="checkbox" checked={!!form.volume_normalize} onChange={(e) => set('volume_normalize', e.target.checked)} />
              <div><p className="text-sm text-white">Volume Normalization</p><p className="text-xs text-gray-500">Loudnorm audio filter</p></div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-bg-border">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" onClick={save}>{editing ? 'Save Changes' : 'Create Profile'}</button>
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </AppShell>
  );
}
