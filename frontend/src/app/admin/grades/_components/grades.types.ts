import { z } from 'zod';

export const createGradeSchema = z.object({
  studentId:       z.string().min(1, 'Requerido'),
  courseSubjectId: z.string().min(1, 'Requerido'),
  periodId:        z.string().min(1, 'Requerido'),
  score:           z.coerce.number().min(0).max(10),
  type:            z.enum(['EXAM', 'ASSIGNMENT', 'ORAL', 'PROJECT', 'PARTICIPATION']),
  description:     z.string().optional(),
  date:            z.string().min(1, 'Requerido'),
});
export type CreateGradeForm = z.infer<typeof createGradeSchema>;

export const typeLabels: Record<string, string> = {
  EXAM:          'Examen',
  ASSIGNMENT:    'Tarea',
  ORAL:          'Oral',
  PROJECT:       'Proyecto',
  PARTICIPATION: 'Participación',
};

export function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-600';
  if (score >= 4) return 'text-amber-600';
  return 'text-red-600';
}