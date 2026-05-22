'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { MessageItemProps } from './chat.types';

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function MessageItem({ message, isOwn }: MessageItemProps) {
  const senderName = `${message.sender.firstName} ${message.sender.lastName}`;
  const time = formatTime(message.sentAt);

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar size="sm" className="mt-1 shrink-0">
        <AvatarFallback>{initials(message.sender.firstName, message.sender.lastName)}</AvatarFallback>
      </Avatar>

      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-xl px-3 py-2 text-sm ${
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted rounded-bl-sm'
        }`}>
          {!isOwn && (
            <p className="text-[10px] font-medium opacity-70 mb-0.5">{senderName}</p>
          )}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{time}</span>
      </div>
    </div>
  );
}
