'use client';

import { MessageItem } from './message-item';
import type { MessageGroupProps } from './chat.types';

function formatDateHeading(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Hoy';
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';

  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function MessageGroup({ date, messages, currentUserId }: MessageGroupProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground font-medium shrink-0">
          {formatDateHeading(date)}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isOwn={message.senderId === currentUserId}
        />
      ))}
    </div>
  );
}
