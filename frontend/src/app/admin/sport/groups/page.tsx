'use client';

import { useState } from 'react';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
}                   from '@/components/ui/select';
import { useIsOnLeave }        from '@/lib/hooks/use-is-on-leave';
import { useSports, useSportGroups } from '@/lib/api/sports';
import { useSchoolYears }      from '@/lib/api/courses';
import { SportGroupsTable }    from './_components/sport-groups-table';
import { CreateSportGroupButton } from './_components/sport-group-dialog';

export default function SportGroupsPage() {
  const isOnLeave = useIsOnLeave();

  const [sportId,      setSportId]      = useState('all');
  const [schoolYearId, setSchoolYearId] = useState('all');

  const { data: sports }      = useSports();
  const { data: schoolYears } = useSchoolYears();
  const { data: groups }      = useSportGroups({
    sportId:      sportId      !== 'all' ? sportId      : undefined,
    schoolYearId: schoolYearId !== 'all' ? schoolYearId : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Grupos de deporte</h1>
          <p className="text-sm text-muted-foreground">
            {groups?.length ?? 0} grupos registrados
          </p>
        </div>
        {!isOnLeave && <CreateSportGroupButton />}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={sportId} onValueChange={setSportId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los deportes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los deportes</SelectItem>
            {sports?.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={schoolYearId} onValueChange={setSchoolYearId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los años" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los años</SelectItem>
            {schoolYears?.map(sy => (
              <SelectItem key={sy.id} value={sy.id}>{sy.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SportGroupsTable
        sportId={sportId !== 'all' ? sportId : undefined}
        schoolYearId={schoolYearId !== 'all' ? schoolYearId : undefined}
      />
    </div>
  );
}