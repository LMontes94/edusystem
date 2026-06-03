import { z } from 'zod';

export const UpdateIndicatorSchema = z.object({
  description: z.string().min(1, 'Requerido').max(300),
}).strict();

export type UpdateIndicatorDto = z.infer<typeof UpdateIndicatorSchema>;
