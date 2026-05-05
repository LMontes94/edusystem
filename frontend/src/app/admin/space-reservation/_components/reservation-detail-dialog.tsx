'use client';

import { Button }      from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
}                      from '@/components/ui/dialog';
import {
  CheckCircleIcon, XCircleIcon, PencilIcon,
  ClockIcon, UserIcon, AlignLeftIcon, BuildingIcon,
}                      from 'lucide-react';
import {
  useCancelReservation,
  useUpdateReservationStatus,
  SpaceReservation,
}                      from '@/lib/api/spaces';
import {
  STATUS_LABEL, STATUS_DOT,
  displayTimeRange, displayDate,
}                      from './reservations.types';

interface Props {
  reservation:  SpaceReservation;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  canEdit:      boolean;
  canCancel:    boolean;
  canConfirm:   boolean;
  onEdit:       () => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ReservationDetailDialog({
  reservation, open, onOpenChange,
  canEdit, canCancel, canConfirm, onEdit,
}: Props) {
  const cancelReservation = useCancelReservation();
  const updateStatus      = useUpdateReservationStatus();

  const spaceColor = reservation.space?.color ?? '#6366f1';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: spaceColor }}
            />
            <DialogTitle className="text-base">{reservation.space?.name}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="font-medium text-foreground">{reservation.title}</p>

          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[reservation.status]}`} />
            <span className="text-muted-foreground">{STATUS_LABEL[reservation.status]}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <ClockIcon className="h-4 w-4 shrink-0" />
            <span>
              {displayDate(reservation.date)} · {displayTimeRange(reservation.startTime, reservation.endTime)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <UserIcon className="h-4 w-4 shrink-0" />
            <span>{reservation.user.firstName} {reservation.user.lastName}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <BuildingIcon className="h-4 w-4 shrink-0" />
            <span>Cap. {reservation.space?.capacity} personas</span>
          </div>

          {reservation.description && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <AlignLeftIcon className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{reservation.description}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {canConfirm && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-300 hover:bg-green-50"
              onClick={() => {
                updateStatus.mutate({ id: reservation.id, status: 'CONFIRMED' });
                onOpenChange(false);
              }}
            >
              <CheckCircleIcon className="h-4 w-4 mr-1.5" />
              Confirmar
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { onOpenChange(false); onEdit(); }}
            >
              <PencilIcon className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => {
                cancelReservation.mutate(reservation.id);
                onOpenChange(false);
              }}
            >
              <XCircleIcon className="h-4 w-4 mr-1.5" />
              Cancelar reserva
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}