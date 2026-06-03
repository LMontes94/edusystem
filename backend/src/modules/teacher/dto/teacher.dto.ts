import { z } from 'zod';

export const IntensificationResultSchema = z.enum(['AA', 'CCA', 'CSA']);

export const CreatePendingSubjectSchema = z.object({
  closingGradeId: z.string().uuid(),
}).strict();

export type CreatePendingSubjectDto = z.infer<typeof CreatePendingSubjectSchema>;

export const UpdatePendingStatusSchema = z.object({
  status: z.enum(['ENROLLED', 'COMPLETED', 'NOT_COMPLETED']),
}).strict();

export type UpdatePendingStatusDto = z.infer<typeof UpdatePendingStatusSchema>;

export const UpdatePendingProgressSchema = z.object({
  initialSabers: z.string().max(500).nullable().optional(),
  march:         IntensificationResultSchema.nullable().optional(),
  august:        IntensificationResultSchema.nullable().optional(),
  november:      IntensificationResultSchema.nullable().optional(),
  december:      IntensificationResultSchema.nullable().optional(),
  february:      IntensificationResultSchema.nullable().optional(),
  finalScore:    z.string().max(10).nullable().optional(),
  closingSabers: z.string().max(255).nullable().optional(),
}).strict();

export type UpdatePendingProgressDto = z.infer<typeof UpdatePendingProgressSchema>;
