'use client';

import { AppLayout } from '@/components/layouts/app-layout';

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
