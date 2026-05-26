'use client';

import { useGuardianStudents, useLinkStudent, useUnlinkStudent } from '@/lib/api/guardians';
import { StudentSearchCombobox } from './student-search-combobox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, X } from 'lucide-react';
import { StudentSearchResult } from '@/lib/api/guardians';

interface Props {
  userId: string;
  canManage: boolean;
}

export function FamilyRelationsCard({ userId, canManage }: Props) {
  const { data: links, isLoading, isError } = useGuardianStudents(userId);
  const linkStudent = useLinkStudent(userId);
  const unlinkStudent = useUnlinkStudent(userId);

  const linkedIds = (links ?? []).map((l) => l.student.id);

  async function handleLink(student: StudentSearchResult) {
    await linkStudent.mutateAsync({ studentId: student.id });
  }

  async function handleUnlink(studentId: string) {
    if (!confirm('¿Desvincular este alumno del tutor?')) return;
    await unlinkStudent.mutateAsync(studentId);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Relaciones familiares
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Administrá los alumnos vinculados a este tutor.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Cargando alumnos vinculados...</div>
        ) : isError ? (
          <div className="text-sm text-destructive">Error al cargar los alumnos vinculados</div>
        ) : links && links.length > 0 ? (
          <div className="space-y-2">
            {links.map((link) => {
              const initials = `${link.student.firstName[0]}${link.student.lastName[0]}`.toUpperCase();
              const course = link.student.courseStudents?.[0]?.course;
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {link.student.firstName} {link.student.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {course ? `${course.name}` : 'Sin curso asignado'}
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleUnlink(link.student.id)}
                      disabled={unlinkStudent.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">
            No hay alumnos vinculados.
            {canManage && ' Buscá un alumno para vincularlo a este tutor.'}
          </div>
        )}

        {canManage && (
          <div className="border-t pt-4">
            <StudentSearchCombobox
              onSelect={handleLink}
              excludeIds={linkedIds}
              disabled={linkStudent.isPending}
            />
          </div>
        )}

      </CardContent>
    </Card>
  );
}
