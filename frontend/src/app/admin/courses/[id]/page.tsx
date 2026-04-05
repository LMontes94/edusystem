'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Users, BookOpen,Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface CourseDetail {
  id:         string;
  name:       string;
  grade:      number;
  division:   string;
  level:      string;
  schoolYear: { id: string; year: number; isActive: boolean };
  courseStudents: {
    status:  string;
    student: { id: string; firstName: string; lastName: string; documentNumber: string };
  }[];
  courseSubjects: {
    id:      string;
    hoursPerWeek: number | null;
    subject: { id: string; name: string; code: string; color: string | null };
    teacher: { id: string; firstName: string; lastName: string };
  }[];
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [hoursPerWeek,    setHoursPerWeek]    = useState('');

  const { data: course, isLoading } = useQuery({
    queryKey: ['courses', id],
    queryFn:  async () => {
      const res = await api.get<CourseDetail>(`/courses/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
 // Todas las materias de la institución
const { data: subjects } = useQuery({
  queryKey: ['subjects'],
  queryFn:  async () => {
    const res = await api.get('/subjects');
    return res.data;
  },
});

// Todos los docentes de la institución
const { data: teachers } = useQuery({
  queryKey: ['users'],
  queryFn:  async () => {
    const res = await api.get('/users');
    return res.data;
  },
});

const teachersList = teachers?.filter((u: any) =>
  ['TEACHER', 'PRECEPTOR'].includes(u.role)
);

// Agregar materia al curso
const assignMutation = useMutation({
  mutationFn: async () => {
    await api.post(`/courses/${id}/subjects`, {
      subjectId:   selectedSubject,
      teacherId:   selectedTeacher,
      hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : undefined,
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['courses', id] });
    toast.success('Materia asignada exitosamente');
    setAssignDialog(false);
    setSelectedSubject('');
    setSelectedTeacher('');
    setHoursPerWeek('');
  },
  onError: () => toast.error('Error al asignar la materia'),
});

// Quitar materia del curso
const removeMutation = useMutation({
  mutationFn: async (courseSubjectId: string) => {
    await api.delete(`/courses/${id}/subjects/${courseSubjectId}`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['courses', id] });
    toast.success('Materia quitada del curso');
  },
  onError: () => toast.error('Error al quitar la materia'),
});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Curso no encontrado
      </div>
    );
  }

  const activeStudents = course.courseStudents.filter((cs) => cs.status === 'ACTIVE');
  
 

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{course.name}</h1>
          <p className="text-sm text-muted-foreground">
            {course.level === 'PRIMARIA' ? 'Primaria' :
             course.level === 'SECUNDARIA' ? 'Secundaria' : 'Inicial'} ·
            Año {course.schoolYear.year}
          </p>
        </div>
        {course.schoolYear.isActive && (
          <Badge>Año activo</Badge>
        )}
      </div>

      {/* Materias y docentes */}
      <Card>
        <CardHeader className="pb-3">
  <div className="flex items-center justify-between">
    <CardTitle className="text-sm font-medium flex items-center gap-2">
      <BookOpen className="h-4 w-4" />
      Materias y docentes
    </CardTitle>
    <Button size="sm" variant="outline" onClick={() => setAssignDialog(true)}>
      <Plus className="h-3.5 w-3.5 mr-1.5" />
      Asignar materia
    </Button>
  </div>
</CardHeader>
        <CardContent>
          {course.courseSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin materias asignadas</p>
          ) : (
            <div className="space-y-2">
              {course.courseSubjects.map((cs) => (
  <div key={cs.id} className="flex items-center justify-between rounded-md border px-3 py-2">
    <div className="flex items-center gap-3">
      {cs.subject.color && (
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cs.subject.color }} />
      )}
      <div>
        <p className="text-sm font-medium">{cs.subject.name}</p>
        <p className="text-xs text-muted-foreground">
          {cs.teacher.firstName} {cs.teacher.lastName}
          {cs.hoursPerWeek && ` · ${cs.hoursPerWeek}hs/sem`}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant="outline">{cs.subject.code}</Badge>
      <Button
        size="icon" variant="ghost"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => removeMutation.mutate(cs.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alumnos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Alumnos ({activeStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-4">Sin alumnos matriculados</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStudents.map((cs) => (
                  <TableRow key={cs.student.id}>
                    <TableCell>
                      <Link
                        href={`/admin/students/${cs.student.id}`}
                        className="font-medium hover:underline"
                      >
                        {cs.student.lastName}, {cs.student.firstName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {cs.student.documentNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cs.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {cs.status === 'ACTIVE' ? 'Activo' : cs.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Asignar materia al curso</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Materia</label>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger><SelectValue placeholder="Seleccioná una materia..." /></SelectTrigger>
          <SelectContent>
            {(subjects as any[])?.filter((s: any) =>
              !course.courseSubjects.some((cs) => cs.subject.id === s.id)
            ).map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Docente</label>
        <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
          <SelectTrigger><SelectValue placeholder="Seleccioná un docente..." /></SelectTrigger>
          <SelectContent>
            {teachersList?.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>
                {t.lastName}, {t.firstName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Horas semanales (opcional)</label>
        <Input
          type="number"
          min={1}
          max={40}
          placeholder="Ej: 5"
          value={hoursPerWeek}
          onChange={(e) => setHoursPerWeek(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancelar</Button>
        <Button
          onClick={() => assignMutation.mutate()}
          disabled={!selectedSubject || !selectedTeacher || assignMutation.isPending}
        >
          {assignMutation.isPending ? 'Asignando...' : 'Asignar'}
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
    </div>
  );
}