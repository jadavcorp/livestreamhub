'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/AppShell';
import { ToastContainer, toast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { apiClient } from '@/lib/api';
import { Schedule, StreamProfile } from '@/lib/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulerPage() {
  const { data, mutate } = useSWR<{ schedules: Schedule[] }>('/api/schedules', apiClient.fetcher);
  const { data: pData } = useSWR<{ profiles: StreamProfile[] }>('/api/streams/profiles', apiClient.fetcher);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    profile_id: '', name: '', start_date: new Date().toISOString().slice(0, 10),
    start_time: '00:00', stop_time: '', repeat: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
    days_of_week: [] as number[], day_of_month: 1, auto_start: true, auto_stop: false, enabled: true,
  });

  const save = async () => {
    if (!form.profile_id || !form.name) { toast('Profile and name required', 'error'); return; }
    await apiClient.post('/api/schedules', form);
    toast('Schedule created', 'success');
    setOpen(false);
    mutate();
  };

  const del = async (id: string) => {
    if (!confirm('Delete schedule?')) return;
    await apiClient.delete(`/api/schedules/${id}`);
    mutate();
  };

  const toggleDay = (d: number) => setForm((f) => ({
    ...f, days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter((x) => x !== d) : [...f.days_of_week, d]
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Scheduler</h1>
            <p className="text-gray-500 text-sm">Automate stream start/stop times</p>
          </div>
          <button className="btn-primary" onClick={() => setOpen(true)}>+ New Schedule</button>
        </div>

        <div className="grid gap-3">
          {data?.schedules.length === 0 && (
            <div className="card text-center py-16 text-gray-500">No schedules configured</div>
          )}
          {data?.schedules.map((s) => (
            <div key={s.id} className="card flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white">{s.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {s.profile_name} · {s.start_date} at {s.start_time}
                  {s.stop_time && ` → ${s.stop_time}`} · {s.repeat}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                {s.auto_start && <span className="badge-success">Auto Start</span>}
                {s.auto_stop && <span className="badge-warn">Auto Stop</span>}
              </div>
              <button onClick={() => del(s.id)} className="btn-ghost !p-2 hover:!text-red-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Schedule">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Stream Profile</label>
            <select className="input" value={form.profile_id} onChange={(e) => setForm({ ...form, profile_id: e.target.value })}>
              <option value="">Select…</option>
              {pData?.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className="label">Start Time</label><input type="time" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
          </div>
          <div><label className="label">Stop Time (optional)</label><input type="time" className="input" value={form.stop_time} onChange={(e) => setForm({ ...form, stop_time: e.target.value })} /></div>
          <div>
            <label className="label">Repeat</label>
            <div className="grid grid-cols-4 gap-2">
              {(['none', 'daily', 'weekly', 'monthly'] as const).map((r) => (
                <button key={r} type="button" onClick={() => setForm({ ...form, repeat: r })}
                  className={`p-2 rounded-lg border text-sm capitalize ${form.repeat === r ? 'border-brand bg-brand/10 text-brand-light' : 'border-bg-border text-gray-400'}`}>{r}</button>
              ))}
            </div>
          </div>
          {form.repeat === 'weekly' && (
            <div>
              <label className="label">Days</label>
              <div className="flex gap-1 flex-wrap">
                {DAYS.map((d, i) => (
                  <button key={d} type="button" onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 rounded-md text-xs border ${form.days_of_week.includes(i) ? 'border-brand bg-brand/10 text-brand-light' : 'border-bg-border text-gray-400'}`}>{d}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.auto_start} onChange={(e) => setForm({ ...form, auto_start: e.target.checked })} /> Auto Start</label>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.auto_stop} onChange={(e) => setForm({ ...form, auto_stop: e.target.checked })} /> Auto Stop</label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-bg-border">
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Create</button>
          </div>
        </div>
      </Modal>
      <ToastContainer />
    </AppShell>
  );
}
