'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchoolYears } from '@/lib/api/courses';
import { useSubjects }    from '@/lib/api/subjects';

interface Props {
  selectedSchoolYear: string;
  selectedGrade:      number | null;
  selectedSubject:    string;
  onSchoolYearChange: (v: string) => void;
  onGradeChange:      (v: number) => void;
  onSubjectChange:    (v: string) => void;
}

const GRADES = [1, 2, 3, 4, 5, 6, 7];

export function IndicatorsFilters({
  selectedSchoolYear, selectedGrade, selectedSubject,
  onSchoolYearChange, onGradeChange, onSubjectChange,
}: Props) {
  const { data: schoolYears } = useSchoolYears();
  const { data: subjects }    = useSubjects();

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
            <label className="text-sm font-medium">Grado</label>
            <Select
              value={selectedGrade?.toString() ?? ''}
              onValueChange={(v) => onGradeChange(Number(v))}
              disabled={!selectedSchoolYear}
            >
              <SelectTrigger><SelectValue placeholder="Seleccioná un grado..." /></SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g.toString()}>{g}° grado</SelectItem>
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