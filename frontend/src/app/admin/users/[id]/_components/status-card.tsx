'use client';

import { useState }  from 'react';
import { Badge }     from '@/components/ui/badge';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Activity, UserX, UserCheck, BriefcaseMedical, RotateCcw, KeyRound,
} from 'lucide-react';
import { useToggleUserStatus } from '@/lib/api/users';
import { useGrantLeave, useRevokeLeave } from '@/lib/api/users-leave';
import { useResetPassword } from '@/lib/api/users';
import { LEAVE_ALLOWED_ROLES } from '../../_components/users.types';

interface Props {
  user: {
    id:             string;
    status:         string;
    leaveStartDate?: string | null;
  };
  currentRole: string;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; color: string }> = {
    ACTIVE:    { label: 'Activo',       variant: 'default',     color: 'text-emerald-600' },
    INACTIVE:  { label: 'Inactivo',     variant: 'secondary',   color: 'text-gray-500'    },
    SUSPENDED: { label: 'Suspendido',   variant: 'destructive', color: 'text-red-600'     },
    ON_LEAVE:  { label: 'En licencia',  variant: 'secondary',   color: 'text-amber-600'   },
  };
  const c = config[status] ?? config.INACTIVE;
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function StatusCard({ user, currentRole }: Props) {
  const [leaveDialog,  setLeaveDialog]  = useState(false);
  const [resetDialog,  setResetDialog]  = useState(false);
  const [startDate,    setStartDate]    = useState(new Date().toISOString().split('T')[0]);
  const [newPassword,  setNewPassword]  = useState('');
  const [confirmPass,  setConfirmPass]  = useState('');

  const canManageLeave = LEAVE_ALLOWED_ROLES.includes(currentRole);
  const isOnLeave      = user.status === 'ON_LEAVE';
  const isInactive     = user.status === 'INACTIVE';

  const toggleStatus = useToggleUserStatus();
  const grantLeave   = useGrantLeave();
  const revokeLeave  = useRevokeLeave();
  const resetPassword = useResetPassword();

  async function handleGrantLeave() {
    await grantLeave.mutateAsync({ userId: user.id, startDate });
    setLeaveDialog(false);
  }

  async function handleResetPassword() {
    if (newPassword !== confirmPass || newPassword.length < 8) return;
    await resetPassword.mutateAsync({ id: user.id, password: newPassword });
    setResetDialog(false);
    setNewPassword('');
    setConfirmPass('');
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Estado de la cuenta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Estado actual */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Estado actual</p>
              <StatusBadge status={user.status} />
              {isOnLeave && user.leaveStartDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  desde {user.leaveStartDate.split('T')[0].split('-').reverse().join('/')}
                </p>
              )}
            </div>
          </div>

          {/* Acciones de estado */}
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Acciones</p>

            {/* Activar / Desactivar */}
            {!isOnLeave && (
              user.status === 'ACTIVE' ? (
                <Button
                  size="sm" variant="outline" className="w-full justify-start text-destructive"
                  onClick={() => toggleStatus.mutate({ id: user.id, status: 'INACTIVE' })}
                  disabled={toggleStatus.isPending}
                >
                  <UserX className="h-3.5 w-3.5 mr-2" />
                  Desactivar usuario
                </Button>
              ) : (
                <Button
                  size="sm" variant="outline" className="w-full justify-start"
                  onClick={() => toggleStatus.mutate({ id: user.id, status: 'ACTIVE' })}
                  disabled={toggleStatus.isPending}
                >
                  <UserCheck className="h-3.5 w-3.5 mr-2" />
                  Activar usuario
                </Button>
              )
            )}

            {/* Licencia */}
            {canManageLeave && !isInactive && (
              isOnLeave ? (
                <Button
                  size="sm" variant="outline" className="w-full justify-start text-emerald-600"
                  onClick={() => revokeLeave.mutate(user.id)}
                  disabled={revokeLeave.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                  Revocar licencia
                </Button>
              ) : (
                <Button
                  size="sm" variant="outline" className="w-full justify-start text-amber-600"
                  onClick={() => setLeaveDialog(true)}
                >
                  <BriefcaseMedical className="h-3.5 w-3.5 mr-2" />
                  Otorgar licencia
                </Button>
              )
            )}

            {/* Reset password */}
            <Button
              size="sm" variant="outline" className="w-full justify-start"
              onClick={() => setResetDialog(true)}
            >
              <KeyRound className="h-3.5 w-3.5 mr-2" />
              Cambiar contraseña
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog licencia */}
      <Dialog open={leaveDialog} onOpenChange={setLeaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Otorgar licencia</DialogTitle>
            <DialogDescription>
              El usuario quedará en licencia y no podrá realizar cambios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fecha de inicio</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLeaveDialog(false)}>Cancelar</Button>
              <Button
                onClick={handleGrantLeave}
                disabled={!startDate || grantLeave.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {grantLeave.isPending ? 'Guardando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog reset password */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nueva contraseña</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Confirmar contraseña</label>
              <Input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className={confirmPass && newPassword !== confirmPass ? 'border-red-400' : ''}
              />
              {confirmPass && newPassword !== confirmPass && (
                <p className="text-xs text-red-500">Las contraseñas no coinciden</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetDialog(false)}>Cancelar</Button>
              <Button
                onClick={handleResetPassword}
                disabled={newPassword.length < 8 || newPassword !== confirmPass || resetPassword.isPending}
              >
                {resetPassword.isPending ? 'Guardando...' : 'Actualizar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}