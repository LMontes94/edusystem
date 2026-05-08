'use client';

import { useAppSession } from '@/lib/hooks/use-app-session';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useAppSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}

