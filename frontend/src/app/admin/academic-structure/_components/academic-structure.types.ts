import { z } from 'zod';

export interface EducationLevel {
  id: string;
  name: string;
  slug: string;
  institutionId: string;
  status: string;
  displayOrder: number;
  levelGrades: LevelGrade[];
}

export interface LevelGrade {
  id: string;
  name: string;
  displayOrder: number;
  educationLevelId: string;
  status: string;
  educationLevel?: {
    id: string;
    name: string;
  };
}

export const educationLevelSchema = z.object({
  name: z.string().min(1, 'Requerido'),
  slug: z.string().min(1, 'Requerido'),
});
export type EducationLevelForm = z.infer<typeof educationLevelSchema>;

export const levelGradeSchema = z.object({
  name: z.string().min(1, 'Requerido'),
  displayOrder: z.number().int().optional(),
  educationLevelId: z.string().min(1, 'Requerido'),
});
export type LevelGradeForm = z.infer<typeof levelGradeSchema>;
