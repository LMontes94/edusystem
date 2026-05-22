'use client';

import Link                from 'next/link';
import { signOut }         from 'next-auth/react';
import { useQuery }        from '@tanstack/react-query';
import { api }             from '@/lib/api';
import { useAppSession }   from '@/lib/hooks/use-app-session';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button }          from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, User, Settings, LogOut } from 'lucide-react';
import { ChatHeaderBell } from '@/components/chat/chat-header-popover';
import { NotificationBell } from '@/components/notification-bell';

interface Props {
  onMobileMenuOpen: () => void;
}

export function AppHeader({ onMobileMenuOpen }: Props) {
  const { data: session } = useAppSession();

  const appUser = session?.user as { id?: string; role?: string } | undefined;
  const role    = appUser?.role;
  const isAdmin = ['ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role ?? '');
  const userId  = appUser?.id;

  const initials = session?.user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '??';

  const { data: avatarData } = useQuery({
    queryKey: ['avatar', userId],
    queryFn:  async () => {
      const res = await api.get(`/users/${userId}/avatar-url`);
      return res.data;
    },
    enabled:   !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 shrink-0">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMobileMenuOpen}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <ChatHeaderBell />
      <NotificationBell />

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
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Configuración
                </Link>
              </DropdownMenuItem>
            </>
          )}
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
  );
}