'use client';

import { useState } from 'react';
import { useStudent } from '@/lib/api/students';
import { useCourses, useEnrollStudent } from '@/lib/api/courses';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, User, BookOpen, Users, Plus } from 'lucide-react';

export default function StudentDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const { data: student, isLoading } = useStudent(id);
  const { data: courses }            = useCourses();
  const enrollStudent                = useEnrollStudent();

  // Filtrar cursos en los que el alumno ya está matriculado
  const enrolledCourseIds = new Set(
    student?.courseStudents?.map((cs) => cs.course.id) ?? [],
  );
  const availableCourses = courses?.filter((c) => !enrolledCourseIds.has(c.id));

  async function handleEnroll() {
    if (!selectedCourseId) return;
    await enrollStudent.mutateAsync({ studentId: id, courseId: selectedCourseId });
    setEnrollDialogOpen(false);
    setSelectedCourseId('');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Alumno no encontrado
      </div>
    );
  }

  const age = Math.floor(
    (new Date().getTime() - new Date(student.birthDate).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000),
  );

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            {student.lastName}, {student.firstName}
          </h1>
          <p className="text-sm text-muted-foreground">DNI {student.documentNumber}</p>
        </div>
        <Badge variant={student.isActive ? 'default' : 'secondary'}>
          {student.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      {/* Datos personales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Nombre completo</dt>
              <dd className="font-medium mt-0.5">
                {student.firstName} {student.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">DNI</dt>
              <dd className="font-medium mt-0.5">{student.documentNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fecha de nacimiento</dt>
              <dd className="font-medium mt-0.5">
                {new Date(student.birthDate).toLocaleDateString('es-AR')} ({age} años)
              </dd>
            </div>
            {student.bloodType && (
              <div>
                <dt className="text-muted-foreground">Grupo sanguíneo</dt>
                <dd className="font-medium mt-0.5">{student.bloodType}</dd>
              </div>
            )}
            {student.medicalNotes && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Notas médicas</dt>
                <dd className="font-medium mt-0.5">{student.medicalNotes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Cursos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Cursos
            </CardTitle>
            <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Matricular
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Matricular en un curso</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná un curso..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCourses?.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No hay cursos disponibles
                        </SelectItem>
                      ) : (
                        availableCourses?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} — {c.schoolYear?.year}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setEnrollDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleEnroll}
                      disabled={!selectedCourseId || enrollStudent.isPending}
                    >
                      {enrollStudent.isPending ? 'Matriculando...' : 'Matricular'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {student.courseStudents?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cursos asignados</p>
          ) : (
            <div className="space-y-2">
              {student.courseStudents?.map((cs) => (
                <div
                  key={cs.course.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-sm font-medium">{cs.course.name}</span>
                  <Badge variant={cs.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {cs.status === 'ACTIVE' ? 'Activo' : cs.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tutores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Tutores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {student.guardians?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tutores vinculados</p>
          ) : (
            <div className="space-y-2">
              {student.guardians?.map((g) => (
                <div
                  key={g.user.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {g.user.firstName} {g.user.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{g.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground capitalize">
                      {g.relationship.toLowerCase()}
                    </span>
                    {g.isPrimary && <Badge variant="outline">Principal</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}