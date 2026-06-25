import { z } from 'zod';
import type { SchoolYear } from '@/app/admin/courses/_components/courses.types';

export type TabId = 'preview' | 'statistics' | 'results';

export const TABS: { id: TabId; label: string; show: (status: SchoolYear['promotionStatus']) => boolean }[] = [
  {
    id: 'preview',
    label: 'Previsualización',
    show: (status) => status !== 'EXECUTING' && status !== 'COMPLETED',
  },
  {
    id: 'results',
    label: 'Resultados',
    show: (status) => status === 'COMPLETED',
  },
  {
    id: 'statistics',
    label: 'Estadísticas',
    show: (status) => status !== undefined,
  },
];

export const createOverrideSchema = z.object({
  studentId: z.string().min(1, 'Requerido'),
  result: z.enum(['PROMOTED', 'RETAINED', 'GRADUATED']),
  toSchoolYearId: z.string().optional(),
  reason: z.string().min(10, 'La justificación debe tener al menos 10 caracteres'),
});

export type CreateOverrideForm = z.infer<typeof createOverrideSchema>;
