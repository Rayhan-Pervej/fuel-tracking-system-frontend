'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading) return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">Loading…</div>;
  if (!user) return null;

  return <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>;
}
