'use client';

import { useIsOnLeave }      from '@/lib/hooks/use-is-on-leave';
import { useSports }         from '@/lib/api/sports';
import { SportsTable }       from './_components/sports-table';
import { CreateSportButton } from './_components/sport-dialog';

export default function SportsPage() {
  const isOnLeave        = useIsOnLeave();
  const { data: sports } = useSports();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Deportes</h1>
          <p className="text-sm text-muted-foreground">
            {sports?.length ?? 0} deportes registrados
          </p>
        </div>
        {!isOnLeave && <CreateSportButton />}
      </div>
      <SportsTable />
    </div>
  );
}