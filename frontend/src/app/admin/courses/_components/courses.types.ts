import { z } from 'zod';

// ── Tipos ─────────────────────────────────────
export interface SchoolYear {
  id:       string;
  year:     number;
  isActive: boolean;
}

export interface Course {
  id:         string;
  name:       string;
  grade:      number;
  division:   string;
  level:      string;
  schoolYear: SchoolYear;
  _count:     { courseStudents: number; courseSubjects: number };
}

export interface Period {
  id:        string;
  name:      string;
  type:      string;
  order:     number;
  startDate: string;
  endDate:   string;
}

// ── Constantes ────────────────────────────────
export const levelLabel: Record<string, string> = {
  INICIAL:    'Inicial',
  PRIMARIA:   'Primaria',
  SECUNDARIA: 'Secundaria',
};

export const levelColor: Record<string, string> = {
  INICIAL:    'bg-purple-100 text-purple-700',
  PRIMARIA:   'bg-blue-100 text-blue-700',
  SECUNDARIA: 'bg-emerald-100 text-emerald-700',
};

// ── Schemas ───────────────────────────────────
export const createCourseSchema = z.object({
  schoolYearId: z.string().min(1, 'Requerido'),
  name:         z.string().min(1, 'Requerido'),
  grade:        z.coerce.number().int().min(1).max(12),
  division:     z.string().min(1, 'Requerido'),
  level:        z.enum(['INICIAL', 'PRIMARIA', 'SECUNDARIA']),
});
export type CreateCourseForm = z.infer<typeof createCourseSchema>;

export const createSchoolYearSchema = z.object({
  year:      z.coerce.number().int().min(2020).max(2100),
  startDate: z.string().min(1, 'Requerido'),
  endDate:   z.string().min(1, 'Requerido'),
});
export type CreateSchoolYearForm = z.infer<typeof createSchoolYearSchema>;

export const createPeriodSchema = z.object({
  schoolYearId: z.string().min(1, 'Requerido'),
  name:         z.string().min(1, 'Requerido'),
  type:         z.enum(['TRIMESTRE', 'BIMESTRE', 'CUATRIMESTRE', 'SEMESTRE']),
  order:        z.coerce.number().int().min(1),
  startDate:    z.string().min(1, 'Requerido'),
  endDate:      z.string().min(1, 'Requerido'),
});
export type CreatePeriodForm = z.infer<typeof createPeriodSchema>;