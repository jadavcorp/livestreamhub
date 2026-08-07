'use client';

import { create } from 'zustand';
import { useEffect } from 'react';

interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string; }
interface ToastStore { toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; remove: (id: number) => void; }

let nextId = 1;
export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function ToastContainer() {
  const { toasts, remove } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} onClick={() => remove(t.id)}
          className={`animate-slide-up cursor-pointer px-4 py-3 rounded-lg shadow-2xl border text-sm max-w-sm ${
            t.type === 'success' ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100' :
            t.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' :
            'bg-bg-card border-bg-border text-white'
          }`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  useToast.getState().push({ message, type });
}
