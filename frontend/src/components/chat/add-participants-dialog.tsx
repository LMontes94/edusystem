'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { UserSelector } from './user-selector';
import { addParticipants, fetchParticipants } from '@/lib/api/chat';
import type { AddParticipantsDialogProps } from './chat.types';
import type { User } from '@/lib/api/users';

export function AddParticipantsDialog({ roomId, open, onOpenChange }: AddParticipantsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  const { data: membersData } = useQuery({
    queryKey: ['chat', 'rooms', roomId, 'members'],
    queryFn: () => fetchParticipants(roomId),
    enabled: open,
  });

  const existingIds = useMemo(() => {
    if (!membersData) return new Set<string>();
    return new Set(membersData.participants.map((p) => p.user.id));
  }, [membersData]);

  const addMutation = useMutation({
    mutationFn: (userIds: string[]) => addParticipants(roomId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms', roomId] });
      toast.success('Participantes agregados');
      onOpenChange(false);
      setSelectedUsers([]);
    },
    onError: () => toast.error('Error al agregar participantes'),
  });

  function handleSelect(user: User) {
    if (!existingIds.has(user.id)) {
      setSelectedUsers((prev) => [...prev, user]);
    }
  }

  function handleRemove(userId: string) {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (addMutation.isPending || selectedUsers.length === 0) return;

    await addMutation.mutateAsync(selectedUsers.map((u) => u.id));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) { setSelectedUsers([]); }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar participantes</DialogTitle>
          <DialogDescription>
            Buscá y seleccioná usuarios para agregar a la conversación
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <UserSelector
              selectedUsers={selectedUsers}
              onSelect={handleSelect}
              onRemove={handleRemove}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={addMutation.isPending || selectedUsers.length === 0}>
              {addMutation.isPending ? 'Agregando...' : 'Agregar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
