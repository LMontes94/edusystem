import { z } from 'zod';

export const UpsertObservationSchema = z.object({
  studentId:   z.string().uuid(),
  periodId:    z.string().uuid(),
  courseId:    z.string().uuid(),
  subjectId:   z.string().uuid().optional(),
  observation: z.string().min(1, 'La observación no puede estar vacía').max(500),
}).strict();

export type UpsertObservationDto = z.infer<typeof UpsertObservationSchema>;
