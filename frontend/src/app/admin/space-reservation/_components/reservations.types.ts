// src/app/admin/spaces/reservations/_components/reservations.types.ts
import { SpaceReservation } from '@/lib/api/spaces';

export type { SpaceReservation };

export const STATUS_LABEL: Record<SpaceReservation['status'], string> = {
  PENDING:   'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
};

export const STATUS_COLOR: Record<SpaceReservation['status'], string> = {
  PENDING:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-green-100  text-green-800  border-green-200',
  CANCELLED: 'bg-red-100    text-red-800    border-red-200',
};

export const STATUS_DOT: Record<SpaceReservation['status'], string> = {
  PENDING:   'bg-yellow-500',
  CONFIRMED: 'bg-green-500',
  CANCELLED: 'bg-red-500',
};

/** Devuelve "YYYY-MM-DD" desde un Date local sin conversión de timezone */
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Muestra fecha sin conversión de timezone: "15/06/2024" */
export function displayDate(dateStr: string): string {
  return dateStr.split('T')[0].split('-').reverse().join('/');
}

/** Muestra "08:00 - 09:30" */
export function displayTimeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];