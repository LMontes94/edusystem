'use client';

import Link from 'next/link';
import { useState }  from 'react';
import { Button }    from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal, KeyRound, UserX, UserCheck, BriefcaseMedical, RotateCcw, UserRoundCog
} from 'lucide-react';
import { useToggleUserStatus } from '@/lib/api/users';
import { useRevokeLeave }      from '@/lib/api/users-leave';
import { LevelRolesButton }    from '@/components/users/level-roles-manager';
import { ResetPasswordDialog } from './reset-password-dialog';
import { LeaveDialog }         from './leave-dialog';
import { User, LEAVE_ALLOWED_ROLES } from './users.types';

interface Props {
  user:         User;
  currentRole:  string;
}

export function UserRowActions({ user, currentRole }: Props) {
  const [resetOpen, setResetOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const canManageLeave  = LEAVE_ALLOWED_ROLES.includes(currentRole);
  const toggleStatus    = useToggleUserStatus();
  const revokeLeave     = useRevokeLeave();

  const isOnLeave  = user.status === 'ON_LEAVE';
  const isInactive = user.status === 'INACTIVE';
  const userName   = `${user.firstName} ${user.lastName}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">

          <DropdownMenuItem onClick={() => setResetOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Cambiar contraseña
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${user.id}`}>
              <UserRoundCog className="mr-2 h-4 w-4" />
                Ver perfil
            </Link>
          </DropdownMenuItem>
          <LevelRolesButton
            user={{ ...user, levelRoles: user.levelRoles ?? [] }}
            canManage={canManageLeave}
          />

          <DropdownMenuSeparator />

          {!isOnLeave && (
            user.status === 'ACTIVE' ? (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => toggleStatus.mutate({ id: user.id, status: 'INACTIVE' })}
              >
                <UserX className="mr-2 h-4 w-4" />
                Desactivar usuario
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => toggleStatus.mutate({ id: user.id, status: 'ACTIVE' })}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Activar usuario
              </DropdownMenuItem>
            )
          )}

          {canManageLeave && !isInactive && (
            <>
              {!isOnLeave && <DropdownMenuSeparator />}
              {isOnLeave ? (
                <DropdownMenuItem
                  className="text-emerald-600 focus:text-emerald-600"
                  onClick={() => revokeLeave.mutate(user.id)}
                  disabled={revokeLeave.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Revocar licencia
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="text-amber-600 focus:text-amber-600"
                  onClick={() => setLeaveOpen(true)}
                >
                  <BriefcaseMedical className="mr-2 h-4 w-4" />
                  Otorgar licencia
                </DropdownMenuItem>
              )}
            </>
          )}

        </DropdownMenuContent>
      </DropdownMenu>

      <ResetPasswordDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        userId={user.id}
        userName={userName}
      />

      <LeaveDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        userId={user.id}
        userName={userName}
      />
    </>
  );
}