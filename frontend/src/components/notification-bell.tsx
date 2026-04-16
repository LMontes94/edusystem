'use client';

import { useState } from 'react';
import { Bell, CheckCheck, BookOpen, Users, Megaphone, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead,
  type Notification,
} from '@/lib/api/notifications';

// ── Icono según tipo ──────────────────────────
function NotifIcon({ type }: { type: Notification['type'] }) {
  const props = { className: 'h-3.5 w-3.5 shrink-0 mt-0.5' };
  switch (type) {
    case 'ATTENDANCE':   return <AlertTriangle {...props} className={`${props.className} text-amber-500`} />;
    case 'GRADE':        return <BookOpen      {...props} className={`${props.className} text-blue-500`}  />;
    case 'ANNOUNCEMENT': return <Megaphone     {...props} className={`${props.className} text-purple-500`}/>;
    case 'CHAT':         return <Users         {...props} className={`${props.className} text-emerald-500`}/>;
    default:             return <Info          {...props} className={`${props.className} text-muted-foreground`}/>;
  }
}

// ── Formato de fecha relativa simple ─────────
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
}

// ── Ítem de notificación ──────────────────────
function NotifItem({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  return (
    <button
      onClick={() => !notif.isRead && onRead(notif.id)}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors border-b last:border-0 ${
        !notif.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
      }`}
    >
      <NotifIcon type={notif.type} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!notif.isRead ? 'font-medium' : 'text-muted-foreground'}`}>
          {notif.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notif.body}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {relativeTime(notif.sentAt)}
        </p>
      </div>
      {!notif.isRead && (
        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
      )}
    </button>
  );
}

// ── Componente principal ──────────────────────
export function NotificationBell() {
  const [open, setOpen]   = useState(false);
  const { data: notifs }  = useNotifications();
  const { data: unread }  = useUnreadCount();
  const markAsRead        = useMarkAsRead();
  const markAllAsRead     = useMarkAllAsRead();

  const unreadCount = unread?.count ?? 0;
  const list        = notifs ?? [];

  function handleRead(id: string) {
    markAsRead.mutate(id);
  }

  function handleReadAll() {
    markAllAsRead.mutate();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0 shadow-lg"
        sideOffset={8}
      >
        {/* Header del panel */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notificaciones</h3>
            {unreadCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 font-medium px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={handleReadAll}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>

        {/* Lista */}
        <ScrollArea className="max-h-[380px]">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Bell className="h-8 w-8 opacity-20" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            list.map((notif) => (
              <NotifItem key={notif.id} notif={notif} onRead={handleRead} />
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        {list.length > 0 && (
          <div className="border-t px-4 py-2.5 text-center">
            <p className="text-xs text-muted-foreground">
              Mostrando las últimas {list.length} notificaciones
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}