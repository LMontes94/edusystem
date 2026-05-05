'use client';

import { useState }    from 'react';
import { Button }      from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
}                      from '@/components/ui/dropdown-menu';
import {
  CheckCircleIcon, XCircleIcon, PencilIcon,
  MoreHorizontalIcon, ClockIcon, UserIcon,
  AlignLeftIcon,
}                      from 'lucide-react';
import { useSession }  from 'next-auth/react';
import {
  useCancelReservation,
  useUpdateReservationStatus,
  SpaceReservation,
}                      from '@/lib/api/spaces';
import { STATUS_LABEL, STATUS_DOT, displayTimeRange } from './reservations.types';
import { ReservationDialog } from './reservation-dialog';

interface Props {
  reservation: SpaceReservation;
}

const ADMIN_ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARY'];

/** Convierte hex #rrggbb a rgba con la opacidad dada */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ReservationCard({ reservation }: Props) {
  const { data: session }       = useSession();
  const [editOpen, setEditOpen] = useState(false);

  const cancelReservation = useCancelReservation();
  const updateStatus      = useUpdateReservationStatus();

  const isAdmin   = ADMIN_ROLES.includes(session?.user?.role ?? '');
  const isOwner   = session?.user?.id === reservation.userId;
  const canEdit   = (isOwner || isAdmin) && reservation.status !== 'CANCELLED';
  const canCancel = canEdit;
  const canConfirm = isAdmin && reservation.status === 'PENDING';

  // Color base del espacio — opacidad reducida si está cancelada
  const spaceColor  = reservation.space?.color ?? '#6366f1';
  const isCancelled = reservation.status === 'CANCELLED';
  const bgColor     = hexToRgba(spaceColor, isCancelled ? 0.08 : 0.15);
  const borderColor = hexToRgba(spaceColor, isCancelled ? 0.2  : 0.4);
  const textColor   = isCancelled ? 'opacity-50' : '';

  return (
    <>
      <div
        className={`rounded-md border px-3 py-2 text-xs space-y-1 ${textColor}`}
        style={{ backgroundColor: bgColor, borderColor }}
      >
        {/* Barra de color izquierda + título + menú */}
        <div className="flex items-start gap-1.5">
          {/* Barra lateral con el color del espacio */}
          <span
            className="shrink-0 mt-0.5 w-1 self-stretch rounded-full"
            style={{ backgroundColor: isCancelled ? hexToRgba(spaceColor, 0.3) : spaceColor }}
          />

          <div className="flex-1 min-w-0">
            {/* Título */}
            <div className="flex items-start justify-between gap-1">
              <span className="font-semibold leading-tight line-clamp-1" style={{ color: spaceColor }}>
                {reservation.space?.name}
              </span>
              {(canEdit || canConfirm) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1 -mt-0.5 shrink-0">
                      <MoreHorizontalIcon className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-sm">
                    {canEdit && (
                      <DropdownMenuItem onClick={() => setEditOpen(true)}>
                        <PencilIcon className="h-3.5 w-3.5 mr-2" />
                        Editar
                      </DropdownMenuItem>
                    )}
                    {canConfirm && (
                      <DropdownMenuItem
                        onClick={() => updateStatus.mutate({ id: reservation.id, status: 'CONFIRMED' })}
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5 mr-2" />
                        Confirmar
                      </DropdownMenuItem>
                    )}
                    {canCancel && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => cancelReservation.mutate(reservation.id)}
                        >
                          <XCircleIcon className="h-3.5 w-3.5 mr-2" />
                          Cancelar reserva
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Motivo */}
            <p className="text-muted-foreground line-clamp-1 leading-tight">{reservation.title}</p>

            {/* Horario */}
            <div className="flex items-center gap-1 mt-1 text-muted-foreground">
              <ClockIcon className="h-3 w-3 shrink-0" />
              {displayTimeRange(reservation.startTime, reservation.endTime)}
            </div>

            {/* Quién reservó */}
            <div className="flex items-center gap-1 text-muted-foreground">
              <UserIcon className="h-3 w-3 shrink-0" />
              {reservation.user.firstName} {reservation.user.lastName}
            </div>

            {/* Recursos */}
            {reservation.description && (
              <div className="flex items-start gap-1 text-muted-foreground">
                <AlignLeftIcon className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="line-clamp-1">{reservation.description}</span>
              </div>
            )}

            {/* Status dot */}
            <div className="flex items-center gap-1 text-muted-foreground pt-0.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[reservation.status]}`} />
              {STATUS_LABEL[reservation.status]}
            </div>
          </div>
        </div>
      </div>

      <ReservationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        reservation={reservation}
      />
    </>
  );
}