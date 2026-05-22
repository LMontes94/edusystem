'use client';

import { useState, useMemo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Search, MessageCircle } from 'lucide-react';
import type { RoomListProps } from './chat.types';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatLastMessage(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function RoomList({ rooms, activeRoomId, unreadByRoom, isLoading, onRoomClick }: RoomListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!rooms) return [];
    if (!search.trim()) return rooms;
    const q = search.toLowerCase();
    return rooms.filter((room) => {
      const name = room.name ?? room.members.map(m => `${m.user.firstName} ${m.user.lastName}`).join(' ');
      return name.toLowerCase().includes(q);
    });
  }, [rooms, search]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
        <MessageCircle className="h-10 w-10 mb-2 opacity-40" />
        <p className="text-sm font-medium">No hay conversaciones</p>
        <p className="text-xs mt-1 text-center">Iniciá una nueva conversación desde el menú</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar conversación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto space-y-0.5 p-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No se encontraron conversaciones
          </p>
        ) : (
          filtered.map((room) => {
            const isActive = room.id === activeRoomId;
            const otherMembers = room.members.filter(m => m.user.role !== 'TEACHER');
            const displayName = room.name ?? otherMembers.map(m => `${m.user.firstName} ${m.user.lastName}`).join(', ');
            const firstMember = otherMembers[0]?.user;
            const unread = unreadByRoom?.[room.id] ?? 0;

            return (
              <button
                key={room.id}
                onClick={() => onRoomClick(room.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isActive
                    ? 'bg-accent'
                    : 'hover:bg-accent/50'
                }`}
              >
                <Avatar size="default">
                  <AvatarFallback>
                    {firstMember ? initials(firstMember.firstName, firstMember.lastName) : '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{displayName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatLastMessage(room.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">
                      {room.type === 'GROUP' ? 'Grupal' : `${otherMembers.length} participante${otherMembers.length !== 1 ? 's' : ''}`}
                    </span>
                    {unread > 0 && (
                      <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px]">
                        {unread > 99 ? '99+' : unread}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
