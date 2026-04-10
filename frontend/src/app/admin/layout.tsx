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
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Star,
  Megaphone,
  LogOut,
  Menu,
  X,
  User,
  FileText,
  ClipboardCheck,
  ListChecks,
  BookText, Clock,
  BarChart2
} from 'lucide-react';
import { useState } from 'react';
import { Session } from 'next-auth';

const navigation = [
  { name: 'Dashboard',   href: '/admin/dashboard',   icon: LayoutDashboard },
  { name: 'Alumnos',     href: '/admin/students',     icon: GraduationCap   },
  { name: 'Cursos',      href: '/admin/courses',      icon: BookOpen        },
  { name: 'Usuarios',    href: '/admin/users',         icon: Users           },
  { name: 'Materias', href: '/admin/subjects', icon: BookOpen },
  { name: 'Asistencia',  href: '/admin/attendance',   icon: ClipboardList   },
  { name: 'Detalle asistencia', href: '/admin/attendance-detail', icon: BarChart2 },
  { name: 'Notas',       href: '/admin/grades',        icon: Star            },
  { name: 'Comunicados', href: '/admin/announcements', icon: Megaphone       },
  { name: 'Indicadores',  href: '/admin/indicators',  icon: ListChecks     },
  { name: 'Evaluaciones', href: '/admin/evaluations',  icon: ClipboardCheck },
  { name: 'Reportes', href: '/admin/reports', icon: FileText },
  { name: '— Panel del docente —', separator:true },
  { name: 'Temario',     href: '/admin/syllabus',  icon: BookText },
  { name: 'Pendientes',  href: '/admin/pending',   icon: Clock    },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname           = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = session?.user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'AD';

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

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r bg-background">
        <SidebarContent
          navigation={navigation}
          pathname={pathname}
          session={session}
          initials={initials}
        />
      </aside>

      {/* ── Sidebar mobile ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-60 bg-background border-r">
            <SidebarContent
              navigation={navigation}
              pathname={pathname}
              session={session}
              initials={initials}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Header */}
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

interface NavItem {
  name: string;
  href?: string;
  icon?: React.ElementType;
  separator?: boolean
}

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
}){
  return (
    <div className="flex h-full flex-col">

      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-4 border-b">
        <span className="font-semibold text-sm">EduSystem</span>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {navigation.map((item, i) => {

    // 👉 1. Separador
    if (item.separator) {
      return (
        <div
          key={`sep-${i}`}
          className="px-3 py-2 text-xs font-semibold text-muted-foreground"
        >
          {item.name}
        </div>
      );
    }

    // 👉 2. Link normal
    const isActive =
      pathname === item.href ||
      (item.href !== '/admin/dashboard' && pathname.startsWith(item.href!));

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
        <p className="text-xs font-medium capitalize">{session?.user?.role?.toLowerCase()}</p>
      </div>
    </div>
  );
}
