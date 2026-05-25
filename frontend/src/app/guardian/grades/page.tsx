'use client';

import { useState } from 'react';
import { useMyChildren } from '@/lib/api/students';
import { useGrades } from '@/lib/api/grades';
import { GuardianStudentSelector } from '@/components/guardian/guardian-student-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

export default function GuardianGradesPage() {
  const { data: children } = useMyChildren();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const { data: grades, isLoading, isError } = useGrades({
    studentId: selectedStudentId || undefined,
  });

  const groupedBySubject: Record<string, typeof grades> = {};
  if (grades) {
    for (const g of grades) {
      const key = g.courseSubject?.subject?.name ?? 'Sin materia';
      if (!groupedBySubject[key]) groupedBySubject[key] = [];
      groupedBySubject[key].push(g);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Notas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consultá las notas de tus hijos
        </p>
      </div>

      {(!children || children.length === 0) ? (
        <p className="text-sm text-muted-foreground">
          No hay alumnos vinculados a tu cuenta
        </p>
      ) : (
        <>
          <GuardianStudentSelector
            value={selectedStudentId}
            onValueChange={setSelectedStudentId}
            placeholder="Seleccionar hijo..."
          />

          {!selectedStudentId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <AlertCircle className="h-4 w-4" />
              Seleccioná un alumno para ver sus notas
            </div>
          )}

          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {isError && (
            <p className="text-sm text-destructive">
              Error al cargar las notas
            </p>
          )}

          {!isLoading && !isError && selectedStudentId && grades?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay notas registradas
            </p>
          )}

          {!isLoading && !isError && Object.entries(groupedBySubject).length > 0 && (
            <div className="space-y-4">
              {Object.entries(groupedBySubject).map(([subject, subjectGrades]) => {
                if (!subjectGrades) return null;
                return (
                <Card key={subject}>
                  <CardHeader className="pb-2 px-5 pt-4">
                    <CardTitle className="text-sm font-semibold">{subject}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <div className="space-y-2">
                      {subjectGrades.map((g) => (
                        <div
                          key={g.id}
                          className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="truncate">
                              {g.type === 'EXAM' ? 'Examen'
                                : g.type === 'ASSIGNMENT' ? 'Trabajo práctico'
                                : g.type === 'ORAL' ? 'Oral'
                                : g.type === 'PROJECT' ? 'Proyecto'
                                : g.type === 'PARTICIPATION' ? 'Participación'
                                : g.type}
                              {g.description && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  — {g.description}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {g.period?.name} · {g.date.split('-').reverse().join('/')}
                            </p>
                          </div>
                          <Badge
                            variant={Number(g.score) >= 6 ? 'default' : 'destructive'}
                            className="text-xs shrink-0 ml-3"
                          >
                            {g.score}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
