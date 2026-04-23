'use client';

import { useState }   from 'react';
import { Input }      from '@/components/ui/input';
import { Search }     from 'lucide-react';
import { useCourses } from '@/lib/api/courses';
import { CourseCard }               from './_components/course-card';
import { CreateCourseDialog }       from './_components/create-course-dialog';
import { CreateSchoolYearDialog }   from './_components/create-school-year-dialog';
import { CreatePeriodDialog }       from './_components/create-period-dialog';

export default function CoursesPage() {
  const [search, setSearch] = useState('');

  const { data: courses, isLoading } = useCourses();

  const filtered = courses?.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.level.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cursos</h1>
          <p className="text-sm text-muted-foreground">
            {courses?.length ?? 0} cursos registrados
          </p>
        </div>
        <div className="flex gap-2">
          <CreatePeriodDialog />
          <CreateSchoolYearDialog />
          <CreateCourseDialog />
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cursos..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filtered?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No se encontraron cursos</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered?.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}

    </div>
  );
}