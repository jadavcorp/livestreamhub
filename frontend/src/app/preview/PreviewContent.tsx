'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Hls from 'hls.js';
import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { ToastContainer } from '@/components/Toast';
import { apiClient } from '@/lib/api';
import { ActiveStream } from '@/lib/types';

export default function PreviewContent() {
  const searchParams = useSearchParams();
  const preselect = searchParams.get('id') || '';
  const [selectedId, setSelectedId] = useState(preselect);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [logSearch, setLogSearch] = useState('');

  const { data: activeData } = useSWR<{ streams: ActiveStream[] }>('/api/streams/active', apiClient.fetcher, { refreshInterval: 2000 });
  const streams = activeData?.streams || [];
  const current = streams.find((s) => s.profile_id === selectedId || s.id === selectedId);

  const { data: logsData } = useSWR<{ logs: any[] }>(current ? `/api/streams/${current.id}/logs?limit=200` : null, apiClient.fetcher, { refreshInterval: 3000 });

  useEffect(() => {
    if (!current?.hls_url || !videoRef.current) return;
    const video = videoRef.current;
    const url = current.hls_url;

    if (Hls.isSupported()) {
      const hls = new Hls({ liveSyncDurationCount: 3, lowLatencyMode: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) console.warn('HLS error', data);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    }
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [current?.id, current?.hls_url]);

  const filteredLogs = logsData?.logs?.filter((l: any) => !logSearch || l.message.toLowerCase().includes(logSearch.toLowerCase())) || [];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Preview</h1>
          <p className="text-gray-500 text-sm">Monitor and preview active streams</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card !p-0 overflow-hidden">
              <div className="relative aspect-video bg-black">
                {current?.hls_url ? (
                  <video ref={videoRef} controls autoPlay muted className="w-full h-full" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                    <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <p>No active preview</p>
                    <p className="text-xs mt-1">Start a stream with HLS preview enabled</p>
                  </div>
                )}
                {current?.status === 'running' && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur px-2.5 py-1 rounded-md">
                    <span className="live-dot" />
                    <span className="text-xs font-bold text-white tracking-wider">LIVE</span>
                  </div>
                )}
              </div>
            </div>

            {current && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card !p-3 text-center">
                  <p className="text-xs text-gray-500">Bitrate</p>
                  <p className="text-lg font-bold text-brand-light">{current.current_bitrate.toFixed(0)} <span className="text-xs">kbps</span></p>
                </div>
                <div className="card !p-3 text-center">
                  <p className="text-xs text-gray-500">FPS</p>
                  <p className="text-lg font-bold text-white">{current.current_fps.toFixed(0)}</p>
                </div>
                <div className="card !p-3 text-center">
                  <p className="text-xs text-gray-500">Resolution</p>
                  <p className="text-lg font-bold text-white">{current.current_resolution}</p>
                </div>
                <div className="card !p-3 text-center">
                  <p className="text-xs text-gray-500">Dropped</p>
                  <p className={`text-lg font-bold ${current.dropped_frames > 50 ? 'text-red-400' : 'text-emerald-400'}`}>{current.dropped_frames}</p>
                </div>
              </div>
            )}

            {current?.current_video_title && (
              <div className="card !py-3 flex items-center gap-3">
                <svg className="w-5 h-5 text-brand-light" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">Now Playing</p>
                  <p className="text-sm text-white truncate">{current.current_video_title}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card space-y-2">
              <h3 className="font-semibold text-white text-sm">Streams</h3>
              {streams.length === 0 ? (
                <p className="text-xs text-gray-600 py-4 text-center">No active streams</p>
              ) : streams.map((s) => (
                <button key={s.id} onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left p-2.5 rounded-lg text-sm transition ${selectedId === s.id ? 'bg-brand/10 border border-brand/30' : 'hover:bg-bg-hover border border-transparent'}`}>
                  <p className="text-white font-medium truncate">{s.profile?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{s.current_video_title}</p>
                </button>
              ))}
            </div>

            <div className="card !p-0 overflow-hidden flex flex-col" style={{ maxHeight: '500px' }}>
              <div className="p-3 border-b border-bg-border flex items-center gap-2">
                <h3 className="font-semibold text-white text-sm flex-1">FFmpeg Logs</h3>
                <button onClick={() => current && apiClient.delete(`/api/streams/${current.id}/logs`)} className="text-xs text-gray-500 hover:text-red-400">Clear</button>
              </div>
              <div className="p-2 border-b border-bg-border">
                <input className="input !py-1 text-xs" placeholder="Search logs…" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} />
              </div>
              <div className="overflow-y-auto p-2 font-mono text-xs space-y-0.5 flex-1" style={{ minHeight: '200px' }}>
                {filteredLogs.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No logs</p>
                ) : filteredLogs.map((l: any) => (
                  <div key={l.id} className={`${l.level === 'error' ? 'text-red-400' : l.level === 'warn' ? 'text-amber-400' : 'text-gray-400'}`}>
                    <span className="text-gray-700">{new Date(l.created_at).toLocaleTimeString()}</span> {l.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppShell>
  );
}
