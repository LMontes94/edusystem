import { z } from 'zod';

// ── School Year ───────────────────────────────
export const CreateSchoolYearSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  startDate: z.string().date(),
  endDate: z.string().date(),
});
export type CreateSchoolYearDto = z.infer<typeof CreateSchoolYearSchema>;

// ── Course ────────────────────────────────────
const LevelSlug = z.enum(['INICIAL', 'PRIMARIA', 'SECUNDARIA']);

export const CreateCourseSchema = z.object({
  schoolYearId: z.string().uuid(),
  name: z.string().min(1).max(100),
  division: z.string().max(10),
  level: LevelSlug.optional(),
  grade: z.number().int().min(1).max(12).optional(),
  levelGradeId: z.string().uuid().optional(),
}).refine(
  (data) =>
    data.levelGradeId !== undefined ||
    (data.level !== undefined && data.grade !== undefined),
  { message: 'Se requiere levelGradeId o (level + grade)' },
);
export type CreateCourseDto = z.infer<typeof CreateCourseSchema>;

export const UpdateCourseSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  division: z.string().max(10).optional(),
  level: LevelSlug.optional(),
  grade: z.number().int().min(1).max(12).optional(),
  levelGradeId: z.string().uuid().optional(),
}).strict().refine(
  (data) => {
    const hasLevel = data.level !== undefined;
    const hasGrade = data.grade !== undefined;
    if (data.levelGradeId !== undefined) return true;
    if (!hasLevel && !hasGrade) return true;
    return hasLevel && hasGrade;
  },
  { message: 'Debe enviar levelGradeId o level y grade juntos' },
);
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
  type: z.enum(['BIMESTRE', 'TRIMESTRE', 'CUATRIMESTRE', 'SEMESTRE', 'ANUAL']),
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
