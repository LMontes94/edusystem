'use client';

import { useEffect, useState }    from 'react';
import { Button }                  from '@/components/ui/button';
import { Input }                   from '@/components/ui/input';
import { Textarea }                from '@/components/ui/textarea';
import { Label }                   from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
}                                  from '@/components/ui/dialog';
import { useCreateSpace, useUpdateSpace, Space } from '@/lib/api/spaces';
import { PlusIcon, CheckIcon }     from 'lucide-react';
import { cn }                      from '@/lib/utils';

// Paleta de colores predefinidos — lo suficientemente distintos para distinguir espacios
const PALETTE = [
  { hex: '#6366f1', label: 'Índigo'    },
  { hex: '#0ea5e9', label: 'Cielo'     },
  { hex: '#10b981', label: 'Esmeralda' },
  { hex: '#f59e0b', label: 'Ámbar'     },
  { hex: '#ef4444', label: 'Rojo'      },
  { hex: '#ec4899', label: 'Rosa'      },
  { hex: '#8b5cf6', label: 'Violeta'   },
  { hex: '#14b8a6', label: 'Teal'      },
  { hex: '#f97316', label: 'Naranja'   },
  { hex: '#84cc16', label: 'Lima'      },
  { hex: '#06b6d4', label: 'Cian'      },
  { hex: '#64748b', label: 'Pizarra'   },
];

interface Props {
  space?: Space;
  open:   boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpaceDialog({ space, open, onOpenChange }: Props) {
  const isEdit = !!space;

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [capacity,    setCapacity]    = useState('');
  const [color,       setColor]       = useState(PALETTE[0].hex);

  const createSpace = useCreateSpace();
  const updateSpace = useUpdateSpace();
  const isPending   = createSpace.isPending || updateSpace.isPending;

  useEffect(() => {
    if (open) {
      setName(space?.name ?? '');
      setDescription(space?.description ?? '');
      setCapacity(space?.capacity?.toString() ?? '');
      setColor(space?.color ?? PALETTE[0].hex);
    }
  }, [open, space]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name:        name.trim(),
      description: description.trim() || undefined,
      capacity:    Number(capacity),
      color,
    };
    if (isEdit) {
      await updateSpace.mutateAsync({ id: space.id, data });
    } else {
      await createSpace.mutateAsync(data);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar espacio' : 'Nuevo espacio'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Gimnasio, Sala de reuniones..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacidad *</Label>
            <Input
              id="capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
              placeholder="Ej: 30"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Color en el calendario</Label>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map(({ hex, label }) => (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  onClick={() => setColor(hex)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110',
                    color === hex ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: hex }}
                >
                  {color === hex && (
                    <CheckIcon className="h-3.5 w-3.5 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
            {/* Preview */}
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-muted-foreground">
                {PALETTE.find(p => p.hex === color)?.label ?? color}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Equipamiento disponible, observaciones..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear espacio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateSpaceButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4 mr-1.5" />
        Nuevo espacio
      </Button>
      <SpaceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}