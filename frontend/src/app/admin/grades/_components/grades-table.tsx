'use client';

import { useState }  from 'react';
import { useQuery }  from '@tanstack/react-query';
import { api }       from '@/lib/api';
import { Badge }     from '@/components/ui/badge';
import { Button }    from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 }    from 'lucide-react';
import { useCourses, usePeriods } from '@/lib/api/courses';
import { useGrades, useDeleteGrade } from '@/lib/api/grades';
import { typeLabels, scoreColor } from './grades.types';

export function GradesTable() {
  const [selectedCourse,  setSelectedCourse]  = useState('');
  const [selectedPeriod,  setSelectedPeriod]  = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const { data: courses }    = useCourses();
  const { data: grades, isLoading } = useGrades({
    periodId: selectedPeriod && selectedPeriod !== 'all' ? selectedPeriod : undefined,
  });
  const deleteGrade = useDeleteGrade();

  const selectedCourseData = courses?.find((c) => c.id === selectedCourse);
  const { data: periods }  = usePeriods(selectedCourseData?.schoolYearId ?? undefined);

  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn:  async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  const subjects = courseDetail?.courseSubjects?.map((cs: any) => cs.subject) ?? [];

  const filtered = grades?.filter((g) => {
    const matchesCourse  = !selectedCourse  || selectedCourse  === 'all' ||
      courseDetail?.courseSubjects?.some((cs: any) => cs.id === g.courseSubject.id);
    const matchesPeriod  = !selectedPeriod  || selectedPeriod  === 'all' || g.period.id === selectedPeriod;
    const matchesSubject = !selectedSubject || selectedSubject === 'all' || g.courseSubject.subject.id === selectedSubject;
    return matchesCourse && matchesPeriod && matchesSubject;
  });

  return (
    <div className="space-y-4">

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={selectedCourse} onValueChange={(v) => {
          setSelectedCourse(v === 'all' ? '' : v);
          setSelectedPeriod('');
          setSelectedSubject('');
        }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por curso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los cursos</SelectItem>
            {courses?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedPeriod}
          onValueChange={setSelectedPeriod}
          disabled={!selectedCourse || selectedCourse === 'all'}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los períodos</SelectItem>
            {periods?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedSubject}
          onValueChange={setSelectedSubject}
          disabled={!selectedCourse || selectedCourse === 'all'}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por materia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las materias</SelectItem>
            {subjects.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Materia</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay notas registradas
                </TableCell>
              </TableRow>
            ) : (
              filtered?.map((grade) => (
                <TableRow key={grade.id}>
                  <TableCell className="font-medium">
                    {grade.student.lastName}, {grade.student.firstName}
                  </TableCell>
                  <TableCell>{grade.courseSubject.subject.name}</TableCell>
                  <TableCell>{grade.period.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{typeLabels[grade.type] ?? grade.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`font-semibold ${scoreColor(Number(grade.score))}`}>
                      {Number(grade.score).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(grade.date).toLocaleDateString('es-AR')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteGrade.mutate(grade.id)}
                      disabled={deleteGrade.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}