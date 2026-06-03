import { z } from 'zod';

export const PendingSubjectStatusEnum = z.enum(['ENROLLED', 'COMPLETED', 'NOT_COMPLETED']);
export type PendingSubjectStatus = z.infer<typeof PendingSubjectStatusEnum>;

export interface EligiblePeriod {
  closingGradeId: string;
  subjectId: string;
  subjectName: string;
  periodId: string;
  periodName: string;
  closingScore: number;
}

export interface PendingSubject {
  id: string;
  studentId: string;
  subjectId: string;
  initialSabers?: string;
  march?: string;
  august?: string;
  november?: string;
  december?: string;
  february?: string;
  finalScore?: string;
  closingSabers?: string;
  closingGradeId?: string;
  status: PendingSubjectStatus;
  subject: { id: string; name: string };
  student: { id: string; firstName: string; lastName: string };
  closingGrade?: {
    period: { id: string; name: string };
    courseSubject: { subject: { id: string; name: string } };
  };
}

export type PeriodStatus = 'active' | 'readonly' | 'blocked';

export const statusLabels: Record<PendingSubjectStatus, string> = {
  ENROLLED:      'En curso',
  COMPLETED:     'Completado',
  NOT_COMPLETED: 'No completado',
};

export const statusColors: Record<PendingSubjectStatus, string> = {
  ENROLLED:      'bg-yellow-100 text-yellow-800 border-yellow-300',
  COMPLETED:     'bg-green-100 text-green-800 border-green-300',
  NOT_COMPLETED: 'bg-red-100 text-red-800 border-red-300',
};

export const periodStatusLabels: Record<PeriodStatus, string> = {
  active:   'Activo',
  readonly: 'Solo lectura',
  blocked:  'Bloqueado',
};

export const periodStatusColors: Record<PeriodStatus, string> = {
  active:   'bg-emerald-100 text-emerald-700 border-emerald-300',
  readonly: 'bg-gray-100 text-gray-500 border-gray-300',
  blocked:  'bg-red-100 text-red-400 border-red-200',
};

export const PERIOD_ORDER = ['march', 'august', 'november', 'december', 'february'] as const;

export function getPeriodStatus(
  period: string,
  activePeriod: string,
  allowPrevious: boolean,
  enabled: boolean,
): PeriodStatus {
  if (!enabled) return 'readonly';
  const idx = PERIOD_ORDER.indexOf(period as typeof PERIOD_ORDER[number]);
  const activeIdx = PERIOD_ORDER.indexOf(activePeriod.toLowerCase() as typeof PERIOD_ORDER[number]);
  if (period === activePeriod.toLowerCase()) return 'active';
  if (idx < activeIdx && allowPrevious) return 'active';
  if (idx < activeIdx) return 'readonly';
  return 'blocked';
}
