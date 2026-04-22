'use client';

// src/components/layouts/sidebar.tsx

import Link            from 'next/link';
import { usePathname } from 'next/navigation';
import { cn }          from '@/lib/utils';
import { Button }      from '@/components/ui/button';
import { X }           from 'lucide-react';
import { Session }     from 'next-auth';
import { SidebarBrand }           from './sidebar-brand';
import { getNavigation, getDashboardHref } from '../navigation';

interface Props {
  session:  Session | null;
  onClose?: () => void;
}

export function AppSidebar({ session, onClose }: Props) {
  const pathname      = usePathname();
  const role          = (session?.user as any)?.role as string | undefined;
  const nav           = getNavigation(role);
  const dashboardHref = getDashboardHref(role);

  return (
    <div className="flex h-full flex-col">

      {/* Branding */}
      <div className="border-b">
        <div className="flex items-center justify-between pr-2">
          <SidebarBrand session={session} />
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {nav.map((item, i) => {
          if (item.separator) {
            return (
              <div key={`sep-${i}`} className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground">
                {item.name}
              </div>
            );
          }

          const isActive =
            pathname === item.href ||
            (item.href !== dashboardHref && pathname.startsWith(item.href!));

          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t px-4 py-3">
        <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
        <p className="text-xs font-medium capitalize">{role?.toLowerCase()}</p>
      </div>
    </div>
  );
}