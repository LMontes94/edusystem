import { z } from 'zod';

export interface Subject {
  id:          string;
  name:        string;
  code:        string;
  description: string | null;
  color:       string | null;
  createdAt:   string;
}

export const subjectSchema = z.object({
  name:        z.string().min(1, 'Requerido'),
  code:        z.string().min(1, 'Requerido').max(10, 'Máximo 10 caracteres'),
  description: z.string().optional(),
  color:       z.string().optional(),
});
export type SubjectForm = z.infer<typeof subjectSchema>;

export const DEFAULT_COLOR = '#3B82F6';