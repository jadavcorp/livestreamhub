import si from 'systeminformation';
import os from 'os';
import { SystemStats } from '../types';

let cachedStats: SystemStats | null = null;
let lastFetch = 0;
const CACHE_TTL = 2000;

export async function getSystemStats(): Promise<SystemStats> {
  const now = Date.now();
  if (cachedStats && now - lastFetch < CACHE_TTL) return cachedStats;

  const [cpu, mem, fs, net, temp, proc] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.cpuTemperature().catch(() => ({ main: 0 } as any)),
    si.processes(),
  ]);

  const rootFs = fs.find((f) => f.mount === '/') || fs[0];
  const mainNet = net.find((n) => n.iface && n.iface !== 'lo') || net[0];

  cachedStats = {
    cpu: {
      usage: Math.round(cpu.currentLoad),
      cores: cpu.cpus.length,
      model: os.cpus()[0]?.model || 'Unknown',
      loadAvg: os.loadavg(),
    },
    mem: {
      total: mem.total,
      used: mem.used,
      free: mem.free,
      usagePercent: Math.round((mem.used / mem.total) * 100),
    },
    disk: {
      total: rootFs?.size || 0,
      used: rootFs?.used || 0,
      free: rootFs?.available || 0,
      usagePercent: rootFs?.use || 0,
      path: rootFs?.mount || '/',
    },
    network: {
      rx_sec: mainNet?.rx_sec || 0,
      tx_sec: mainNet?.tx_sec || 0,
      iface: mainNet?.iface || 'n/a',
    },
    uptime: os.uptime(),
    processCount: proc.all,
    temperature: temp?.main || undefined,
    timestamp: now,
  };
  lastFetch = now;
  return cachedStats;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
