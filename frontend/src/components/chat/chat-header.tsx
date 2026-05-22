'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { ChatHeaderProps } from './chat.types';

export function ChatHeader({ room, isLoading }: ChatHeaderProps) {
  if (isLoading) {
    return (
      <div className="px-5 py-3 border-b">
        <Skeleton className="h-5 w-40 mb-1" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  if (!room) return null;

  const name = room.name ?? room.members
    .filter(m => m.user.role !== 'TEACHER')
    .map(m => `${m.user.firstName} ${m.user.lastName}`)
    .join(', ');

  const memberCount = room.members.length;

  return (
    <div className="px-5 py-3 border-b">
      <h2 className="text-sm font-semibold truncate">{name}</h2>
      <p className="text-xs text-muted-foreground">
        {memberCount} {memberCount === 1 ? 'participante' : 'participantes'}
      </p>
    </div>
  );
}
