import { z } from 'zod';

export const CreateStudentSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  documentNumber: z.string().min(1).max(20),
  birthDate: z.string().date(),
  bloodType: z.string().max(5).optional(),
  medicalNotes: z.string().optional(),
});
export type CreateStudentDto = z.infer<typeof CreateStudentSchema>;

export const UpdateStudentSchema = CreateStudentSchema.partial();
export type UpdateStudentDto = z.infer<typeof UpdateStudentSchema>;

export const EnrollStudentSchema = z.object({
  courseId: z.string().uuid(),
});
export type EnrollStudentDto = z.infer<typeof EnrollStudentSchema>;

export const LinkGuardianSchema = z.object({
  userId: z.string().uuid(),
  relationship: z.enum(['PADRE', 'MADRE', 'TUTOR', 'ABUELO', 'HERMANO', 'OTRO']),
  isPrimary: z.boolean().default(false),
  canPickup: z.boolean().default(true),
});
export type LinkGuardianDto = z.infer<typeof LinkGuardianSchema>;
