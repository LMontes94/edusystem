'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useChatRooms } from '@/hooks/chat/use-chat-rooms';
import { useChatUnreadCount } from '@/hooks/chat/use-chat-unread';
import { useAppSession } from '@/lib/hooks/use-app-session';
import type { ChatRoom } from '@/lib/api/chat';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7)   return `hace ${days}d`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function roomDisplayName(room: ChatRoom): string {
  if (room.name) return room.name;
  return room.members
    .map(m => `${m.user.firstName} ${m.user.lastName}`)
    .join(', ');
}

function RoomItem({ room, unread, onNavigate }: { room: ChatRoom; unread: number; onNavigate: (roomId: string) => void }) {
  const firstMember = room.members[0]?.user;

  return (
    <button
      onClick={() => onNavigate(room.id)}
      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b last:border-0"
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">
          {firstMember ? initials(firstMember.firstName, firstMember.lastName) : '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">
            {roomDisplayName(room)}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {relativeTime(room.lastMessageAt)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground/80 truncate">
          {room.type === 'GROUP' ? 'Conversación grupal' : 'Conversación directa'}
        </p>
      </div>
      {unread > 0 && (
        <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px] shrink-0">
          {unread > 99 ? '99+' : unread}
        </Badge>
      )}
    </button>
  );
}

export function ChatHeaderBell() {
  const [open, setOpen] = useState(false);
  const { data: session } = useAppSession();
  const router = useRouter();

  const appUser = session?.user as { role?: string } | undefined;
  const role    = appUser?.role;
  const isAdmin = ['ADMIN', 'DIRECTOR', 'SECRETARY', 'PRECEPTOR'].includes(role ?? '');
  const chatBaseHref = isAdmin ? '/admin/chat' : '/teacher/chat';

  const { data: roomsData, isLoading: roomsLoading } = useChatRooms({ limit: 10 });
  const { data: unreadData } = useChatUnreadCount();

  const rooms = roomsData?.rooms ?? [];
  const unreadTotal = unreadData?.total ?? 0;
  const unreadByRoom = unreadData?.rooms ?? [];

  function unreadForRoom(roomId: string): number {
    return unreadByRoom.find(r => r.roomId === roomId)?.unreadCount ?? 0;
  }

  function handleRoomClick(roomId: string) {
    setOpen(false);
    router.push(`${chatBaseHref}/${roomId}`);
  }

  function handleViewAll() {
    setOpen(false);
    router.push(chatBaseHref);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <MessageCircle className="h-4 w-4" />
          {unreadTotal > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0 shadow-lg"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Mensajes</h3>
            {unreadTotal > 0 && (
              <span className="text-xs bg-red-100 text-red-600 font-medium px-1.5 py-0.5 rounded-full">
                {unreadTotal}
              </span>
            )}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="max-h-[380px]">
          {roomsLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">Cargando...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <MessageSquare className="h-8 w-8 opacity-20" />
              <p className="text-sm">Sin conversaciones</p>
            </div>
          ) : (
            rooms.map((room) => (
              <RoomItem
                key={room.id}
                room={room}
                unread={unreadForRoom(room.id)}
                onNavigate={handleRoomClick}
              />
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        {rooms.length > 0 && (
          <div className="border-t px-4 py-2.5 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground w-full"
              onClick={handleViewAll}
            >
              Ver todas las conversaciones
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
