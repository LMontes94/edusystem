'use client';

import { useState } from 'react';
import { useCreateRoom } from '@/hooks/chat/use-create-room';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserSelector } from './user-selector';
import type { NewMessageDialogProps } from './chat.types';
import type { User } from '@/lib/api/users';

export function NewMessageDialog({ open, onOpenChange, onRoomCreated }: NewMessageDialogProps) {
  const createRoom = useCreateRoom();

  const [type, setType] = useState<'DIRECT' | 'GROUP'>('DIRECT');
  const [name, setName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  function handleSelect(user: User) {
    if (type === 'DIRECT') {
      setSelectedUsers([user]);
    } else {
      setSelectedUsers((prev) => [...prev, user]);
    }
  }

  function handleRemove(userId: string) {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  function reset() {
    setName('');
    setSelectedUsers([]);
    setType('DIRECT');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (createRoom.isPending) return;

    const participantIds = selectedUsers.map((u) => u.id);

    try {
      const room = await createRoom.mutateAsync({
        type,
        name: type === 'GROUP' ? name || undefined : undefined,
        participantIds: participantIds.length > 0 ? participantIds : undefined,
      });

      onOpenChange(false);
      reset();

      if (onRoomCreated) {
        onRoomCreated(room.id);
      }
    } catch {
      // Error toast handled by hook
    }
  }

  const isValid =
    (type === 'DIRECT' && selectedUsers.length === 1) ||
    (type === 'GROUP' && selectedUsers.length >= 2 && name.trim().length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva conversación</DialogTitle>
          <DialogDescription>
            Iniciá una conversación directa o grupal
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as 'DIRECT' | 'GROUP');
                if (v === 'DIRECT') setSelectedUsers([]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DIRECT">Directo</SelectItem>
                <SelectItem value="GROUP">Grupal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'GROUP' && (
            <div className="space-y-2">
              <Label>Nombre del grupo</Label>
              <Input
                placeholder="Ej: Equipo de matemática"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Participantes</Label>
            <UserSelector
              selectedUsers={selectedUsers}
              onSelect={handleSelect}
              onRemove={handleRemove}
            />
            {type === 'DIRECT' && selectedUsers.length !== 1 && (
              <p className="text-xs text-destructive">Seleccioná 1 participante</p>
            )}
            {type === 'GROUP' && selectedUsers.length < 2 && (
              <p className="text-xs text-destructive">Seleccioná al menos 2 participantes</p>
            )}
            {type === 'GROUP' && selectedUsers.length >= 2 && name.trim().length === 0 && (
              <p className="text-xs text-destructive">El nombre del grupo es requerido</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createRoom.isPending || !isValid}>
              {createRoom.isPending ? 'Creando...' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
