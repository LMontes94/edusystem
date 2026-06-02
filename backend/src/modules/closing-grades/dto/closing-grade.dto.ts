import { z } from 'zod';

export const ClosePeriodSchema = z.object({
  studentId:       z.string().uuid(),
  courseSubjectId: z.string().uuid(),
  periodId:        z.string().uuid(),
  closingScore:    z.number().min(0).max(10).multipleOf(0.01, 'La nota debe tener hasta 2 decimales'),
}).strict();
export type ClosePeriodDto = z.infer<typeof ClosePeriodSchema>;

export const ReopenPeriodSchema = z.object({
  reopenReason: z.string().min(1, 'El motivo es requerido').max(500),
}).strict();
export type ReopenPeriodDto = z.infer<typeof ReopenPeriodSchema>;

export const ClosingGradeQuerySchema = z.object({
  studentId:       z.string().uuid().optional(),
  courseSubjectId: z.string().uuid().optional(),
  periodId:        z.string().uuid().optional(),
  isClosed:        z.coerce.boolean().optional(),
});
export type ClosingGradeQueryDto = z.infer<typeof ClosingGradeQuerySchema>;
