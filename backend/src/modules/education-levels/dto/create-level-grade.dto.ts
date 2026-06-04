import { z } from 'zod';

export const CreateLevelGradeSchema = z
  .object({
    name: z.string().min(1, 'Requerido').max(100, 'Máximo 100 caracteres'),
    displayOrder: z.coerce.number().int().optional(),
  })
  .strict();

export type CreateLevelGradeDto = z.infer<typeof CreateLevelGradeSchema>;
