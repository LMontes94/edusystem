'use client';

import { useState }          from 'react';
import { Button }            from '@/components/ui/button';
import { TableIcon, ListIcon } from 'lucide-react';
import { useIsOnLeave }      from '@/lib/hooks/use-is-on-leave';
import { useGrades }         from '@/lib/api/grades';
import { CreateGradeDialog } from './_components/create-grade-dialog';
import { GradesTable }       from './_components/grades-table';
import BulkGradesEntry       from '@/components/grades/bulk-grades-entry';

type View = 'list' | 'bulk';

export default function GradesPage() {
  const [view, setView] = useState<View>('list');

  const isOnLeave        = useIsOnLeave();
  const { data: grades } = useGrades({});

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notas</h1>
          <p className="text-sm text-muted-foreground">
            {view === 'list'
              ? `${grades?.length ?? 0} registros`
              : 'Carga masiva tipo Excel'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle vista */}
          <div className="flex rounded-md border overflow-hidden">
            <Button
              size="sm"
              variant={view === 'list' ? 'default' : 'ghost'}
              className="rounded-none border-0"
              onClick={() => setView('list')}
            >
              <ListIcon className="h-4 w-4 mr-1.5" />
              Lista
            </Button>
            <Button
              size="sm"
              variant={view === 'bulk' ? 'default' : 'ghost'}
              className="rounded-none border-0 border-l"
              onClick={() => setView('bulk')}
            >
              <TableIcon className="h-4 w-4 mr-1.5" />
              Carga masiva
            </Button>
          </div>

          {/* Cargar nota — solo en vista lista y si no está en licencia */}
          {view === 'list' && !isOnLeave && <CreateGradeDialog />}
        </div>
      </div>

      {/* Contenido */}
      {view === 'list'
        ? <GradesTable />
        : <BulkGradesEntry disabled={isOnLeave} />
      }

    </div>
  );
}