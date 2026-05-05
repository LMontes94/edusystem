
import { Space, SpaceReservation } from '@/lib/api/spaces';

export type { Space, SpaceReservation };

export const RESERVATION_STATUS_LABEL: Record<SpaceReservation['status'], string> = {
  PENDING:   'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
};

export const RESERVATION_STATUS_VARIANT: Record<
  SpaceReservation['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING:   'secondary',
  CONFIRMED: 'default',
  CANCELLED: 'destructive',
};