'use client';

import { useState }   from 'react';
import { Button }     from '@/components/ui/button';
import { Label }      from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
}                     from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
}                     from '@/components/ui/select';
import { useCourses, useSchoolYears } from '@/lib/api/courses';
import { useAssignSubject }           from '@/lib/api/student-subjects';

interface Props {
  studentId:    string;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignSubjectDialog({ studentId, open, onOpenChange }: Props) {
  const [type,            setType]            = useState<'RECURSE' | 'EXEMPT'>('RECURSE');
  const [schoolYearId,    setSchoolYearId]    = useState('');
  const [courseId,        setCourseId]        = useState('');
  const [courseSubjectId, setCourseSubjectId] = useState('');

  const { data: schoolYears } = useSchoolYears();
  const { data: courses }     = useCourses();
  const assignSubject         = useAssignSubject(studentId);

  // Materias del curso seleccionado
  const selectedCourse   = (courses as any[])?.find(c => c.id === courseId);
  const courseSubjects   = selectedCourse?.courseSubjects ?? [];

  function handleCourseChange(id: string) {
    setCourseId(id);
    setCourseSubjectId(''); // resetear materia al cambiar curso
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await assignSubject.mutateAsync({ courseSubjectId, schoolYearId, type });
    onOpenChange(false);
    setType('RECURSE');
    setSchoolYearId('');
    setCourseId('');
    setCourseSubjectId('');
  }

  const canSubmit = !!courseSubjectId && !!schoolYearId && !assignSubject.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar materia</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'RECURSE' | 'EXEMPT')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent modal={false}>
                <SelectItem value="RECURSE">Recursada — el alumno va a cursar esta materia</SelectItem>
                <SelectItem value="EXEMPT">Eximida — el alumno no cursa esta materia este año</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {type === 'RECURSE'
                ? 'El alumno asiste físicamente a este curso para cursar la materia.'
                : 'El director decidió que el alumno no curse esta materia (límite de horas u otro motivo).'}
            </p>
          </div>

          {/* Año lectivo */}
          <div className="space-y-2">
            <Label>Año lectivo *</Label>
            <Select value={schoolYearId} onValueChange={setSchoolYearId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná el año" />
              </SelectTrigger>
              <SelectContent modal={false}>
                {(schoolYears as any[])?.map(sy => (
                  <SelectItem key={sy.id} value={sy.id}>{sy.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Curso */}
          <div className="space-y-2">
            <Label>Curso *</Label>
            <Select value={courseId} onValueChange={handleCourseChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná el curso" />
              </SelectTrigger>
              <SelectContent modal={false}>
                {(courses as any[])?.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.schoolYear?.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Materia del curso */}
          <div className="space-y-2">
            <Label>Materia *</Label>
            <Select
              value={courseSubjectId}
              onValueChange={setCourseSubjectId}
              disabled={!courseId}
            >
              <SelectTrigger>
                <SelectValue placeholder={courseId ? 'Seleccioná la materia' : 'Primero elegí un curso'} />
              </SelectTrigger>
              <SelectContent modal={false}>
                {courseSubjects.map((cs: any) => (
                  <SelectItem key={cs.id} value={cs.id}>
                    {cs.subject.name}
                    {cs.teacher && (
                      <span className="text-muted-foreground ml-1">
                        — {cs.teacher.firstName} {cs.teacher.lastName}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {assignSubject.isPending ? 'Asignando...' : 'Asignar materia'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}