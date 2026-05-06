import { z } from 'zod';

export const CreateSportSchema = z.object({
  name: z.string().min(1).max(100),
});

export const UpdateSportSchema = CreateSportSchema.partial();

export type CreateSportDto = z.infer<typeof CreateSportSchema>;
export type UpdateSportDto = z.infer<typeof UpdateSportSchema>;