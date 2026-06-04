import { z } from 'zod';
import { LevelGradeStatus } from '@prisma/client';

export const UpdateLevelGradeSchema = z
  .object({
    name: z.string().min(1, 'Requerido').max(100).optional(),
    displayOrder: z.coerce.number().int().optional(),
    status: z.nativeEnum(LevelGradeStatus).optional(),
  })
  .strict();

export type UpdateLevelGradeDto = z.infer<typeof UpdateLevelGradeSchema>;
