'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Users, BookOpen } from 'lucide-react';
import Link from 'next/link';

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

  const { data: course, isLoading } = useQuery({
    queryKey: ['courses', id],
    queryFn:  async () => {
      const res = await api.get<CourseDetail>(`/courses/${id}`);
      return res.data;
    },
    enabled: !!id,
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
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Materias y docentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {course.courseSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin materias asignadas</p>
          ) : (
            <div className="space-y-2">
              {course.courseSubjects.map((cs) => (
                <div
                  key={cs.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    {cs.subject.color && (
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: cs.subject.color }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium">{cs.subject.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cs.teacher.firstName} {cs.teacher.lastName}
                        {cs.hoursPerWeek && ` · ${cs.hoursPerWeek}hs/sem`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{cs.subject.code}</Badge>
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
    </div>
  );
}