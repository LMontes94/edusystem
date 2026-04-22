'use client';

import Link            from 'next/link';
import { signOut }     from 'next-auth/react';
import { useQuery }    from '@tanstack/react-query';
import { useSession }  from 'next-auth/react';
import { api }         from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, User, Settings, LogOut } from 'lucide-react';
import { NotificationBell } from '@/components/notification-bell';

interface HeaderProps {
  onMobileMenuOpen: () => void;
}

export function AdminHeader({ onMobileMenuOpen }: HeaderProps) {
  const { data: session } = useSession();

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
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 shrink-0">
      {/* Botón mobile */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMobileMenuOpen}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      {/* Campana */}
      <NotificationBell />

      {/* Avatar + menú */}
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
          <DropdownMenuItem asChild>
            <Link href="/admin/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Configuración
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
  );
}