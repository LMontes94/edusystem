'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAttendance, useBulkAttendance } from '@/lib/api/attendance';
import { useCourses } from '@/lib/api/courses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, FileCheck, Save } from 'lucide-react';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';

const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: React.ElementType }> = {
  PRESENT:   { label: 'Presente',   color: 'text-emerald-600', icon: CheckCircle },
  ABSENT:    { label: 'Ausente',    color: 'text-red-600',     icon: XCircle     },
  LATE:      { label: 'Tarde',      color: 'text-amber-600',   icon: Clock       },
  JUSTIFIED: { label: 'Justificado', color: 'text-blue-600',   icon: FileCheck   },
};

export default function AttendancePage() {
  const today = new Date().toISOString().split('T')[0];

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedDate,   setSelectedDate]   = useState(today);
  const [records,        setRecords]        = useState<Record<string, AttendanceStatus>>({});
  const [viewMode,       setViewMode]       = useState<'take' | 'history'>('take');

  const { data: courses }                 = useCourses();
  const bulkAttendance                    = useBulkAttendance();

  // Alumnos del curso seleccionado
  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn:  async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  // Historial de asistencia
  const { data: history } = useAttendance({
    courseId: selectedCourse || undefined,
    date:     viewMode === 'history' ? selectedDate : undefined,
  });
  
  const { data: existingAttendance } = useAttendance({
    courseId: selectedCourse || undefined,
    date:     selectedDate,
  });

  // Inicializar todos como PRESENT cuando carga el curso
  useEffect(() => {
  if (courseDetail?.courseStudents) {
    const initial: Record<string, AttendanceStatus> = {};
    courseDetail.courseStudents
      .filter((cs: any) => cs.status === 'ACTIVE')
      .forEach((cs: any) => {
        // Buscar si ya hay un registro para este alumno hoy
        const existing = existingAttendance?.find(
          (a) => a.student.id === cs.student.id
        );
        initial[cs.student.id] = existing?.status ?? 'PRESENT';
      });
    setRecords(initial);
  }
}, [courseDetail, existingAttendance]);

  function toggleStatus(studentId: string) {
    const order: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'JUSTIFIED'];
    const current = records[studentId] ?? 'PRESENT';
    const next    = order[(order.indexOf(current) + 1) % order.length];
    setRecords((prev) => ({ ...prev, [studentId]: next }));
  }

  async function handleSave() {
    if (!selectedCourse || Object.keys(records).length === 0) return;

    const recordsList = Object.entries(records).map(([studentId, status]) => ({
      studentId,
      status,
    }));

    await bulkAttendance.mutateAsync({
      courseId: selectedCourse,
      date:     selectedDate,
      records:  recordsList,
    });
  }

  const activeStudents = courseDetail?.courseStudents?.filter(
    (cs: any) => cs.status === 'ACTIVE',
  ) ?? [];

  const summary = Object.values(records).reduce(
    (acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Asistencia</h1>
          <p className="text-sm text-muted-foreground">
            Registrá la asistencia diaria por curso
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === 'take' ? 'default' : 'outline'}
            onClick={() => setViewMode('take')}
          >
            Tomar lista
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'history' ? 'default' : 'outline'}
            onClick={() => setViewMode('history')}
          >
            Historial
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Seleccioná un curso" />
          </SelectTrigger>
          <SelectContent>
            {courses?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-44"
        />
      </div>

      {/* ── Modo: Tomar lista ── */}
      {viewMode === 'take' && selectedCourse && (
        <>
          {/* Resumen */}
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
                  {courses?.find((c) => c.id === selectedCourse)?.name} — {
                    new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })
                  }
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
            Hacé click en el estado de cada alumno para cambiarlo: Presente → Tarde → Ausente → Justificado
          </p>
        </>
      )}

      {/* ── Modo: Historial ── */}
      {viewMode === 'history' && (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!history || history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {selectedCourse ? 'No hay registros para este día' : 'Seleccioná un curso para ver el historial'}
                  </TableCell>
                </TableRow>
              ) : (
                history.map((record) => {
                  const config = statusConfig[record.status];
                  const Icon   = config.icon;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.student.lastName}, {record.student.firstName}
                      </TableCell>
                      <TableCell>{record.course.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(record.date).toLocaleDateString('es-AR')}
                      </TableCell>
                      <TableCell>
                        <span className={`flex items-center gap-1.5 ${config.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {config.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {record.recordedBy.firstName} {record.recordedBy.lastName}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Placeholder cuando no hay curso seleccionado */}
      {!selectedCourse && (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Seleccioná un curso para comenzar
        </div>
      )}
    </div>
  );
}