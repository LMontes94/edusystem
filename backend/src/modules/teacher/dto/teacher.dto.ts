import { z } from 'zod';

export const CreatePendingSubjectSchema = z.object({
  closingGradeId: z.string().uuid(),
}).strict();

export type CreatePendingSubjectDto = z.infer<typeof CreatePendingSubjectSchema>;

export const UpdatePendingStatusSchema = z.object({
  status: z.enum(['ENROLLED', 'COMPLETED', 'NOT_COMPLETED']),
}).strict();

export type UpdatePendingStatusDto = z.infer<typeof UpdatePendingStatusSchema>;

export const UpdatePendingProgressSchema = z.object({
  initialSabers: z.string().max(500).optional(),
  march:         z.string().max(10).optional(),
  august:        z.string().max(10).optional(),
  november:      z.string().max(10).optional(),
  december:      z.string().max(10).optional(),
  february:      z.string().max(10).optional(),
  finalScore:    z.string().max(10).optional(),
  closingSabers: z.string().max(255).optional(),
}).strict();

export type UpdatePendingProgressDto = z.infer<typeof UpdatePendingProgressSchema>;
