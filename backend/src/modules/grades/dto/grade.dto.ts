import { z } from 'zod';

export const CreateGradeSchema = z.object({
  studentId:       z.string().uuid(),
  courseSubjectId: z.string().uuid(),
  periodId:        z.string().uuid(),
  score:           z.number().min(0).max(10).multipleOf(0.01),
  type:            z.enum(['EXAM', 'ASSIGNMENT', 'ORAL', 'PROJECT', 'PARTICIPATION']),
  description:     z.string().max(200).optional(),
  date:            z.string().date(),
});
export type CreateGradeDto = z.infer<typeof CreateGradeSchema>;

export const UpdateGradeSchema = z.object({
  score:       z.number().min(0).max(10).multipleOf(0.01).optional(),
  type:        z.enum(['EXAM', 'ASSIGNMENT', 'ORAL', 'PROJECT', 'PARTICIPATION']).optional(),
  description: z.string().max(200).optional(),
  date:        z.string().date().optional(),
});
export type UpdateGradeDto = z.infer<typeof UpdateGradeSchema>;

export const GradeQuerySchema = z.object({
  studentId:       z.string().uuid().optional(),
  courseSubjectId: z.string().uuid().optional(),
  periodId:        z.string().uuid().optional(),
});
export type GradeQueryDto = z.infer<typeof GradeQuerySchema>;
