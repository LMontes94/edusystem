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
import type { NewMessageDialogProps } from './chat.types';

export function NewMessageDialog({ open, onOpenChange, onRoomCreated }: NewMessageDialogProps) {
  const createRoom = useCreateRoom();

  const [type, setType] = useState<'DIRECT' | 'GROUP'>('DIRECT');
  const [name, setName] = useState('');
  const [participantIds, setParticipantIds] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (createRoom.isPending) return;

    const ids = participantIds
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      const room = await createRoom.mutateAsync({
        type,
        name: type === 'GROUP' ? name || undefined : undefined,
        participantIds: ids.length > 0 ? ids : undefined,
      });

      onOpenChange(false);
      setName('');
      setParticipantIds('');

      if (onRoomCreated) {
        onRoomCreated(room.id);
      } else {
        // Navigate to the new room via router if no callback provided
      }
    } catch {
      // Error toast handled by hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva conversación</DialogTitle>
          <DialogDescription>
            Iniciá una conversación directa o grupal
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'DIRECT' | 'GROUP')}>
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
            <Label>Participantes (IDs separados por coma)</Label>
            <Input
              placeholder="uuid-1, uuid-2, uuid-3"
              value={participantIds}
              onChange={(e) => setParticipantIds(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Ingresá los IDs de los usuarios separados por coma
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createRoom.isPending}>
              {createRoom.isPending ? 'Creando...' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
