'use client';

import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { apiClient, formatBytes, formatUptime } from '@/lib/api';
import { SystemStats, FFmpegInfo } from '@/lib/types';

function Gauge({ value, label, sub, color = 'bg-brand' }: { value: number; label: string; sub?: string; color?: string }) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <span className="text-lg font-bold text-white">{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      {sub && <p className="text-xs text-gray-600 mt-2">{sub}</p>}
    </div>
  );
}

export default function SystemPage() {
  const { data } = useSWR<SystemStats>('/api/system/stats', apiClient.fetcher, { refreshInterval: 2000 });
  const { data: ff } = useSWR<FFmpegInfo>('/api/system/ffmpeg-info', apiClient.fetcher);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">System Monitor</h1>
          <p className="text-gray-500 text-sm">VPS resources and FFmpeg status</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Gauge value={data?.cpu?.usage ?? 0} label="CPU Usage" sub={data ? `${data.cpu.cores} cores · ${data.cpu.model?.slice(0, 40)}` : ''} color={(data?.cpu?.usage ?? 0) > 80 ? 'bg-red-500' : 'bg-blue-500'} />
          <Gauge value={data?.mem?.usagePercent ?? 0} label="RAM Usage" sub={data ? `${formatBytes(data.mem.used)} / ${formatBytes(data.mem.total)}` : ''} color={(data?.mem?.usagePercent ?? 0) > 85 ? 'bg-red-500' : 'bg-purple-500'} />
          <Gauge value={data?.disk?.usagePercent ?? 0} label="Disk Usage" sub={data ? `${formatBytes(data.disk.used)} / ${formatBytes(data.disk.total)}` : ''} color={(data?.disk?.usagePercent ?? 0) > 85 ? 'bg-red-500' : 'bg-emerald-500'} />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-xs text-gray-500 uppercase">Uptime</p>
            <p className="text-2xl font-bold text-white mt-1">{data ? formatUptime(data.uptime) : '—'}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 uppercase">Download</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{data ? (data.network.rx_sec / 1024 / 1024).toFixed(2) : '—'} <span className="text-sm">MB/s</span></p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 uppercase">Upload</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{data ? (data.network.tx_sec / 1024 / 1024).toFixed(2) : '—'} <span className="text-sm">MB/s</span></p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 uppercase">Temperature</p>
            <p className={`text-2xl font-bold mt-1 ${(data?.temperature ?? 0) > 75 ? 'text-red-400' : 'text-amber-400'}`}>{data?.temperature ? `${data.temperature.toFixed(0)}°C` : 'N/A'}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-white mb-3">FFmpeg</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">FFmpeg</span><span className={ff?.ffmpeg ? 'text-emerald-400' : 'text-red-400'}>{ff?.ffmpeg ? 'Installed ✓' : 'Not found'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">FFprobe</span><span className={ff?.ffprobe ? 'text-emerald-400' : 'text-red-400'}>{ff?.ffprobe ? 'Installed ✓' : 'Not found'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Hardware Encoders</span><span className="text-gray-300">{ff?.encoders?.filter((e: string) => e !== 'x264').join(', ') || 'None (CPU only)'}</span></div>
              {ff?.ffmpegVersion && <p className="text-xs text-gray-600 pt-2 break-all">{ff.ffmpegVersion}</p>}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-white mb-3">Load Average</h3>
            <div className="space-y-3">
              {[
                { label: '1 min', val: data?.cpu?.loadAvg?.[0] || 0 },
                { label: '5 min', val: data?.cpu?.loadAvg?.[1] || 0 },
                { label: '15 min', val: data?.cpu?.loadAvg?.[2] || 0 },
              ].map((l) => (
                <div key={l.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">{l.label}</span>
                    <span className="text-white">{l.val.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.min((l.val / (data?.cpu?.cores || 4)) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
