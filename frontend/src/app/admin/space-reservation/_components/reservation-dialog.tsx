'use client';

import { useEffect, useState }    from 'react';
import { Button }                  from '@/components/ui/button';
import { Input }                   from '@/components/ui/input';
import { Textarea }                from '@/components/ui/textarea';
import { Label }                   from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
}                                  from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
}                                  from '@/components/ui/dialog';
import {
  useSpaces,
  useCreateSpaceReservation,
  useUpdateSpaceReservation,
  SpaceReservation,
}                                  from '@/lib/api/spaces';

interface Props {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  reservation?: SpaceReservation;
  defaultDate?: string;    // "YYYY-MM-DD" — pre-rellena la fecha al clickear un día
  defaultSpaceId?: string; // pre-rellena el espacio si hay filtro activo
}

export function ReservationDialog({
  open, onOpenChange, reservation, defaultDate, defaultSpaceId,
}: Props) {
  const isEdit = !!reservation;

  const [spaceId,     setSpaceId]     = useState('');
  const [date,        setDate]        = useState('');
  const [startTime,   setStartTime]   = useState('');
  const [endTime,     setEndTime]     = useState('');
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');

  const { data: spaces } = useSpaces();
  const createReservation = useCreateSpaceReservation();
  const updateReservation = useUpdateSpaceReservation();
  const isPending = createReservation.isPending || updateReservation.isPending;

  useEffect(() => {
    if (open) {
      setSpaceId(reservation?.spaceId ?? defaultSpaceId ?? '');
      setDate(reservation?.date?.split('T')[0] ?? defaultDate ?? '');
      setStartTime(reservation?.startTime ?? '');
      setEndTime(reservation?.endTime ?? '');
      setTitle(reservation?.title ?? '');
      setDescription(reservation?.description ?? '');
    }
  }, [open, reservation, defaultDate, defaultSpaceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      spaceId,
      date,
      startTime,
      endTime,
      title:       title.trim(),
      description: description.trim() || undefined,
    };
    if (isEdit) {
      await updateReservation.mutateAsync({ id: reservation.id, data });
    } else {
      await createReservation.mutateAsync(data);
    }
    onOpenChange(false);
  }

  const availableSpaces = spaces?.filter(s => s.isAvailable) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar reserva' : 'Nueva reserva'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Espacio — solo al crear */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>Espacio *</Label>
              <Select value={spaceId} onValueChange={setSpaceId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un espacio" />
                </SelectTrigger>
                <SelectContent>
                  {availableSpaces.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — cap. {s.capacity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fecha */}
          <div className="space-y-2">
            <Label htmlFor="date">Fecha *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          {/* Horario */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startTime">Desde *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Hasta *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                min={startTime}
                required
              />
            </div>
          </div>

          {/* Título / motivo */}
          <div className="space-y-2">
            <Label htmlFor="title">Motivo *</Label>
            <Input
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Reunión de padres, Clase de educación física..."
              required
            />
          </div>

          {/* Descripción / recursos */}
          <div className="space-y-2">
            <Label htmlFor="description">Recursos necesarios</Label>
            <Textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej: 30 sillas, 5 mesas, proyector..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || (!isEdit && !spaceId)}>
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Reservar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}