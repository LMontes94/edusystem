import { z } from 'zod';
import { Relationship } from '@prisma/client';

export const LinkStudentSchema = z.object({
  studentId: z.string().uuid(),
  relationship: z.nativeEnum(Relationship).default(Relationship.TUTOR),
});
export type LinkStudentDto = z.infer<typeof LinkStudentSchema>;
