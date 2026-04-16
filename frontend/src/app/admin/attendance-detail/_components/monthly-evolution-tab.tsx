'use client';

import { useMemo } from 'react';
import { AttendanceRecord } from './attendance-detail.types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  attendance: AttendanceRecord[];
  courseStudents: any[];
}

interface MonthStat {
  month:     string;   // "Mar", "Abr", etc.
  monthNum:  number;
  present:   number;
  absent:    number;
  late:      number;
  justified: number;
  total:     number;
  rate:      number;
}

const MONTH_NAMES: Record<number, string> = {
  3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic',
};

function rateBarColor(rate: number) {
  if (rate >= 80) return 'bg-emerald-500';
  if (rate >= 60) return 'bg-amber-400';
  return 'bg-red-500';
}

function rateTextColor(rate: number) {
  if (rate >= 80) return 'text-emerald-600';
  if (rate >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export function MonthlyEvolutionTab({ attendance }: Props) {
  const monthlyStats = useMemo<MonthStat[]>(() => {
    const map: Record<number, { present: number; absent: number; late: number; justified: number; total: number }> = {};

    attendance.forEach((a) => {
      // Usar split para evitar problema de timezone (patrón del proyecto)
      const monthNum = parseInt(a.date.split('T')[0].split('-')[1]);
      if (!map[monthNum]) map[monthNum] = { present: 0, absent: 0, late: 0, justified: 0, total: 0 };
      map[monthNum].total++;
      if (a.status === 'PRESENT')   map[monthNum].present++;
      if (a.status === 'ABSENT')    map[monthNum].absent++;
      if (a.status === 'LATE')      map[monthNum].late++;
      if (a.status === 'JUSTIFIED') map[monthNum].justified++;
    });

    return Object.entries(map)
      .map(([monthNum, stats]) => {
        const mn   = parseInt(monthNum);
        const rate = stats.total > 0
          ? Math.round(((stats.present + stats.late) / stats.total) * 100)
          : 0;
        return { month: MONTH_NAMES[mn] ?? `Mes ${mn}`, monthNum: mn, rate, ...stats };
      })
      .sort((a, b) => a.monthNum - b.monthNum);
  }, [attendance]);

  if (monthlyStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
        <TrendingUp className="h-8 w-8 opacity-30" />
        <p className="text-sm">No hay datos suficientes para mostrar la evolución</p>
        <p className="text-xs opacity-70">Seleccioná "Todo el año" para ver la evolución mensual</p>
      </div>
    );
  }

  const maxTotal = Math.max(...monthlyStats.map((m) => m.total));

  // Tendencia: comparar último mes con penúltimo
  const trend = (() => {
    if (monthlyStats.length < 2) return null;
    const last = monthlyStats[monthlyStats.length - 1];
    const prev = monthlyStats[monthlyStats.length - 2];
    const diff = last.rate - prev.rate;
    return { diff, up: diff > 0 };
  })();

  return (
    <div className="space-y-6">

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-4">
        {/* Mejor mes */}
        {(() => {
          const best = [...monthlyStats].sort((a, b) => b.rate - a.rate)[0];
          return (
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground mb-1">Mejor mes</p>
              <p className="text-lg font-semibold text-emerald-600">{best.month}</p>
              <p className="text-xs text-muted-foreground">{best.rate}% asistencia</p>
            </div>
          );
        })()}

        {/* Promedio anual */}
        {(() => {
          const avg = Math.round(
            monthlyStats.reduce((sum, m) => sum + m.rate, 0) / monthlyStats.length
          );
          return (
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground mb-1">Promedio anual</p>
              <p className={`text-lg font-semibold ${rateTextColor(avg)}`}>{avg}%</p>
              <p className="text-xs text-muted-foreground">sobre {monthlyStats.length} meses</p>
            </div>
          );
        })()}

        {/* Tendencia */}
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground mb-1">Tendencia reciente</p>
          {trend === null ? (
            <p className="text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="flex items-center gap-1.5">
              {trend.diff === 0
                ? <Minus className="h-4 w-4 text-muted-foreground" />
                : trend.up
                  ? <TrendingUp   className="h-4 w-4 text-emerald-600" />
                  : <TrendingDown className="h-4 w-4 text-red-600" />
              }
              <span className={`text-lg font-semibold ${
                trend.diff === 0 ? 'text-muted-foreground'
                : trend.up ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {trend.diff > 0 ? '+' : ''}{trend.diff}%
              </span>
            </div>
          )}
          {trend && (
            <p className="text-xs text-muted-foreground">
              vs mes anterior
            </p>
          )}
        </div>
      </div>

      {/* Gráfico de barras custom */}
      <div className="rounded-lg border bg-background p-4">
        <p className="text-xs font-medium text-muted-foreground mb-4">% Asistencia por mes</p>
        <div className="flex items-end gap-2 h-36">
          {monthlyStats.map((m) => (
            <div key={m.monthNum} className="flex-1 flex flex-col items-center gap-1 group">
              {/* Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-center bg-popover border rounded shadow-sm px-2 py-1 pointer-events-none absolute -translate-y-8 z-10 whitespace-nowrap">
                {m.present}P · {m.absent}A · {m.late}T · {m.justified}J
              </div>
              {/* Valor */}
              <span className={`text-xs font-semibold ${rateTextColor(m.rate)}`}>
                {m.rate}%
              </span>
              {/* Barra */}
              <div className="w-full rounded-t overflow-hidden bg-muted" style={{ height: '80px' }}>
                <div
                  className={`w-full rounded-t transition-all ${rateBarColor(m.rate)}`}
                  style={{ height: `${m.rate}%`, marginTop: `${100 - m.rate}%` }}
                />
              </div>
              {/* Mes */}
              <span className="text-xs text-muted-foreground">{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla mensual detallada */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Mes</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-emerald-600">Presentes</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-red-600">Ausentes</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-amber-600">Tardanzas</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-blue-600">Justificadas</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Total</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">% Asistencia</th>
            </tr>
          </thead>
          <tbody>
            {monthlyStats.map((m, idx) => {
              const prevRate  = idx > 0 ? monthlyStats[idx - 1].rate : null;
              const delta     = prevRate !== null ? m.rate - prevRate : null;
              return (
                <tr key={m.monthNum} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{m.month}</td>
                  <td className="text-center px-3 py-2.5 text-emerald-600 font-medium">{m.present}</td>
                  <td className="text-center px-3 py-2.5 text-red-600 font-medium">{m.absent}</td>
                  <td className="text-center px-3 py-2.5 text-amber-600 font-medium">{m.late}</td>
                  <td className="text-center px-3 py-2.5 text-blue-600 font-medium">{m.justified}</td>
                  <td className="text-center px-3 py-2.5 text-muted-foreground">{m.total}</td>
                  <td className="text-center px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`font-semibold ${rateTextColor(m.rate)}`}>{m.rate}%</span>
                      {delta !== null && delta !== 0 && (
                        <span className={`text-xs ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Para ver la evolución completa, asegurate de tener seleccionado "Todo el año" en el filtro de mes.
      </p>
    </div>
  );
}