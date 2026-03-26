'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useGrades } from '@/lib/api/grades';
import { useAttendance, useBulkAttendance } from '@/lib/api/attendance';
import { useAnnouncements } from '@/lib/api/announcements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BookOpen, ClipboardList, Star, Megaphone,
  CheckCircle, XCircle, Clock, FileCheck, Save,
} from 'lucide-react';
import Link from 'next/link';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';

const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: React.ElementType }> = {
  PRESENT:   { label: 'Presente',    color: 'text-emerald-600', icon: CheckCircle },
  ABSENT:    { label: 'Ausente',     color: 'text-red-600',     icon: XCircle     },
  LATE:      { label: 'Tarde',       color: 'text-amber-600',   icon: Clock       },
  JUSTIFIED: { label: 'Justificado', color: 'text-blue-600',    icon: FileCheck   },
};

const typeLabels: Record<string, string> = {
  EXAM: 'Examen', ASSIGNMENT: 'Tarea', ORAL: 'Oral',
  PROJECT: 'Proyecto', PARTICIPATION: 'Participación',
};

export default function TeacherDashboardPage() {
  const { data: session }    = useSession();
  const today                = new Date().toISOString().split('T')[0];
  const [selectedCourse, setSelectedCourse] = useState('');
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const bulkAttendance        = useBulkAttendance();

  // Cursos del docente
  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn:  async () => {
      const res = await api.get('/courses');
      return res.data;
    },
  });

  // Detalle del curso seleccionado
  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn:  async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  // Asistencia existente hoy para el curso
  const { data: existingAttendance } = useAttendance({
    courseId: selectedCourse || undefined,
    date:     today,
  });

  // Inicializar registros con asistencia existente
  const activeStudents = courseDetail?.courseStudents?.filter(
    (cs: any) => cs.status === 'ACTIVE',
  ) ?? [];

  function getStatus(studentId: string): AttendanceStatus {
    if (records[studentId]) return records[studentId];
    const existing = existingAttendance?.find((a) => a.student.id === studentId);
    return existing?.status ?? 'PRESENT';
  }

  function toggleStatus(studentId: string) {
    const order: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'JUSTIFIED'];
    const current = getStatus(studentId);
    const next    = order[(order.indexOf(current) + 1) % order.length];
    setRecords((prev) => ({ ...prev, [studentId]: next }));
  }

  async function handleSaveAttendance() {
    if (!selectedCourse || activeStudents.length === 0) return;
    const recordsList = activeStudents.map((cs: any) => ({
      studentId: cs.student.id,
      status:    getStatus(cs.student.id),
    }));
    await bulkAttendance.mutateAsync({
      courseId: selectedCourse,
      date:     today,
      records:  recordsList,
    });
  }

  // Últimas notas cargadas por el docente
  const { data: recentGrades } = useGrades();

  // Comunicados recientes
  const { data: announcements } = useAnnouncements();
  const recentAnnouncements = announcements
    ?.filter((a) => !!a.publishedAt)
    .slice(0, 3);

  const todayFormatted = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">
          Hola, {session?.user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground capitalize">{todayFormatted}</p>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mis cursos</p>
                <p className="text-2xl font-semibold mt-1">{courses?.length ?? 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Notas cargadas</p>
                <p className="text-2xl font-semibold mt-1">{recentGrades?.length ?? 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-50">
                <Star className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lista de hoy</p>
                <p className="text-2xl font-semibold mt-1">
                  {existingAttendance?.length
                    ? `${existingAttendance.filter((a) => a.status === 'PRESENT').length}/${existingAttendance.length}`
                    : '—'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <ClipboardList className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comunicados</p>
                <p className="text-2xl font-semibold mt-1">{recentAnnouncements?.length ?? 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-50">
                <Megaphone className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">

        {/* Tomar lista rápida */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Tomar lista — hoy</CardTitle>
              <Link href="/teacher/attendance">
                <Button size="sm" variant="ghost" className="text-xs">Ver todo</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v); setRecords({}); }}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná un curso..." />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedCourse && activeStudents.length > 0 && (
              <>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {activeStudents.map((cs: any) => {
                    const status = getStatus(cs.student.id);
                    const config = statusConfig[status];
                    const Icon   = config.icon;
                    return (
                      <div
                        key={cs.student.id}
                        className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                        onClick={() => toggleStatus(cs.student.id)}
                      >
                        <span className="text-sm">
                          {cs.student.lastName}, {cs.student.firstName}
                        </span>
                        <span className={`flex items-center gap-1 text-xs ${config.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {config.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={handleSaveAttendance}
                  disabled={bulkAttendance.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {bulkAttendance.isPending ? 'Guardando...' : 'Guardar lista'}
                </Button>
              </>
            )}

            {selectedCourse && activeStudents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay alumnos en este curso
              </p>
            )}

            {!selectedCourse && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Seleccioná un curso para tomar lista
              </p>
            )}
          </CardContent>
        </Card>

        {/* Últimas notas */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Últimas notas cargadas</CardTitle>
              <Link href="/teacher/grades">
                <Button size="sm" variant="ghost" className="text-xs">Ver todo</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!recentGrades?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay notas cargadas
              </p>
            ) : (
              <div className="space-y-2">
                {recentGrades.slice(0, 5).map((grade) => (
                  <div key={grade.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {grade.student.lastName}, {grade.student.firstName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {grade.courseSubject.subject.name} · {typeLabels[grade.type] ?? grade.type}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${
                      Number(grade.score) >= 7 ? 'text-emerald-600'
                      : Number(grade.score) >= 4 ? 'text-amber-600'
                      : 'text-red-600'
                    }`}>
                      {Number(grade.score).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comunicados recientes */}
        {recentAnnouncements && recentAnnouncements.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Comunicados recientes
                </CardTitle>
                <Link href="/teacher/announcements">
                  <Button size="sm" variant="ghost" className="text-xs">Ver todo</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentAnnouncements.map((ann) => (
                  <div key={ann.id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{ann.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ann.author.firstName} {ann.author.lastName} ·{' '}
                        {new Date(ann.publishedAt!).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {ann.scope === 'INSTITUTION' ? 'Institución' : (ann.course as any)?.name}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}