import { CheckCircle, XCircle, Clock, FileCheck } from 'lucide-react';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';

export type ViewMode = 'take' | 'history' | 'records';

export const statusConfig: Record<
  AttendanceStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  PRESENT:   { label: 'Presente',    color: 'text-emerald-600', icon: CheckCircle },
  ABSENT:    { label: 'Ausente',     color: 'text-red-600',     icon: XCircle     },
  LATE:      { label: 'Tarde',       color: 'text-amber-600',   icon: Clock       },
  JUSTIFIED: { label: 'Justificado', color: 'text-blue-600',    icon: FileCheck   },
};

export function formatDate(dateStr: string) {
  return dateStr.split('T')[0].split('-').reverse().join('/');
}