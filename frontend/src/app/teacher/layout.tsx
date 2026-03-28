'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  ClipboardList,
  Star,
  Megaphone,
  LogOut,
  Menu,
  X,
  User
} from 'lucide-react';
import { useState } from 'react';
import { Session } from 'next-auth';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { name: 'Dashboard',   href: '/teacher/dashboard',    icon: LayoutDashboard },
  { name: 'Asistencia',  href: '/teacher/attendance',   icon: ClipboardList   },
  { name: 'Notas',       href: '/teacher/grades',        icon: Star            },
  { name: 'Comunicados', href: '/teacher/announcements', icon: Megaphone       },
];

function SidebarContent({
  pathname,
  session,
  initials,
  onClose,
}: {
  pathname: string;
  session:  Session | null;
  initials: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4 border-b">
        <span className="font-semibold text-sm">EduSystem</span>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/teacher/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-4 py-3">
        <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
        <p className="text-xs font-medium capitalize">
          {(session?.user?.role as string)?.toLowerCase()}
        </p>
      </div>
    </div>
  );
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname           = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials =
    session?.user?.name
      ?.split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? 'DO';
  
    const { data: avatarData } = useQuery({
  queryKey: ['avatar', session?.user?.id],
  queryFn:  async () => {
    const res = await api.get(`/users/${session?.user?.id}/avatar-url`);
    return res.data;
  },
  enabled: !!session?.user?.id,
});

  return (
    <div className="flex h-screen bg-muted/30">

      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r bg-background">
        <SidebarContent pathname={pathname} session={session} initials={initials} />
      </aside>

      {/* Sidebar mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-background border-r">
            <SidebarContent
              pathname={pathname}
              session={session}
              initials={initials}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-7 w-7">
  {avatarData?.url && (
    <AvatarImage src={avatarData.url} alt={session?.user?.name ?? ''} />
  )}
  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
</Avatar>
                <span className="hidden sm:block text-sm font-medium">
                  {session?.user?.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
  <Link href="/profile" className="cursor-pointer">
    <User className="mr-2 h-4 w-4" />
    Mi perfil
  </Link>
</DropdownMenuItem>
<DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive cursor-pointer"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}