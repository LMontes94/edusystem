import { z } from 'zod';

export const EvaluationValue = z.enum(['LFD', 'LS', 'LP', 'ANL']);
export type EvaluationValue = z.infer<typeof EvaluationValue>;

export const BulkEvaluationSchema = z.object({
  evaluations: z.array(z.object({
    indicatorId: z.string().uuid(),
    studentId:   z.string().uuid(),
    periodId:    z.string().uuid(),
    value:       EvaluationValue,
  })).min(1, 'Debe haber al menos una evaluación'),
}).strict();
export type BulkEvaluationDto = z.infer<typeof BulkEvaluationSchema>;

export const CreateObservationSchema = z.object({
  studentId:   z.string().uuid(),
  periodId:    z.string().uuid(),
  courseId:    z.string().uuid(),
  observation: z.string().min(1, 'La observación no puede estar vacía').max(500),
}).strict();
export type CreateObservationDto = z.infer<typeof CreateObservationSchema>;
