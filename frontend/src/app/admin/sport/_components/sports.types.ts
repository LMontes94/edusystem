// src/app/admin/sports/_components/sports.types.ts
export type SportViewMode = 'list' | 'groups';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';

export const statusConfig: Record<
  AttendanceStatus,
  { label: string; color: string; bgColor: string }
> = {
  PRESENT:   { label: 'Presente',    color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' },
  ABSENT:    { label: 'Ausente',     color: 'text-red-600',     bgColor: 'bg-red-50 border-red-200'         },
  LATE:      { label: 'Tarde',       color: 'text-amber-600',   bgColor: 'bg-amber-50 border-amber-200'     },
  JUSTIFIED: { label: 'Justificado', color: 'text-blue-600',    bgColor: 'bg-blue-50 border-blue-200'       },
};

export function formatDate(dateStr: string) {
  return dateStr.split('T')[0].split('-').reverse().join('/');
}