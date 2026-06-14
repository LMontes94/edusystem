import { z } from 'zod';
import { PromotionOutcome } from '@prisma/client';

export const CreateOverrideSchema = z.object({
  studentId: z.string().uuid(),
  fromSchoolYearId: z.string().uuid(),
  result: z.nativeEnum(PromotionOutcome),
  reason: z.string().min(10, 'La justificación debe tener al menos 10 caracteres'),
  toSchoolYearId: z.string().uuid().optional(),
}).strict();

export type CreateOverrideDto = z.infer<typeof CreateOverrideSchema>;
