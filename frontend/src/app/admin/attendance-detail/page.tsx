'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useCourses } from '@/lib/api/courses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, FileCheck } from 'lucide-react';

interface AttendanceSummary {
  student: {
    id:            string;
    firstName:     string;
    lastName:      string;
    documentNumber: string;
  };
  present:   number;
  absent:    number;
  late:      number;
  justified: number;
  total:     number;
  rate:      number;
}

export default function AttendanceDetailPage() {
  const { data: session }       = useSession();
  const [selectedCourse,  setSelectedCourse]  = useState('');
  const [selectedMonth,   setSelectedMonth]   = useState('all');
  const [search,          setSearch]          = useState('');

  const { data: courses } = useCourses();

  // Filtrar cursos según rol
  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn:  async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  // Obtener toda la asistencia del curso
  const { data: attendance, isLoading } = useQuery({
    queryKey: ['attendance-detail', selectedCourse, selectedMonth],
    queryFn:  async () => {
      const params: any = { courseId: selectedCourse };
      if (selectedMonth !== 'all') {
        const year  = new Date().getFullYear();
        const month = selectedMonth.padStart(2, '0');
        const lastDay   = new Date(year, month, 0).getDate();
        params.dateFrom = `${year}-${month}-01`;
        params.dateTo   = `${year}-${month}-${lastDay}`;
      }
      const res = await api.get('/attendance', { params });
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  // Calcular resumen por alumno
  const summaries: AttendanceSummary[] = (() => {
    if (!attendance || !courseDetail) return [];

    const activeStudents = courseDetail.courseStudents?.filter(
      (cs: any) => cs.status === 'ACTIVE'
    ) ?? [];

    return activeStudents
      .map((cs: any) => {
        const studentAttendance = attendance.filter(
          (a: any) => a.student.id === cs.student.id
        );

        const present   = studentAttendance.filter((a: any) => a.status === 'PRESENT').length;
        const absent    = studentAttendance.filter((a: any) => a.status === 'ABSENT').length;
        const late      = studentAttendance.filter((a: any) => a.status === 'LATE').length;
        const justified = studentAttendance.filter((a: any) => a.status === 'JUSTIFIED').length;
        const total     = studentAttendance.length;
        const rate      = total > 0
          ? Math.round(((present + late) / total) * 100)
          : 0;

        return {
          student:   cs.student,
          present,
          absent,
          late,
          justified,
          total,
          rate,
        };
      })
      .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName));
  })();

  const filtered = summaries.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.student.firstName.toLowerCase().includes(q) ||
      s.student.lastName.toLowerCase().includes(q) ||
      s.student.documentNumber.includes(q)
    );
  });

  // Estadísticas globales del curso
  const globalStats = filtered.reduce(
    (acc, s) => {
      acc.present   += s.present;
      acc.absent    += s.absent;
      acc.late      += s.late;
      acc.justified += s.justified;
      acc.total     += s.total;
      return acc;
    },
    { present: 0, absent: 0, late: 0, justified: 0, total: 0 }
  );
  const globalRate = globalStats.total > 0
    ? Math.round(((globalStats.present + globalStats.late) / globalStats.total) * 100)
    : 0;

  const months = [
    { value: 'all', label: 'Todo el año' },
    { value: '3',   label: 'Marzo'      },
    { value: '4',   label: 'Abril'      },
    { value: '5',   label: 'Mayo'       },
    { value: '6',   label: 'Junio'      },
    { value: '7',   label: 'Julio'      },
    { value: '8',   label: 'Agosto'     },
    { value: '9',   label: 'Septiembre' },
    { value: '10',  label: 'Octubre'    },
    { value: '11',  label: 'Noviembre'  },
    { value: '12',  label: 'Diciembre'  },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Detalle de asistencia</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de asistencia por alumno y curso
        </p>
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

        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Buscar alumno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-3"
          />
        </div>
      </div>

      {!selectedCourse ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          Seleccioná un curso para ver el detalle de asistencia
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Cargando...
        </div>
      ) : (
        <>
          {/* Métricas globales del curso */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Presentes</p>
                    <p className="text-xl font-semibold text-emerald-600">{globalStats.present}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ausentes</p>
                    <p className="text-xl font-semibold text-red-600">{globalStats.absent}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tardanzas</p>
                    <p className="text-xl font-semibold text-amber-600">{globalStats.late}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Justificadas</p>
                    <p className="text-xl font-semibold text-blue-600">{globalStats.justified}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div>
                  <p className="text-xs text-muted-foreground">% Asistencia del curso</p>
                  <p className={`text-xl font-semibold ${
                    globalRate >= 80 ? 'text-emerald-600'
                    : globalRate >= 60 ? 'text-amber-600'
                    : 'text-red-600'
                  }`}>
                    {globalRate}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla por alumno */}
          <div className="rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead className="text-center">Presentes</TableHead>
                  <TableHead className="text-center">Ausentes</TableHead>
                  <TableHead className="text-center">Tardanzas</TableHead>
                  <TableHead className="text-center">Justificadas</TableHead>
                  <TableHead className="text-center">Total días</TableHead>
                  <TableHead className="text-center">% Asistencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay registros de asistencia
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((summary) => (
                    <TableRow key={summary.student.id}>
                      <TableCell>
                        <p className="font-medium text-sm">
                          {summary.student.lastName}, {summary.student.firstName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          DNI {summary.student.documentNumber}
                        </p>
                      </TableCell>
                      <TableCell className="text-center text-emerald-600 font-medium">
                        {summary.present}
                      </TableCell>
                      <TableCell className="text-center text-red-600 font-medium">
                        {summary.absent}
                      </TableCell>
                      <TableCell className="text-center text-amber-600 font-medium">
                        {summary.late}
                      </TableCell>
                      <TableCell className="text-center text-blue-600 font-medium">
                        {summary.justified}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {summary.total}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            summary.total === 0 ? 'secondary'
                            : summary.rate >= 80 ? 'default'
                            : summary.rate >= 60 ? 'secondary'
                            : 'destructive'
                          }
                        >
                          {summary.total === 0 ? 'Sin datos' : `${summary.rate}%`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}