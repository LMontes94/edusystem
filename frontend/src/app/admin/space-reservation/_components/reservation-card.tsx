'use client';

import { useState }   from 'react';
import { useAppSession } from '@/lib/hooks/use-app-session';  
import { SpaceReservation } from '@/lib/api/spaces';
import { ReservationDetailDialog } from './reservation-detail-dialog';
import { ReservationDialog }       from './reservation-dialog';

interface Props {
  reservation: SpaceReservation;
}

const ADMIN_ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARY'];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ReservationCard({ reservation }: Props) {
  const { data: session }           = useAppSession();
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);

  const isAdmin    = ADMIN_ROLES.includes(session?.user?.role ?? '');
  const isOwner    = session?.user?.id === reservation.userId;
  const canEdit    = (isOwner || isAdmin) && reservation.status !== 'CANCELLED';
  const canConfirm = isAdmin && reservation.status === 'PENDING';

  const spaceColor  = reservation.space?.color ?? '#6366f1';
  const isCancelled = reservation.status === 'CANCELLED';
  const bgColor     = hexToRgba(spaceColor, isCancelled ? 0.08 : 0.15);
  const borderColor = hexToRgba(spaceColor, isCancelled ? 0.15 : 0.35);

  return (
    <>
      {/* Chip compacto */}
      <button onClick={() => setDetailOpen(true)} className="w-full text-left">
        <div
          className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs border transition-opacity hover:opacity-80 ${isCancelled ? 'opacity-50' : ''}`}
          style={{ backgroundColor: bgColor, borderColor }}
        >
          <span className="shrink-0 h-2 w-2 rounded-full" style={{ backgroundColor: spaceColor }} />
          <span className="font-medium truncate" style={{ color: spaceColor }}>
            {reservation.space?.name}
          </span>
          <span className="shrink-0 text-muted-foreground ml-auto">{reservation.startTime}</span>
        </div>
      </button>

      <ReservationDetailDialog
        reservation={reservation}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canEdit={canEdit}
        canCancel={canEdit}
        canConfirm={canConfirm}
        onEdit={() => setEditOpen(true)}
      />

      <ReservationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        reservation={reservation}
      />
    </>
  );
}

