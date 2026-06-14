import { z } from 'zod';
import { PromotionOutcome } from '@prisma/client';

export const ResultQuerySchema = z.object({
  schoolYearId: z.string().uuid(),
  studentId: z.string().uuid().optional(),
  result: z.nativeEnum(PromotionOutcome).optional(),
  isOverride: z.coerce.boolean().optional(),
  includeHistory: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(100),
}).strict();

export type ResultQueryDto = z.infer<typeof ResultQuerySchema>;
