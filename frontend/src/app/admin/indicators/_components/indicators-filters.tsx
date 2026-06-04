'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchoolYears } from '@/lib/api/courses';
import { useSubjects }    from '@/lib/api/subjects';
import { useLevelGrades } from '@/lib/api/indicators';

interface Props {
  selectedSchoolYear:  string;
  selectedLevelGradeId: string | null;
  selectedSubject:     string;
  onSchoolYearChange:  (v: string) => void;
  onLevelGradeIdChange: (v: string) => void;
  onSubjectChange:     (v: string) => void;
}

export function IndicatorsFilters({
  selectedSchoolYear, selectedLevelGradeId, selectedSubject,
  onSchoolYearChange, onLevelGradeIdChange, onSubjectChange,
}: Props) {
  const { data: schoolYears } = useSchoolYears();
  const { data: subjects }    = useSubjects();
  const { data: levelGrades } = useLevelGrades();

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="grid grid-cols-2 gap-4">

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Año lectivo</label>
            <Select value={selectedSchoolYear} onValueChange={onSchoolYearChange}>
              <SelectTrigger><SelectValue placeholder="Seleccioná un año..." /></SelectTrigger>
              <SelectContent>
                {schoolYears?.map((sy: any) => (
                  <SelectItem key={sy.id} value={sy.id}>
                    {sy.year} {sy.isActive && '(activo)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nivel / Grado</label>
            <Select
              value={selectedLevelGradeId ?? ''}
              onValueChange={onLevelGradeIdChange}
              disabled={!selectedSchoolYear}
            >
              <SelectTrigger><SelectValue placeholder="Seleccioná un nivel/grado..." /></SelectTrigger>
              <SelectContent>
                {levelGrades?.map((lg) => (
                  <SelectItem key={lg.id} value={lg.id}>
                    {lg.educationLevel.name} — {lg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 col-span-2">
            <label className="text-sm font-medium">Materia / Área</label>
            <Select value={selectedSubject} onValueChange={onSubjectChange}>
              <SelectTrigger><SelectValue placeholder="Seleccioná una materia..." /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}