'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useBulkAttendance, useAttendance } from '@/lib/api/attendance';
import { useCourses } from '@/lib/api/courses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Save } from 'lucide-react';
import { AttendanceStatus, statusConfig } from './attendance.types';

interface Props {
  selectedCourse: string;
  selectedDate:   string;
  courses:        { id: string; name: string }[] | undefined;
}

export function TakeAttendanceTab({ selectedCourse, selectedDate, courses }: Props) {
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const bulkAttendance        = useBulkAttendance();

  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn:  async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  const { data: existingAttendance } = useAttendance({
    courseId: selectedCourse || undefined,
    date:     selectedDate,
  });

  // Inicializar estados cuando carga el curso o hay registros previos
  useEffect(() => {
    if (!courseDetail?.courseStudents) return;
    const initial: Record<string, AttendanceStatus> = {};
    courseDetail.courseStudents
      .filter((cs: any) => cs.status === 'ACTIVE')
      .forEach((cs: any) => {
        const existing = existingAttendance?.find((a) => a.student.id === cs.student.id);
        initial[cs.student.id] = existing?.status ?? 'PRESENT';
      });
    setRecords(initial);
  }, [courseDetail, existingAttendance]);

  function toggleStatus(studentId: string) {
    const order: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT'];
    const current = records[studentId] ?? 'PRESENT';
    const next    = order[(order.indexOf(current) + 1) % order.length];
    setRecords((prev) => ({ ...prev, [studentId]: next }));
  }

  async function handleSave() {
    if (!selectedCourse || Object.keys(records).length === 0) return;
    await bulkAttendance.mutateAsync({
      courseId: selectedCourse,
      date:     selectedDate,
      records:  Object.entries(records).map(([studentId, status]) => ({ studentId, status })),
    });
  }

  const activeStudents = courseDetail?.courseStudents?.filter(
    (cs: any) => cs.status === 'ACTIVE',
  ) ?? [];

  const summary = Object.values(records).reduce(
    (acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  if (!selectedCourse) return null;

  return (
    <>
      {/* Resumen de estados */}
      {activeStudents.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
            const config = statusConfig[status];
            return (
              <Card key={status}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                  <p className={`text-2xl font-semibold mt-0.5 ${config.color}`}>
                    {summary[status] ?? 0}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lista de alumnos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {courses?.find((c) => c.id === selectedCourse)?.name} —{' '}
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </CardTitle>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={bulkAttendance.isPending || activeStudents.length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              {bulkAttendance.isPending ? 'Guardando...' : 'Guardar lista'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {activeStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-4">
              No hay alumnos en este curso
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStudents.map((cs: any) => {
                  const status = records[cs.student.id] ?? 'PRESENT';
                  const config = statusConfig[status];
                  const Icon   = config.icon;
                  return (
                    <TableRow
                      key={cs.student.id}
                      className="cursor-pointer"
                      onClick={() => toggleStatus(cs.student.id)}
                    >
                      <TableCell className="font-medium">
                        {cs.student.lastName}, {cs.student.firstName}
                      </TableCell>
                      <TableCell className="text-right">
                        <button className={`flex items-center gap-1.5 ml-auto ${config.color}`}>
                          <Icon className="h-4 w-4" />
                          <span className="text-sm">{config.label}</span>
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Hacé click en el estado de cada alumno para cambiarlo: Presente → Tarde → Ausente
      </p>
    </>
  );
}