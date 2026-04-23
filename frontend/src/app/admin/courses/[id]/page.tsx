'use client';

import { useParams, useRouter } from 'next/navigation';
import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCourseDetail } from '@/lib/api/courses';
import { CourseSubjectsCard } from './_components/course-subject-card';
import { CourseStudentsCard } from './_components/course-student-card';

const levelLabel: Record<string, string> = {
  INICIAL:    'Inicial',
  PRIMARIA:   'Primaria',
  SECUNDARIA: 'Secundaria',
};

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: course, isLoading } = useCourseDetail(id);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      Cargando...
    </div>
  );

  if (!course) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      Curso no encontrado
    </div>
  );

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
            {levelLabel[course.level] ?? course.level} · Año {course.schoolYear.year}
          </p>
        </div>
        {course.schoolYear.isActive && <Badge>Año activo</Badge>}
      </div>

      <CourseSubjectsCard
        courseId={id}
        courseSubjects={course.courseSubjects ?? []}
      />

      <CourseStudentsCard
        courseId={id}
        courseName={course.name}
        students={course.courseStudents ?? []}
      />

    </div>
  );
}