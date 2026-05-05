'use client';

import { useIsOnLeave }      from '@/lib/hooks/use-is-on-leave';
import { useSpaces }         from '@/lib/api/spaces';
import { SpacesTable }       from './_components/space-table';
import { CreateSpaceButton } from './_components/space-dialog';

export default function SpacesPage() {
  const isOnLeave          = useIsOnLeave();
  const { data: spaces }   = useSpaces();

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Espacios</h1>
          <p className="text-sm text-muted-foreground">
            {spaces?.length ?? 0} espacios registrados
          </p>
        </div>
        {!isOnLeave && <CreateSpaceButton />}
      </div>

      <SpacesTable />

    </div>
  );
}