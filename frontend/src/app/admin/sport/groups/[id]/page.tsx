'use client';

import { useState }   from 'react';
import { useParams }  from 'next/navigation';
import Link           from 'next/link';
import { Button }     from '@/components/ui/button';
import { Badge }      from '@/components/ui/badge';
import { ChevronLeftIcon, UsersIcon, ClipboardListIcon, InfoIcon } from 'lucide-react';
import { useIsOnLeave }  from '@/lib/hooks/use-is-on-leave';
import { useSportGroup } from '@/lib/api/sports';
import { TakeSportAttendance } from './_components/take-sport-attendance';
import { SportGroupStudents }  from './_components/sport-group-students';

type Tab = 'attendance' | 'students' | 'info';

export default function SportGroupDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const isOnLeave = useIsOnLeave();
  const [tab, setTab] = useState<Tab>('attendance');

  const { data: group, isLoading } = useSportGroup(id);

  if (isLoading) return (
    <div className="text-sm text-muted-foreground text-center py-12">Cargando grupo...</div>
  );

  if (!group) return (
    <div className="text-sm text-muted-foreground text-center py-12">Grupo no encontrado.</div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/admin/sport/groups">
            <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5">
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{group.name}</h1>
              <Badge variant="outline">{group.sport.name}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {group.schoolYear.name} · {group._count.students} alumnos ·{' '}
              {group.teachers.map(t => `${t.user.firstName} ${t.user.lastName}`).join(', ')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-0">
        <Button
          size="sm"
          variant={tab === 'attendance' ? 'default' : 'ghost'}
          className="rounded-b-none"
          onClick={() => setTab('attendance')}
        >
          <ClipboardListIcon className="h-4 w-4 mr-1.5" />
          Tomar lista
        </Button>
        <Button
          size="sm"
          variant={tab === 'students' ? 'default' : 'ghost'}
          className="rounded-b-none"
          onClick={() => setTab('students')}
        >
          <UsersIcon className="h-4 w-4 mr-1.5" />
          Alumnos ({group._count.students})
        </Button>
        <Button
          size="sm"
          variant={tab === 'info' ? 'default' : 'ghost'}
          className="rounded-b-none"
          onClick={() => setTab('info')}
        >
          <InfoIcon className="h-4 w-4 mr-1.5" />
          Info
        </Button>
      </div>

      {/* Contenido */}
      {tab === 'attendance' && (
        isOnLeave ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No podés registrar asistencia mientras tenés una licencia activa.
          </p>
        ) : (
          <TakeSportAttendance group={group} />
        )
      )}

      {tab === 'students' && (
        <SportGroupStudents group={group} isOnLeave={isOnLeave} />
      )}

      {tab === 'info' && (
        <div className="space-y-4 text-sm">
          <div className="rounded-md border divide-y">
            <div className="flex justify-between px-4 py-3">
              <span className="text-muted-foreground">Deporte</span>
              <span className="font-medium">{group.sport.name}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-muted-foreground">Año lectivo</span>
              <span className="font-medium">{group.schoolYear.name}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-muted-foreground">Docentes</span>
              <span className="font-medium text-right">
                {group.teachers.map(t =>
                  `${t.user.firstName} ${t.user.lastName}`
                ).join(', ')}
              </span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-muted-foreground">Total alumnos</span>
              <span className="font-medium">{group._count.students}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-muted-foreground">Registros de asistencia</span>
              <span className="font-medium">{group._count.attendances}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}