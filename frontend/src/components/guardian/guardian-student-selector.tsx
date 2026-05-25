'use client';

import { useMyChildren, type Student } from '@/lib/api/students';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export interface GuardianStudentSelectorProps {
  value: string;
  onValueChange: (studentId: string) => void;
  placeholder?: string;
}

export function GuardianStudentSelector({
  value,
  onValueChange,
  placeholder = 'Seleccionar hijo...',
}: GuardianStudentSelectorProps) {
  const { data: children, isLoading, isError } = useMyChildren();

  if (isLoading) {
    return <Skeleton className="h-9 w-full" />;
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Error al cargar tus hijos
      </p>
    );
  }

  if (!children || children.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay alumnos vinculados a tu cuenta
      </p>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {children.map((child: Student) => {
          const course = child.courseStudents?.find(
            (cs) => cs.status === 'ACTIVE',
          );
          const label = course
            ? `${child.firstName} ${child.lastName} — ${course.course.grade}° ${course.course.division}`
            : `${child.firstName} ${child.lastName}`;
          return (
            <SelectItem key={child.id} value={child.id}>
              {label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
