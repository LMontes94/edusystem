'use client';

import { useSchoolYears } from '@/lib/api/courses';
import { PromotionsTable } from './_components/promotions-table';

export default function PromotionsPage() {
  const { data: schoolYears, isLoading } = useSchoolYears();

  const closedYears =
    [...(schoolYears ?? [])]
      .filter((sy) => sy.status === 'CLOSED')
      .sort((a, b) => b.year - a.year);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Promociones</h1>
        <p className="text-sm text-muted-foreground">
          {closedYears.length} ciclos lectivos disponibles
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : closedYears.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No hay ciclos lectivos cerrados disponibles para promoción.
        </div>
      ) : (
        <PromotionsTable schoolYears={closedYears} />
      )}
    </div>
  );
}
