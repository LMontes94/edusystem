'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Archivo: src/components/users/leave-dialog.tsx
// Modal para otorgar licencia a un usuario.
//
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input }  from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, BriefcaseMedical, RotateCcw } from 'lucide-react';
import { useGrantLeave, useRevokeLeave } from '@/lib/api/users-leave';

interface User {
  id:             string;
  firstName:      string;
  lastName:       string;
  status:         string;
  leaveStartDate: string | null;
}

interface Props {
  user: User;
  /** Roles que pueden ver este control — validar también en backend */
  canManage: boolean;
}

export function LeaveActions({ user, canManage }: Props) {
  const [open,      setOpen]      = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  const grantLeave  = useGrantLeave();
  const revokeLeave = useRevokeLeave();

  if (!canManage) return null;

  const isOnLeave = user.status === 'ON_LEAVE';

  async function handleGrant() {
    await grantLeave.mutateAsync({ userId: user.id, startDate });
    setOpen(false);
  }

  async function handleRevoke() {
    await revokeLeave.mutateAsync(user.id);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isOnLeave ? (
            <DropdownMenuItem
              className="text-emerald-600 focus:text-emerald-600"
              onClick={handleRevoke}
              disabled={revokeLeave.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Revocar licencia
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-amber-600 focus:text-amber-600"
              onClick={() => setOpen(true)}
              disabled={user.status === 'INACTIVE'}
            >
              <BriefcaseMedical className="h-4 w-4 mr-2" />
              Otorgar licencia
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog para otorgar licencia */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Otorgar licencia</DialogTitle>
            <DialogDescription>
              {user.firstName} {user.lastName} quedará en licencia y no podrá
              realizar cambios hasta que se revoque.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fecha de inicio</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
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
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge de estado para la tabla de usuarios
// Uso: <UserStatusBadge status={user.status} leaveStartDate={user.leaveStartDate} />
// ─────────────────────────────────────────────────────────────────────────────

export function UserStatusBadge({
  status,
  leaveStartDate,
}: {
  status: string;
  leaveStartDate?: string | null;
}) {
  const config: Record<string, { label: string; className: string }> = {
    ACTIVE:   { label: 'Activo',    className: 'bg-emerald-100 text-emerald-700' },
    INACTIVE: { label: 'Inactivo',  className: 'bg-gray-100 text-gray-600'      },
    SUSPENDED:{ label: 'Suspendido',className: 'bg-red-100 text-red-700'        },
    ON_LEAVE: { label: 'En licencia',className: 'bg-amber-100 text-amber-700'   },
  };

  const { label, className } = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {label}
      </span>
      {status === 'ON_LEAVE' && leaveStartDate && (
        <span className="text-xs text-muted-foreground">
          desde {leaveStartDate.split('T')[0].split('-').reverse().join('/')}
        </span>
      )}
    </div>
  );
}