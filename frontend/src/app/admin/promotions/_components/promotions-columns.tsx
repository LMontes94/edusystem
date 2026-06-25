import type { SchoolYear } from '@/app/admin/courses/_components/courses.types';

export const STATUS_CONFIG = {
  PREVIEWED: { label: 'Previsualizada', variant: 'secondary' as const },
  EXECUTING: { label: 'Ejecutando',     variant: 'outline' as const },
  COMPLETED: { label: 'Completada',     variant: 'default' as const },
} as const;

export function getStatusBadge(status: SchoolYear['promotionStatus']) {
  const config = status ? STATUS_CONFIG[status] : undefined;
  return config ?? { label: 'Sin ejecutar', variant: 'outline' as const };
}
