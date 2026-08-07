'use client';

import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { ToastContainer } from '@/components/Toast';
import { apiClient, formatBytes, formatDuration } from '@/lib/api';
import { Video } from '@/lib/types';

export default function FilesPage() {
  const { data: folderData } = useSWR<{ folders: any[] }>('/api/folders', apiClient.fetcher);
  const { data: vidData } = useSWR<{ videos: Video[] }>('/api/videos?limit=500', apiClient.fetcher);

  const folders = folderData?.folders || [];
  const videos = vidData?.videos || [];
  const totalSize = videos.reduce((s, v) => s + v.size, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">File Manager</h1>
          <p className="text-gray-500 text-sm">{videos.length} files · {formatBytes(totalSize)} total</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase px-2">Folders</h3>
            {folders.map((f: any) => {
              const count = videos.filter((v) => v.folder_id === f.id).length;
              return (
                <div key={f.id} className="card !p-3 flex items-center gap-3 cursor-pointer hover:border-brand/30">
                  <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" /></svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{f.name}</p>
                    <p className="text-xs text-gray-500">{count} files</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="md:col-span-3 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase px-2">Files</h3>
            <div className="card !p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg-elevated/50">
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Resolution</th>
                    <th className="px-4 py-2.5 font-medium hidden md:table-cell">Duration</th>
                    <th className="px-4 py-2.5 font-medium text-right">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v) => (
                    <tr key={v.id} className="table-row border-t border-bg-border">
                      <td className="px-4 py-2.5 text-gray-200 truncate max-w-xs">{v.title}</td>
                      <td className="px-4 py-2.5 text-gray-400 hidden sm:table-cell">{v.width}×{v.height}</td>
                      <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell">{formatDuration(v.duration)}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-right">{formatBytes(v.size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppShell>
  );
}
