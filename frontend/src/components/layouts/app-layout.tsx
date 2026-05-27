'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './components/sidebar';
import { AppHeader } from './components/app-header';
import { LeaveBanner } from '@/components/leave-banner';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader />
          <LeaveBanner />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
