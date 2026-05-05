'use client';

import { useMemo, useState }   from 'react';
import { Button }               from '@/components/ui/button';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import { SpaceReservation }     from '@/lib/api/spaces';
import { ReservationCard }      from './reservation-card';
import { ReservationDialog }    from './reservation-dialog';
import {
  toDateStr, MONTH_NAMES, DAY_NAMES,
} from './reservations.types';

interface Props {
  reservations: SpaceReservation[];
  selectedSpaceId?: string;
  isOnLeave: boolean;
}

export function CalendarView({ reservations, selectedSpaceId, isOnLeave }: Props) {
  const today = new Date();

  const [currentYear,  setCurrentYear]  = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-based
  const [newResDate,   setNewResDate]   = useState<string | null>(null);

  // ── Navegación ─────────────────────────────────────────────────────────────
  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }

  // ── Días del mes ───────────────────────────────────────────────────────────
  const { days, startPadding } = useMemo(() => {
    const firstDay  = new Date(currentYear, currentMonth, 1).getDay(); // 0=Dom
    const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
    return {
      days:         Array.from({ length: daysCount }, (_, i) => i + 1),
      startPadding: firstDay,
    };
  }, [currentYear, currentMonth]);

  // ── Indexar reservas por día ───────────────────────────────────────────────
  const byDay = useMemo(() => {
    const map: Record<string, SpaceReservation[]> = {};
    for (const r of reservations) {
      const key = r.date.split('T')[0]; // "YYYY-MM-DD"
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    // ordenar por startTime dentro de cada día
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [reservations]);

  const todayStr = toDateStr(today);

  return (
    <>
      {/* ── Cabecera del calendario ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold w-44 text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setCurrentYear(today.getFullYear()); setCurrentMonth(today.getMonth()); }}
        >
          Hoy
        </Button>
      </div>

      {/* ── Días de semana ── */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* ── Grilla de días ── */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
        {/* Padding inicial */}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-muted/30 min-h-24 p-1" />
        ))}

        {/* Días reales */}
        {days.map(day => {
          const dateStr  = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayRes   = byDay[dateStr] ?? [];
          const isToday  = dateStr === todayStr;
          const isPast   = dateStr < todayStr;

          return (
            <div
              key={day}
              className={`bg-background min-h-24 p-1 flex flex-col gap-1 ${
                isPast ? 'opacity-60' : ''
              }`}
            >
              {/* Número del día */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground'
                }`}>
                  {day}
                </span>

                {/* Botón añadir — solo si no es pasado y no está en licencia */}
                {!isPast && !isOnLeave && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:opacity-100"
                    onClick={() => setNewResDate(dateStr)}
                  >
                    <PlusIcon className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Reservas del día */}
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayRes.map(r => (
                  <ReservationCard key={r.id} reservation={r} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog nueva reserva al clickear día */}
      <ReservationDialog
        open={!!newResDate}
        onOpenChange={open => { if (!open) setNewResDate(null); }}
        defaultDate={newResDate ?? undefined}
        defaultSpaceId={selectedSpaceId}
      />
    </>
  );
}