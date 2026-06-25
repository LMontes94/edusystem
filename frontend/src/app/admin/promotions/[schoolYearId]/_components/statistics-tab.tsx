'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePromotionStatistics } from '@/lib/api/promotion';

interface Props {
  schoolYearId: string;
}

export function StatisticsTab({ schoolYearId }: Props) {
  const { data: stats, isLoading } = usePromotionStatistics(schoolYearId);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Cargando estadísticas...
      </p>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No hay estadísticas disponibles para este ciclo lectivo.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.promoted.count}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.promoted.percentage}% promovidos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.retained.count}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.retained.percentage}% retenidos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.graduated.count}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.graduated.percentage}% graduados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.overrides.count}</p>
            <p className="text-xs text-muted-foreground mt-1">manuales</p>
          </CardContent>
        </Card>
      </div>

      {stats.summaryStale && (
        <Badge variant="destructive">Resumen desactualizado</Badge>
      )}
    </div>
  );
}
