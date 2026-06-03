import { z } from 'zod';

export const ReorderIndicatorsSchema = z.object({
  ids: z.array(z.string().uuid()).min(2),
}).strict();

export type ReorderIndicatorsDto = z.infer<typeof ReorderIndicatorsSchema>;
