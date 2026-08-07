'use client';

import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { ToastContainer } from '@/components/Toast';
import { apiClient, formatBytes, formatDuration, formatUptime } from '@/lib/api';
import { DashboardStats } from '@/lib/types';

const fetcher = (url: string) => apiClient.get(url);

function StatCard({ icon, label, value, sub, color = 'text-white' }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="stat-tile">
      <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center flex-shrink-0">
        <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className={`text-xl font-bold ${color} truncate`}>{value}</p>
        {sub && <p className="text-xs text-gray-600 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ value, color = 'bg-brand' }: { value: number; color?: string }) {
  return (
    <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function LiveStreamRow({ s }: { s: DashboardStats['activeStreams'][0] }) {
  const isLive = s.status === 'running';
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-elevated/50 border border-bg-border">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLive ? 'bg-brand animate-pulse' : 'bg-gray-600'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{s.profile?.name || s.id}</p>
        <p className="text-xs text-gray-500">{s.current_video_title || '—'}</p>
      </div>
      <div className="text-right text-xs">
        <p className="text-gray-300">{s.current_bitrate.toFixed(0)} kbps</p>
        <p className="text-gray-500">{s.current_fps.toFixed(0)} fps · {s.current_resolution}</p>
      </div>
    </div>
  );
}

const activityColors: Record<string, string> = {
  info: 'text-blue-400', success: 'text-emerald-400', error: 'text-red-400',
  warn: 'text-amber-400', stream: 'text-brand-light', upload: 'text-purple-400', system: 'text-gray-400',
};

export default function DashboardPage() {
  const { data, error, isLoading } = useSWR<DashboardStats>('/api/dashboard/stats', fetcher, { refreshInterval: 3000 });

  if (isLoading) {
    return <AppShell><div className="text-gray-500">Loading dashboard…</div></AppShell>;
  }
  if (error || !data) {
    return <AppShell><div className="text-red-400">Failed to load: {error?.message}</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time overview of your streaming hub</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" label="Total Videos" value={data.totalVideos} color="text-blue-400" />
          <StatCard icon="M4 6h16M4 10h16M4 14h16M4 18h16" label="Playlists" value={data.totalPlaylists} color="text-purple-400" />
          <StatCard icon="M5 10l7-7m0 0l7 7m-7-7v18" label="Running Streams" value={data.runningStreams} color="text-brand-light" />
          <StatCard icon="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" label="Stopped" value={data.stoppedStreams} color="text-gray-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Resources */}
          <div className="card lg:col-span-2 space-y-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              System Resources
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400">CPU</span>
                  <span className="text-white font-medium">{data.cpu.usage}% · {data.cpu.cores} cores</span>
                </div>
                <ProgressBar value={data.cpu.usage} color={data.cpu.usage > 80 ? 'bg-red-500' : 'bg-blue-500'} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400">RAM</span>
                  <span className="text-white font-medium">{data.memory.usagePercent}%</span>
                </div>
                <ProgressBar value={data.memory.usagePercent} color={data.memory.usagePercent > 85 ? 'bg-red-500' : 'bg-purple-500'} />
                <p className="text-xs text-gray-600 mt-1">{formatBytes(data.memory.used)} / {formatBytes(data.memory.total)}</p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400">Disk</span>
                  <span className="text-white font-medium">{data.disk.usagePercent.toFixed(0)}%</span>
                </div>
                <ProgressBar value={data.disk.usagePercent} color={data.disk.usagePercent > 85 ? 'bg-red-500' : 'bg-emerald-500'} />
                <p className="text-xs text-gray-600 mt-1">{formatBytes(data.disk.used)} / {formatBytes(data.disk.total)}</p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400">Network</span>
                  <span className="text-white font-medium">↓ {(data.network.rx_sec / 1024).toFixed(1)} MB/s</span>
                </div>
                <p className="text-xs text-gray-600">↑ {(data.network.tx_sec / 1024).toFixed(1)} MB/s · Uptime {formatUptime(data.uptime)}</p>
              </div>
            </div>
          </div>

          {/* Stream Stats */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Stream Output</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Current Bitrate</span>
                <span className="text-lg font-bold text-brand-light">{data.currentBitrate.toFixed(0)} kbps</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Frame Rate</span>
                <span className="text-lg font-bold text-white">{data.currentFps.toFixed(0)} fps</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Resolution</span>
                <span className="text-lg font-bold text-white">{data.currentResolution}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active streams */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-white">Active Streams</h2>
            {data.activeStreams.length === 0 ? (
              <p className="text-sm text-gray-600 py-6 text-center">No active streams. Start one from the Streaming page.</p>
            ) : (
              <div className="space-y-2">{data.activeStreams.map((s) => <LiveStreamRow key={s.id} s={s} />)}</div>
            )}
          </div>

          {/* Recent activity */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-white">Recent Activity</h2>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-gray-600 py-6 text-center">No activity yet</p>
              ) : data.recentActivity.map((log) => (
                <div key={log.id} className="flex gap-3 text-sm py-1.5 border-b border-bg-border/50 last:border-0">
                  <span className={`text-xs font-medium uppercase flex-shrink-0 w-16 ${activityColors[log.type] || 'text-gray-400'}`}>{log.type}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 truncate">{log.message}</p>
                    <p className="text-xs text-gray-600">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppShell>
  );
}
