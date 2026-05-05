'use client';

import { useState }          from 'react';
import { Button }            from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
}                            from '@/components/ui/select';
import { Badge }             from '@/components/ui/badge';
import { PlusIcon }          from 'lucide-react';
import { useIsOnLeave }      from '@/lib/hooks/use-is-on-leave';
import { useSpaces, useSpaceReservations } from '@/lib/api/spaces';
import { CalendarView }      from './_components/calendar-view';
import { ReservationDialog } from './_components/reservation-dialog';

export default function ReservationsPage() {
  const isOnLeave = useIsOnLeave();

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
  );
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('all');
  const [newResOpen,      setNewResOpen]       = useState(false);

  const { data: spaces }       = useSpaces();
  const { data: reservations, isLoading } = useSpaceReservations({
    month:   currentMonth,
    spaceId: selectedSpaceId !== 'all' ? selectedSpaceId : undefined,
  });

  // Contadores para el header
  const total     = reservations?.length ?? 0;
  const pending   = reservations?.filter(r => r.status === 'PENDING').length   ?? 0;
  const confirmed = reservations?.filter(r => r.status === 'CONFIRMED').length ?? 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Calendario de reservas</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Cargando...' : (
              <>
                {total} reserva{total !== 1 ? 's' : ''} este mes
                {pending > 0 && (
                  <> · <span className="text-yellow-600">{pending} pendiente{pending !== 1 ? 's' : ''}</span></>
                )}
                {confirmed > 0 && (
                  <> · <span className="text-green-600">{confirmed} confirmada{confirmed !== 1 ? 's' : ''}</span></>
                )}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtro por espacio */}
          <Select value={selectedSpaceId} onValueChange={setSelectedSpaceId}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Todos los espacios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los espacios</SelectItem>
              {spaces?.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    {s.name}
                    {!s.isAvailable && (
                      <Badge variant="secondary" className="text-xs py-0">No disponible</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Nueva reserva */}
          {!isOnLeave && (
            <Button size="sm" onClick={() => setNewResOpen(true)}>
              <PlusIcon className="h-4 w-4 mr-1.5" />
              Nueva reserva
            </Button>
          )}
        </div>
      </div>

      {/* Leyenda dinámica: un chip por espacio con su color real */}
      {spaces && spaces.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {spaces.map(s => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
              {!s.isAvailable && <span className="text-muted-foreground/50">(no disponible)</span>}
            </div>
          ))}
          <div className="flex items-center gap-3 ml-2 pl-2 border-l text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" /> Pendiente
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" /> Confirmada
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" /> Cancelada
            </div>
          </div>
        </div>
      )}

      {/* Calendario */}
      <CalendarView
        reservations={reservations ?? []}
        selectedSpaceId={selectedSpaceId !== 'all' ? selectedSpaceId : undefined}
        isOnLeave={isOnLeave}
      />

      {/* Dialog nueva reserva desde el botón del header */}
      <ReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        defaultSpaceId={selectedSpaceId !== 'all' ? selectedSpaceId : undefined}
      />

    </div>
  );
}