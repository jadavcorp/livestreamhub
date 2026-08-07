'use client';

import { useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { ToastContainer, toast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { apiClient, formatBytes, formatDuration } from '@/lib/api';
import { Video } from '@/lib/types';

interface UploadTask { id: string; name: string; progress: number; status: 'uploading' | 'done' | 'error'; error?: string; }

export default function VideosPage() {
  const { data, mutate } = useSWR<{ videos: Video[]; total: number }>('/api/videos?limit=200', apiClient.fetcher);
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const [playing, setPlaying] = useState<Video | null>(null);
  const [renameTarget, setRenameTarget] = useState<Video | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newTasks: UploadTask[] = arr.map((f) => ({ id: Math.random().toString(36).slice(2), name: f.name, progress: 0, status: 'uploading' }));
    setUploads((t) => [...t, ...newTasks]);

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const task = newTasks[i];
      const formData = new FormData();
      formData.append('files', file);
      try {
        await apiClient.upload('/api/videos/upload', formData, (pct) => {
          setUploads((t) => t.map((x) => x.id === task.id ? { ...x, progress: pct } : x));
        });
        setUploads((t) => t.map((x) => x.id === task.id ? { ...x, status: 'done', progress: 100 } : x));
        toast(`${file.name} uploaded`, 'success');
      } catch (e: any) {
        setUploads((t) => t.map((x) => x.id === task.id ? { ...x, status: 'error', error: e.message } : x));
        toast(`Failed: ${file.name}`, 'error');
      }
    }
    mutate();
    setTimeout(() => setUploads((t) => t.filter((x) => x.status === 'uploading')), 3000);
  }, [mutate]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const onDelete = async (v: Video) => {
    if (!confirm(`Delete "${v.title}"? This cannot be undone.`)) return;
    await apiClient.delete(`/api/videos/${v.id}`);
    toast('Video deleted', 'success');
    mutate();
  };

  const doRename = async () => {
    if (!renameTarget) return;
    await apiClient.patch(`/api/videos/${renameTarget.id}`, { title: renameValue });
    toast('Renamed', 'success');
    setRenameTarget(null);
    mutate();
  };

  const download = (v: Video) => { window.open(`/api/videos/${v.id}/download`, '_blank'); };

  return (
    <AppShell>
      <div className="space-y-6" onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={onDrop}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Video Library</h1>
            <p className="text-gray-500 text-sm">{data?.total || 0} videos · Drag & drop files anywhere to upload</p>
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Upload Video
          </button>
          <input ref={fileInputRef} type="file" multiple accept="video/*,.mkv,.mov,.avi,.webm" hidden onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
        </div>

        {/* Upload progress */}
        {uploads.length > 0 && (
          <div className="card space-y-2">
            {uploads.map((t) => (
              <div key={t.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300 truncate">{t.name}</span>
                  <span className={t.status === 'error' ? 'text-red-400' : t.status === 'done' ? 'text-emerald-400' : 'text-gray-500'}>
                    {t.status === 'error' ? `Error: ${t.error}` : t.status === 'done' ? 'Complete' : `${t.progress}%`}
                  </span>
                </div>
                <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${t.status === 'error' ? 'bg-red-500' : t.status === 'done' ? 'bg-emerald-500' : 'bg-brand'}`} style={{ width: `${t.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Drop overlay */}
        {dragActive && (
          <div className="fixed inset-0 z-40 bg-brand/10 border-4 border-dashed border-brand rounded-2xl m-4 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto text-brand mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="text-xl font-semibold text-white">Drop videos to upload</p>
              <p className="text-gray-400 text-sm mt-1">MP4, MKV, MOV, AVI, WEBM supported</p>
            </div>
          </div>
        )}

        {/* Video grid */}
        {!data?.videos.length ? (
          <div className="card text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-700 mb-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            <p className="text-gray-400 font-medium">No videos yet</p>
            <p className="text-gray-600 text-sm mt-1">Upload your first video or drag files here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.videos.map((v) => (
              <div key={v.id} className="card p-0 overflow-hidden group hover:border-brand/40 transition">
                <div className="relative aspect-video bg-bg-elevated cursor-pointer" onClick={() => setPlaying(v)}>
                  {v.thumbnail_path ? (
                    <img src={v.thumbnail_path} alt={v.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700">
                      <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">{formatDuration(v.duration)}</div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="w-12 h-12 rounded-full bg-brand/90 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-white text-sm truncate" title={v.title}>{v.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{v.width}×{v.height} · {formatBytes(v.size)}</p>
                  <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => setPlaying(v)} className="btn-ghost !p-1.5" title="Play"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
                    <button onClick={() => { setRenameTarget(v); setRenameValue(v.title); }} className="btn-ghost !p-1.5" title="Rename"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                    <button onClick={() => download(v)} className="btn-ghost !p-1.5" title="Download"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                    <button onClick={() => onDelete(v)} className="btn-ghost !p-1.5 hover:!text-red-400 ml-auto" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player Modal */}
      <Modal open={!!playing} onClose={() => setPlaying(null)} title={playing?.title || ''} size="lg">
        {playing && (
          <video src={`/api/videos/${playing.id}/play`} controls autoPlay className="w-full rounded-lg bg-black" />
        )}
      </Modal>

      {/* Rename Modal */}
      <Modal open={!!renameTarget} onClose={() => setRenameTarget(null)} title="Rename Video" size="sm">
        <div className="space-y-4">
          <input className="input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setRenameTarget(null)}>Cancel</button>
            <button className="btn-primary" onClick={doRename}>Save</button>
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </AppShell>
  );
}
