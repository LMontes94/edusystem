import { z } from 'zod';
import { SLUG_REGEX, normalizeSlug } from '../../../common/utils/slug.utils';

export const CreateEducationLevelSchema = z
  .object({
    name: z.string().min(1, 'Requerido').max(100, 'Máximo 100 caracteres'),
    slug: z
      .string()
      .transform(normalizeSlug)
      .refine((v) => SLUG_REGEX.test(v), {
        message:
          'Slug debe estar en minúsculas, solo ASCII sin acentos, guiones para separar palabras',
      }),
    displayOrder: z.coerce.number().int().optional(),
  })
  .strict();

export type CreateEducationLevelDto = z.infer<typeof CreateEducationLevelSchema>;
