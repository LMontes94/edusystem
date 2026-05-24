'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Ellipsis, Users, UserPlus, FileText } from 'lucide-react';
import type { ChatHeaderProps } from './chat.types';

export function ChatHeader({
  room,
  isLoading,
  onViewParticipants,
  onAddParticipants,
  onExportPdf,
}: ChatHeaderProps) {
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

  const hasActions = onViewParticipants || onAddParticipants || onExportPdf;

  return (
    <div className="px-5 py-3 border-b flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold truncate">{name}</h2>
        <p className="text-xs text-muted-foreground">
          {memberCount} {memberCount === 1 ? 'participante' : 'participantes'}
        </p>
      </div>

      {hasActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {onViewParticipants && (
              <DropdownMenuItem onClick={onViewParticipants}>
                <Users className="mr-2 h-4 w-4" />
                Ver participantes
              </DropdownMenuItem>
            )}
            {onAddParticipants && (
              <DropdownMenuItem onClick={onAddParticipants}>
                <UserPlus className="mr-2 h-4 w-4" />
                Agregar participantes
              </DropdownMenuItem>
            )}
            {(onViewParticipants || onAddParticipants) && onExportPdf && (
              <DropdownMenuSeparator />
            )}
            {onExportPdf && (
              <DropdownMenuItem onClick={onExportPdf}>
                <FileText className="mr-2 h-4 w-4" />
                Exportar PDF
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
