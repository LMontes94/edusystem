'use client';

import { useState }      from 'react';
import { useSession }    from 'next-auth/react';
import { AdminHeader }   from './_components/header';
import { SidebarContent} from './_components/sidebar';
import { LeaveBanner }   from '@/components/leave-banner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session }               = useSession();
  const [mobileOpen, setMobileOpen]     = useState(false);

  return (
    <div className="flex h-screen bg-muted/30">

      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r bg-background">
        <SidebarContent session={session} />
      </aside>

      {/* Sidebar mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-background border-r">
            <SidebarContent session={session} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <LeaveBanner />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

    </div>
  );
}