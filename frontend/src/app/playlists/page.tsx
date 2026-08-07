'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { ToastContainer, toast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { apiClient, formatDuration } from '@/lib/api';
import { Playlist, Video } from '@/lib/types';

export default function PlaylistsPage() {
  const { data: plData, mutate: refetch } = useSWR<{ playlists: Playlist[] }>('/api/playlists', apiClient.fetcher);
  const { data: vidData } = useSWR<{ videos: Video[] }>('/api/videos?limit=500', apiClient.fetcher);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedVids, setSelectedVids] = useState<string[]>([]);
  const [editing, setEditing] = useState<Playlist | null>(null);
  const [addOpen, setAddOpen] = useState<Playlist | null>(null);
  const [detailOpen, setDetailOpen] = useState<Playlist | null>(null);
  const { data: detail } = useSWR<{ items: any[]; playlist: any }>(detailOpen ? `/api/playlists/${detailOpen.id}` : null, apiClient.fetcher);

  const create = async () => {
    if (!name.trim()) return;
    await apiClient.post('/api/playlists', { name, description, videoIds: selectedVids, repeat: true, loop_forever: true });
    toast('Playlist created', 'success');
    setShowCreate(false); setName(''); setDescription(''); setSelectedVids([]);
    refetch();
  };

  const remove = async (p: Playlist) => {
    if (!confirm(`Delete playlist "${p.name}"?`)) return;
    await apiClient.delete(`/api/playlists/${p.id}`);
    toast('Playlist deleted', 'success');
    refetch();
  };

  const duplicate = async (p: Playlist) => {
    await apiClient.post(`/api/playlists/${p.id}/duplicate`);
    toast('Playlist duplicated', 'success');
    refetch();
  };

  const toggleShuffle = async (p: Playlist) => {
    await apiClient.patch(`/api/playlists/${p.id}`, { shuffle: !p.shuffle });
    refetch();
  };

  const addVideos = async () => {
    if (!addOpen || selectedVids.length === 0) return;
    await apiClient.post(`/api/playlists/${addOpen.id}/videos`, { videoIds: selectedVids });
    toast('Videos added', 'success');
    setAddOpen(null); setSelectedVids([]);
    refetch();
  };

  const removeItem = async (itemId: string) => {
    if (!detailOpen) return;
    await apiClient.delete(`/api/playlists/${detailOpen.id}/videos/${itemId}`);
    const d = await apiClient.get(`/api/playlists/${detailOpen.id}`);
    setDetailOpen({ ...detailOpen });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Playlists</h1>
            <p className="text-gray-500 text-sm">{plData?.playlists.length || 0} playlists · organize videos for 24/7 streaming</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Playlist
          </button>
        </div>

        {!plData?.playlists.length ? (
          <div className="card text-center py-16">
            <p className="text-gray-400 font-medium">No playlists yet</p>
            <p className="text-gray-600 text-sm mt-1">Create one to group videos for continuous streaming</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plData.playlists.map((p) => (
              <div key={p.id} className="card hover:border-brand/30 transition cursor-pointer" onClick={() => setDetailOpen(p)}>
                <div className="aspect-video bg-bg-elevated rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {p.thumbnail_path ? (
                    <img src={p.thumbnail_path} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                  )}
                </div>
                <h3 className="font-semibold text-white truncate">{p.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description || `${p.items_count} videos`}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                  <span>{p.items_count} videos</span>
                  <span>·</span>
                  <span>{formatDuration(p.duration)}</span>
                  {p.shuffle && <><span>·</span><span className="text-purple-400">Shuffle</span></>}
                  {p.loop_forever && <><span>·</span><span className="text-emerald-400">Loop</span></>}
                </div>
                <div className="flex gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setAddOpen(p); setSelectedVids([]); }} className="btn-ghost !px-2 !py-1 text-xs">Add Videos</button>
                  <button onClick={() => toggleShuffle(p)} className="btn-ghost !px-2 !py-1 text-xs">{p.shuffle ? 'Shuffle On' : 'Shuffle'}</button>
                  <button onClick={() => duplicate(p)} className="btn-ghost !px-2 !py-1 text-xs">Duplicate</button>
                  <button onClick={() => remove(p)} className="btn-ghost !px-2 !py-1 text-xs hover:!text-red-400 ml-auto">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Playlist">
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My 24/7 Stream" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Add Videos ({selectedVids.length} selected)</label>
            <div className="max-h-60 overflow-y-auto space-y-1 border border-bg-border rounded-lg p-2">
              {vidData?.videos.map((v) => (
                <label key={v.id} className="flex items-center gap-2 p-2 hover:bg-bg-hover rounded cursor-pointer">
                  <input type="checkbox" checked={selectedVids.includes(v.id)} onChange={(e) => {
                    setSelectedVids(e.target.checked ? [...selectedVids, v.id] : selectedVids.filter((x) => x !== v.id));
                  }} />
                  <span className="text-sm text-gray-300 flex-1 truncate">{v.title}</span>
                  <span className="text-xs text-gray-600">{formatDuration(v.duration)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn-primary" onClick={create}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Add Videos Modal */}
      <Modal open={!!addOpen} onClose={() => setAddOpen(null)} title={`Add Videos to "${addOpen?.name}"`} size="lg">
        <div className="space-y-4">
          <div className="max-h-96 overflow-y-auto space-y-1 border border-bg-border rounded-lg p-2">
            {vidData?.videos.map((v) => (
              <label key={v.id} className="flex items-center gap-2 p-2 hover:bg-bg-hover rounded cursor-pointer">
                <input type="checkbox" checked={selectedVids.includes(v.id)} onChange={(e) => {
                  setSelectedVids(e.target.checked ? [...selectedVids, v.id] : selectedVids.filter((x) => x !== v.id));
                }} />
                <span className="text-sm text-gray-300 flex-1 truncate">{v.title}</span>
                <span className="text-xs text-gray-600">{formatDuration(v.duration)}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setAddOpen(null)}>Cancel</button>
            <button className="btn-primary" onClick={addVideos}>Add {selectedVids.length} Video(s)</button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailOpen} onClose={() => setDetailOpen(null)} title={detailOpen?.name || ''} size="lg">
        <div className="space-y-3">
          {detailOpen?.description && <p className="text-sm text-gray-400">{detailOpen.description}</p>}
          <div className="text-xs text-gray-500">
            {detail?.items?.length || 0} videos · {formatDuration(detailOpen?.duration || 0)} total
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {detail?.items?.map((item: any, i: number) => (
              <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-bg-hover rounded">
                <span className="w-6 text-center text-xs text-gray-600">{i + 1}</span>
                <div className="w-16 h-9 bg-bg-elevated rounded overflow-hidden flex-shrink-0">
                  {item.thumbnail_path && <img src={item.thumbnail_path} className="w-full h-full object-cover" alt="" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.title}</p>
                  <p className="text-xs text-gray-600">{formatDuration(item.duration)}</p>
                </div>
                <button onClick={() => removeItem(item.id)} className="btn-ghost !p-1.5 hover:!text-red-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </AppShell>
  );
}
