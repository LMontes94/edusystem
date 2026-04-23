'use client';

import { useParams, useRouter } from 'next/navigation';
import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useStudent } from '@/lib/api/students';
import { PersonalInfoCard } from './_components/personal-info-card';
import { CoursesCard }      from './_components/courses-card';
import { GuardiansCard }    from './_components/guardians-card';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: student, isLoading } = useStudent(id);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando...</div>
  );
  if (!student) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">Alumno no encontrado</div>
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

      <PersonalInfoCard student={student} />
      <CoursesCard
        studentId={id}
        courseStudents={student.courseStudents ?? []}
      />
      <GuardiansCard guardians={student.guardians ?? []} />

    </div>
  );
}