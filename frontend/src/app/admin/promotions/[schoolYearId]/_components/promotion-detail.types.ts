import type { SchoolYear } from '@/app/admin/courses/_components/courses.types';

export type TabId = 'preview' | 'statistics';

export const TABS: { id: TabId; label: string; show: (status: SchoolYear['promotionStatus']) => boolean }[] = [
  {
    id: 'preview',
    label: 'Previsualización',
    show: (status) => status !== 'EXECUTING' && status !== 'COMPLETED',
  },
  {
    id: 'statistics',
    label: 'Estadísticas',
    show: (status) => status !== undefined,
  },
];
