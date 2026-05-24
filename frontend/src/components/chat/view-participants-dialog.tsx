'use client';

import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchParticipants } from '@/lib/api/chat';
import type { ViewParticipantsDialogProps } from './chat.types';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const roleLabel: Record<string, string> = {
  TEACHER: 'Docente',
  PRECEPTOR: 'Preceptor',
  SECRETARY: 'Secretario/a',
  DIRECTOR: 'Director',
  ADMIN: 'Admin',
  GUARDIAN: 'Tutor/a',
};

const levelLabel: Record<string, string> = {
  INICIAL: 'Inicial',
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
};

export function ViewParticipantsDialog({ roomId, open, onOpenChange }: ViewParticipantsDialogProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['chat', 'rooms', roomId, 'members'],
    queryFn: () => fetchParticipants(roomId),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Participantes</DialogTitle>
          <DialogDescription>
            Miembros de esta conversación
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive text-center py-4">
            Error al cargar participantes
          </p>
        )}

        {data && (
          <ScrollArea className="max-h-96">
            <div className="space-y-4 py-2">
              {data.creator && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback>{initials(data.creator.firstName, data.creator.lastName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {data.creator.firstName} {data.creator.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabel[data.creator.role] ?? data.creator.role}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Creador
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Creado: {new Date(data.createdAt).toLocaleDateString('es-AR')}</span>
                {data.level && (
                  <>
                    <span>·</span>
                    <Badge variant="outline" className="text-[10px]">
                      {levelLabel[data.level] ?? data.level}
                    </Badge>
                  </>
                )}
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {data.participants.length} {data.participants.length === 1 ? 'participante' : 'participantes'}
                </p>

                <div className="space-y-2">
                  {data.participants.map((member) => (
                    <div key={member.user.id} className="flex items-center gap-3 p-1.5 rounded-lg">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs">
                          {initials(member.user.firstName, member.user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {member.user.firstName} {member.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {roleLabel[member.user.role] ?? member.user.role}
                          {member.addedBy && (
                            <span className="ml-1 text-[10px]">
                              (agregado por {member.addedBy.firstName} {member.addedBy.lastName})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
