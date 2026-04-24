'use client';

import { useState }  from 'react';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useGrantLeave } from '@/lib/api/users-leave';

interface Props {
  open:     boolean;
  onClose:  () => void;
  userId:   string;
  userName: string;
}

export function LeaveDialog({ open, onClose, userId, userName }: Props) {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const grantLeave = useGrantLeave();

  async function handleGrant() {
    await grantLeave.mutateAsync({ userId, startDate });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Otorgar licencia</DialogTitle>
          <DialogDescription>
            {userName} quedará en licencia y no podrá realizar cambios.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fecha de inicio</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={handleGrant}
              disabled={!startDate || grantLeave.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {grantLeave.isPending ? 'Guardando...' : 'Confirmar licencia'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}