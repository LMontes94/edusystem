'use client';

import Link              from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Users, BookOpen, ChevronRight } from 'lucide-react';
import { Course, levelLabel, levelColor } from './courses.types';

interface Props {
  course: Course;
}

export function CourseCard({ course }: Props) {
  return (
    <Link href={`/admin/courses/${course.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardContent className="pt-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="font-semibold truncate">{course.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${levelColor[course.level] ?? 'bg-gray-100 text-gray-700'}`}>
                  {levelLabel[course.level] ?? course.level}
                </span>
                <span className="text-xs text-muted-foreground">
                  {course.schoolYear?.year}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          </div>
          <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {course._count?.courseStudents ?? 0} alumnos
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {course._count?.courseSubjects ?? 0} materias
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}