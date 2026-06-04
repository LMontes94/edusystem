import { z } from 'zod';

export const CreateIndicatorSchema = z.object({
  subjectId:     z.string().uuid(),
  schoolYearId:  z.string().uuid(),
  levelGradeId:  z.string().uuid(),
  description:   z.string().min(1, 'Requerido').max(300),
  order:         z.coerce.number().int().min(1).optional(),
}).strict();

export type CreateIndicatorDto = z.infer<typeof CreateIndicatorSchema>;
