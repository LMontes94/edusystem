'use client';

import { useEffect, useState } from 'react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
}                   from '@/components/ui/dialog';
import { PlusIcon } from 'lucide-react';
import { useCreateSport, useUpdateSport, Sport } from '@/lib/api/sports';

interface Props {
  sport?:       Sport;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function SportDialog({ sport, open, onOpenChange }: Props) {
  const isEdit = !!sport;
  const [name, setName] = useState('');

  const createSport = useCreateSport();
  const updateSport = useUpdateSport();
  const isPending   = createSport.isPending || updateSport.isPending;

  useEffect(() => {
    if (open) setName(sport?.name ?? '');
  }, [open, sport]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit) {
      await updateSport.mutateAsync({ id: sport.id, data: { name: name.trim() } });
    } else {
      await createSport.mutateAsync({ name: name.trim() });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar deporte' : 'Nuevo deporte'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Fútbol, Vóley, Básquet..."
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateSportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4 mr-1.5" />
        Nuevo deporte
      </Button>
      <SportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}