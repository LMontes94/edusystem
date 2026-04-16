'use client';

import { AttendanceSummary } from './attendance-detail.types';
import { XCircle, TrendingDown, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  summaries: AttendanceSummary[];
}

function absenceRiskLevel(absent: number, total: number): {
  label: string;
  badgeVariant: 'default' | 'secondary' | 'destructive';
  color: string;
} {
  if (total === 0) return { label: 'Sin datos',  badgeVariant: 'secondary',    color: 'text-muted-foreground' };
  const pct = (absent / total) * 100;
  if (pct >= 30)  return { label: 'Crítico',     badgeVariant: 'destructive',  color: 'text-red-600'          };
  if (pct >= 20)  return { label: 'Alto',        badgeVariant: 'destructive',  color: 'text-orange-600'       };
  if (pct >= 10)  return { label: 'Moderado',    badgeVariant: 'secondary',    color: 'text-amber-600'        };
  return           { label: 'Normal',      badgeVariant: 'default',      color: 'text-emerald-600'      };
}

export function RankingTab({ summaries }: Props) {
  // Ordenar por ausentes desc, luego por tasa de asistencia asc
  const ranked = [...summaries]
    .filter((s) => s.total > 0)
    .sort((a, b) => b.absent - a.absent || a.rate - b.rate);

  const maxAbsent = ranked[0]?.absent ?? 1;

  if (ranked.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
        <TrendingDown className="h-8 w-8 opacity-30" />
        <p className="text-sm">No hay registros suficientes para mostrar el ranking</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* Leyenda de riesgo */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
        <span className="font-medium">Nivel de riesgo:</span>
        {[
          { label: 'Normal',   color: 'bg-emerald-100 text-emerald-700' },
          { label: 'Moderado', color: 'bg-amber-100 text-amber-700'     },
          { label: 'Alto',     color: 'bg-orange-100 text-orange-700'   },
          { label: 'Crítico',  color: 'bg-red-100 text-red-700'         },
        ].map(({ label, color }) => (
          <span key={label} className={`px-2 py-0.5 rounded-full font-medium ${color}`}>
            {label}
          </span>
        ))}
      </div>

      {/* Lista */}
      <div className="rounded-lg border bg-background overflow-hidden">
        {ranked.map((s, idx) => {
          const risk     = absenceRiskLevel(s.absent, s.total);
          const barWidth = maxAbsent > 0 ? Math.round((s.absent / maxAbsent) * 100) : 0;
          const isTop3   = idx < 3;

          return (
            <div
              key={s.student.id}
              className={`flex items-center gap-4 px-4 py-3 border-b last:border-0 ${
                isTop3 && s.absent > 0 ? 'bg-red-50/40 dark:bg-red-950/10' : ''
              }`}
            >
              {/* Posición */}
              <span className={`text-sm font-bold tabular-nums w-6 shrink-0 ${
                idx === 0 ? 'text-red-600'
                : idx === 1 ? 'text-orange-500'
                : idx === 2 ? 'text-amber-500'
                : 'text-muted-foreground'
              }`}>
                {idx + 1}
              </span>

              {/* Nombre */}
              <div className="min-w-0 w-44 shrink-0">
                <p className="text-sm font-medium truncate">
                  {s.student.lastName}, {s.student.firstName}
                </p>
                <p className="text-xs text-muted-foreground">
                  DNI {s.student.documentNumber}
                </p>
              </div>

              {/* Barra de ausencias */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        barWidth >= 30 ? 'bg-red-500'
                        : barWidth >= 20 ? 'bg-orange-400'
                        : barWidth >= 10 ? 'bg-amber-400'
                        : 'bg-emerald-400'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-red-600 w-6 text-right shrink-0">
                    {s.absent}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    <XCircle className="h-3 w-3 inline mr-0.5" />
                    faltas
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{s.late} tardanzas</span>
                  <span>{s.justified} justificadas</span>
                  <span>{s.total} días registrados</span>
                </div>
              </div>

              {/* Badge de riesgo */}
              <div className="shrink-0">
                {risk.label === 'Crítico' && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 inline mr-1" />
                )}
                <Badge
                  variant={risk.badgeVariant}
                  className="text-xs"
                >
                  {risk.label}
                </Badge>
              </div>

              {/* % asistencia */}
              <span className={`text-sm font-semibold tabular-nums shrink-0 ${risk.color}`}>
                {s.rate}%
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Ordenado por cantidad de inasistencias injustificadas. El nivel de riesgo se calcula sobre el total de días registrados.
      </p>
    </div>
  );
}