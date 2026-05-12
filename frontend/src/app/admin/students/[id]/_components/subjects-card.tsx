'use client';

import { useState }   from 'react';
import { Badge }      from '@/components/ui/badge';
import { Button }     from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
}                     from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipTrigger,
}                     from '@/components/ui/tooltip';
import {
  BookOpen, Plus, Trash2, RefreshCw, EyeOff, Info,
}                     from 'lucide-react';
import {
  useStudentSubjects,
  useRemoveSubjectAssignment,
  StudentSubjectAssignment,
  RegularSubject,
}                     from '@/lib/api/student-subjects';
import { useSchoolYears } from '@/lib/api/courses';
import { AssignSubjectDialog } from './assign-subject-dialog';

interface Props {
  studentId: string;
}

// ─── Fila de materia regular ──────────────────────────────────────────────────
function RegularRow({ subject }: { subject: RegularSubject }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{subject.courseSubject.subject.name}</p>
        <p className="text-xs text-muted-foreground">
          {subject.courseSubject.course.name} ·{' '}
          {subject.courseSubject.teacher.firstName} {subject.courseSubject.teacher.lastName}
        </p>
      </div>
      <Badge variant="secondary" className="shrink-0 ml-2">Regular</Badge>
    </div>
  );
}

// ─── Fila de materia asignada (recurse / exempt) ──────────────────────────────
function AssignedRow({
  assignment,
  onRemove,
  isOnLeave,
}: {
  assignment:  StudentSubjectAssignment;
  onRemove:    (id: string) => void;
  isOnLeave:   boolean;
}) {
  const isRecurse = assignment.type === 'RECURSE';

  return (
    <div className={`flex items-center justify-between rounded-md border px-3 py-2 ${
      isRecurse ? 'border-indigo-200 bg-indigo-50/50' : 'border-amber-200 bg-amber-50/50'
    }`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {assignment.courseSubject.subject.name}
          </p>
          {isRecurse
            ? <RefreshCw className="h-3 w-3 text-indigo-500 shrink-0" />
            : <EyeOff    className="h-3 w-3 text-amber-500  shrink-0" />
          }
        </div>
        <p className="text-xs text-muted-foreground">
          {assignment.courseSubject.course.name} ·{' '}
          {assignment.courseSubject.teacher.firstName} {assignment.courseSubject.teacher.lastName}
        </p>
        {assignment.createdBy && (
          <p className="text-xs text-muted-foreground/70">
            Asignado por {assignment.createdBy.firstName} {assignment.createdBy.lastName}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 ml-2 shrink-0">
        <Badge
          variant="outline"
          className={isRecurse
            ? 'border-indigo-300 text-indigo-700'
            : 'border-amber-300  text-amber-700'
          }
        >
          {isRecurse ? 'Recursada' : 'Eximida'}
        </Badge>
        {!isOnLeave && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(assignment.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Card principal ───────────────────────────────────────────────────────────
export function SubjectsCard({ studentId }: Props) {
  const [assignOpen,  setAssignOpen]  = useState(false);
  const [removeId,    setRemoveId]    = useState<string | null>(null);
  const [schoolYearId, setSchoolYearId] = useState<string | undefined>(undefined);

  const { data: schoolYears }  = useSchoolYears();
  const { data: subjects, isLoading } = useStudentSubjects(studentId, schoolYearId);
  const removeAssignment = useRemoveSubjectAssignment(studentId);

  // Usar el año activo por defecto
  const activeYear = (schoolYears as any[])?.find(sy => sy.isActive);
  const displayYear = schoolYearId
    ? (schoolYears as any[])?.find(sy => sy.id === schoolYearId)
    : activeYear;

  // Inicializar con el año activo la primera vez
  if (!schoolYearId && activeYear?.id) {
    setSchoolYearId(activeYear.id);
  }

  const regular = subjects?.regular ?? [];
  const recurse = subjects?.recurse ?? [];
  const exempt  = subjects?.exempt  ?? [];
  const total   = regular.length + recurse.length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Materias
              {displayYear && (
                <Badge variant="outline" className="font-normal">
                  {displayYear.year}
                </Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* Selector de año lectivo */}
              {(schoolYears as any[])?.length > 1 && (
                <select
                  value={schoolYearId ?? ''}
                  onChange={e => setSchoolYearId(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-background text-foreground"
                >
                  {(schoolYears as any[])?.map(sy => (
                    <option key={sy.id} value={sy.id}>{sy.year}</option>
                  ))}
                </select>
              )}

              <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Asignar materia
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando materias...</p>
          ) : total === 0 && exempt.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin materias asignadas para este año.
            </p>
          ) : (
            <>
              {/* Materias regulares */}
              {regular.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Regulares ({regular.length})
                  </p>
                  {regular.map(s => (
                    <RegularRow key={s.id} subject={s} />
                  ))}
                </div>
              )}

              {/* Materias recursadas */}
              {recurse.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                      Recursando ({recurse.length})
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        El alumno cursa estas materias en otro año/curso
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {recurse.map(a => (
                    <AssignedRow
                      key={a.id}
                      assignment={a}
                      onRemove={setRemoveId}
                      isOnLeave={false}
                    />
                  ))}
                </div>
              )}

              {/* Materias eximidas */}
              {exempt.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                      Eximidas ({exempt.length})
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        El director decidió que el alumno no curse estas materias este año
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {exempt.map(a => (
                    <AssignedRow
                      key={a.id}
                      assignment={a}
                      onRemove={setRemoveId}
                      isOnLeave={false}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog asignar */}
      <AssignSubjectDialog
        studentId={studentId}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />

      {/* Confirm eliminar */}
      <AlertDialog
        open={!!removeId}
        onOpenChange={open => { if (!open) setRemoveId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar asignación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la asignación de esta materia. El alumno volverá a su configuración
              de materias por defecto del curso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeId) removeAssignment.mutate(removeId);
                setRemoveId(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}