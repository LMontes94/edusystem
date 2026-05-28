'use client';

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  schoolYears: any[];
  selectedSchoolYear: string;
  onSchoolYearChange: (v: string) => void;
  courses: any[];
  selectedCourse: string;
  onCourseChange: (v: string) => void;
  courseDisabled?: boolean;
}

export function ReportFilters({
  schoolYears, selectedSchoolYear, onSchoolYearChange,
  courses, selectedCourse, onCourseChange,
  courseDisabled,
}: Props) {
  return (
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
        <label className="text-sm font-medium">Curso</label>
        <Select
          value={selectedCourse}
          onValueChange={(v) => { onCourseChange(v); }}
          disabled={courseDisabled}
        >
          <SelectTrigger><SelectValue placeholder="Seleccioná un curso..." /></SelectTrigger>
          <SelectContent>
            {courses?.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
