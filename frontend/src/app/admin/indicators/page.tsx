'use client';

import { useState }    from 'react';
import { useAppSession } from '@/lib/hooks/use-app-session';  
import { useSubjects } from '@/lib/api/subjects';
import { useSchoolYears } from '@/lib/api/courses';
import { useIndicators }  from '@/lib/api/indicators';
import { IndicatorsFilters } from './_components/indicators-filters';
import { IndicatorsList }    from './_components/indicators-list';

const CAN_MANAGE_ROLES = ['ADMIN', 'DIRECTOR', 'SUPER_ADMIN'];

export default function IndicatorsPage() {
  const { data: session } = useAppSession();
  const canManage = CAN_MANAGE_ROLES.includes((session?.user as any)?.role ?? '');

  const [selectedSchoolYear,  setSelectedSchoolYear]  = useState('');
  const [selectedLevelGradeId, setSelectedLevelGradeId] = useState<string | null>(null);
  const [selectedSubject,     setSelectedSubject]     = useState('');

  const { data: subjects }    = useSubjects();
  const { data: schoolYears } = useSchoolYears();

  const { data: indicators, isLoading } = useIndicators({
    subjectId:    selectedSubject    || undefined,
    schoolYearId: selectedSchoolYear || undefined,
    levelGradeId: selectedLevelGradeId,
  });

  const subjectName = (subjects as any[])?.find((s) => s.id === selectedSubject)?.name;
  const schoolYear  = (schoolYears as any[])?.find((sy) => sy.id === selectedSchoolYear)?.year;

  const showList = !!selectedSubject && !!selectedSchoolYear && !!selectedLevelGradeId;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Indicadores de evaluación</h1>
        <p className="text-sm text-muted-foreground">
          Definí los indicadores de cada materia para el informe cualitativo de primaria
        </p>
      </div>

      {/* Filtros */}
      <IndicatorsFilters
        selectedSchoolYear={selectedSchoolYear}
        selectedLevelGradeId={selectedLevelGradeId}
        selectedSubject={selectedSubject}
        onSchoolYearChange={setSelectedSchoolYear}
        onLevelGradeIdChange={setSelectedLevelGradeId}
        onSubjectChange={setSelectedSubject}
      />

      {/* Lista */}
      {showList ? (
        <IndicatorsList
          indicators={indicators ?? []}
          isLoading={isLoading}
          canManage={canManage}
          subjectName={subjectName ?? ''}
          schoolYear={schoolYear}
          subjectId={selectedSubject}
          schoolYearId={selectedSchoolYear}
          levelGradeId={selectedLevelGradeId!}
        />
      ) : (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          Seleccioná un año lectivo, grado y materia para ver sus indicadores
        </div>
      )}

    </div>
  );
}

