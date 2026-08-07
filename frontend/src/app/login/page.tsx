'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, setToken, getToken } from '@/lib/api';
import { toast, ToastContainer } from '@/components/Toast';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.post<{ token: string }>('/api/auth/login', { username, password });
      setToken(res.token);
      toast('Welcome back!', 'success');
      router.push('/dashboard');
    } catch (e: any) {
      toast(e.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,0,51,0.08),transparent_60%)]" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/30 mb-4">
            <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <h1 className="text-3xl font-bold text-white">LiveStream Hub</h1>
          <p className="text-gray-500 mt-2">Sign in to your streaming dashboard</p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <p className="text-xs text-gray-600 text-center pt-2">
            Default: admin / admin123 — change after first login
          </p>
        </form>
      </div>
      <ToastContainer />
    </div>
  );
}
