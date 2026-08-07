'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { ToastContainer, toast } from '@/components/Toast';
import { apiClient } from '@/lib/api';

const TYPE_COLORS: Record<string, string> = {
  info: 'text-blue-400', success: 'text-emerald-400', error: 'text-red-400',
  warn: 'text-amber-400', stream: 'text-brand-light', upload: 'text-purple-400', system: 'text-gray-400',
};

export default function LogsPage() {
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const { data, mutate } = useSWR<{ logs: any[] }>(`/api/logs/activity?limit=500${type ? `&type=${type}` : ''}`, apiClient.fetcher, { refreshInterval: 5000 });

  const clear = async () => {
    if (!confirm('Clear all activity logs?')) return;
    await apiClient.delete('/api/logs/activity');
    toast('Logs cleared');
    mutate();
  };

  const download = () => window.open('/api/logs/download', '_blank');

  const filtered = data?.logs.filter((l) => !search || l.message.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Logs</h1>
            <p className="text-gray-500 text-sm">Application and streaming activity</p>
          </div>
          <div className="flex gap-2">
            <button onClick={download} className="btn-secondary text-sm">Download</button>
            <button onClick={clear} className="btn-danger text-sm">Clear</button>
          </div>
        </div>

        <div className="card !p-3 flex gap-2 flex-wrap">
          <input className="input !py-1.5 flex-1 min-w-[200px]" placeholder="Search logs…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input !py-1.5 w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {['info', 'success', 'warn', 'error', 'stream', 'upload', 'system'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="card !p-0 overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto font-mono text-xs">
            {filtered.length === 0 ? (
              <p className="text-gray-600 text-center py-12">No logs</p>
            ) : filtered.map((l) => (
              <div key={l.id} className="flex gap-3 px-4 py-2 border-b border-bg-border/50 hover:bg-bg-hover/30">
                <span className="text-gray-600 flex-shrink-0 w-36">{new Date(l.created_at).toLocaleString()}</span>
                <span className={`uppercase font-semibold flex-shrink-0 w-16 ${TYPE_COLORS[l.type] || 'text-gray-400'}`}>{l.type}</span>
                <span className="text-gray-300 flex-1 break-all">{l.message}{l.details ? <span className="text-gray-600"> — {l.details}</span> : null}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppShell>
  );
}
