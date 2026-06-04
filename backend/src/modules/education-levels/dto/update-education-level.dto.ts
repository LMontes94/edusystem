import { z } from 'zod';
import { EducationLevelStatus } from '@prisma/client';

export const UpdateEducationLevelSchema = z
  .object({
    name: z.string().min(1, 'Requerido').max(100).optional(),
    displayOrder: z.coerce.number().int().optional(),
    status: z.nativeEnum(EducationLevelStatus).optional(),
  })
  .strict();

export type UpdateEducationLevelDto = z.infer<typeof UpdateEducationLevelSchema>;
