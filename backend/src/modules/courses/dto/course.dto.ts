import { z } from 'zod';

// ── School Year ───────────────────────────────
export const CreateSchoolYearSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  startDate: z.string().date(),
  endDate: z.string().date(),
});
export type CreateSchoolYearDto = z.infer<typeof CreateSchoolYearSchema>;

// ── Course ────────────────────────────────────
export const CreateCourseSchema = z.object({
  schoolYearId: z.string().uuid(),
  name: z.string().min(1).max(100),
  grade: z.number().int().min(1).max(12),
  division: z.string().max(10),
  level: z.enum(['INICIAL', 'PRIMARIA', 'SECUNDARIA']),
});
export type CreateCourseDto = z.infer<typeof CreateCourseSchema>;

export const UpdateCourseSchema = CreateCourseSchema.partial().omit({ schoolYearId: true });
export type UpdateCourseDto = z.infer<typeof UpdateCourseSchema>;

// ── Assign Teacher to Subject ─────────────────
export const AssignTeacherSchema = z.object({
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid(),
  hoursPerWeek: z.number().int().min(1).max(40).optional(),
});
export type AssignTeacherDto = z.infer<typeof AssignTeacherSchema>;

// ── Period ────────────────────────────────────
export const CreatePeriodSchema = z.object({
  schoolYearId: z.string().uuid(),
  name: z.string().min(1).max(50),
  type: z.enum(['BIMESTRE', 'TRIMESTRE', 'SEMESTRE', 'ANUAL']),
  order: z.number().int().min(1).max(10),
  startDate: z.string().date(),
  endDate: z.string().date(),
});
export type CreatePeriodDto = z.infer<typeof CreatePeriodSchema>;

// ── Subject ───────────────────────────────────
export const CreateSubjectSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});
export type CreateSubjectDto = z.infer<typeof CreateSubjectSchema>;

export const UpdateSubjectSchema = CreateSubjectSchema.partial();
export type UpdateSubjectDto = z.infer<typeof UpdateSubjectSchema>;
