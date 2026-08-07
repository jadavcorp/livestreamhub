'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { ToastContainer, toast } from '@/components/Toast';
import { apiClient, formatBytes, timeAgo } from '@/lib/api';

export default function BackupPage() {
  const { data, mutate } = useSWR<{ backups: any[] }>('/api/backup', apiClient.fetcher);
  const [creating, setCreating] = useState(false);
  const [opts, setOpts] = useState({ includeVideos: true, includeThumbnails: true, includeDatabase: true, includeSettings: true });

  const create = async () => {
    setCreating(true);
    try {
      await apiClient.post('/api/backup', opts);
      toast('Backup created', 'success');
      mutate();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const restore = async (filename: string) => {
    if (!confirm(`Restore "${filename}"? This will overwrite current data.`)) return;
    await apiClient.post(`/api/backup/${filename}/restore`);
    toast('Backup restored', 'success');
  };

  const del = async (filename: string) => {
    if (!confirm('Delete backup?')) return;
    await apiClient.delete(`/api/backup/${filename}`);
    mutate();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Backup & Restore</h1>
          <p className="text-gray-500 text-sm">Safeguard your videos, playlists, database and settings</p>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Create Backup</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { k: 'includeVideos', label: 'Videos', desc: 'All uploaded video files (large)' },
              { k: 'includeThumbnails', label: 'Thumbnails', desc: 'Generated thumbnails' },
              { k: 'includeDatabase', label: 'Database', desc: 'Playlists, profiles, settings' },
              { k: 'includeSettings', label: 'Settings', desc: 'Configuration export' },
            ].map((o) => (
              <label key={o.k} className="flex items-start gap-3 p-3 rounded-lg border border-bg-border cursor-pointer hover:border-brand/30">
                <input type="checkbox" className="mt-0.5" checked={(opts as any)[o.k]} onChange={(e) => setOpts({ ...opts, [o.k]: e.target.checked })} />
                <div><p className="text-sm text-white">{o.label}</p><p className="text-xs text-gray-500">{o.desc}</p></div>
              </label>
            ))}
          </div>
          <button onClick={create} disabled={creating} className="btn-primary">{creating ? 'Creating…' : 'Create Backup'}</button>
        </div>

        <div className="card !p-0 overflow-hidden">
          <h3 className="font-semibold text-white p-4 border-b border-bg-border">Backups ({data?.backups?.length || 0})</h3>
          {data?.backups?.length === 0 ? (
            <p className="text-gray-500 text-center py-10">No backups yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-bg-elevated/50">
                <tr><th className="text-left px-4 py-2">File</th><th className="text-left px-4 py-2 hidden sm:table-cell">Size</th><th className="text-left px-4 py-2 hidden sm:table-cell">Created</th><th></th></tr>
              </thead>
              <tbody>
                {data?.backups?.map((b: any) => (
                  <tr key={b.id} className="border-t border-bg-border">
                    <td className="px-4 py-3 text-gray-200 font-mono text-xs">{b.filename}</td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{formatBytes(b.size)}</td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{timeAgo(b.created_at)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <a href={`/api/backup/${b.filename}/download`} className="text-xs text-blue-400 hover:text-blue-300">Download</a>
                      <button onClick={() => restore(b.filename)} className="text-xs text-amber-400 hover:text-amber-300">Restore</button>
                      <button onClick={() => del(b.filename)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <ToastContainer />
    </AppShell>
  );
}
