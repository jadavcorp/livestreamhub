'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
    else router.replace('/login');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="animate-pulse text-gray-500">Loading…</div>
    </div>
  );
}
