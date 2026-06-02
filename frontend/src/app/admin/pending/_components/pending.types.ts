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
