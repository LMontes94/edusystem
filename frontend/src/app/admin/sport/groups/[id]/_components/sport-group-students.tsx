'use client';

import { useState }  from 'react';
import { Button }    from '@/components/ui/button';
import { Badge }     from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
}                    from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
}                    from '@/components/ui/alert-dialog';
import { UserMinusIcon, UserPlusIcon } from 'lucide-react';
import {
  useAddStudentsToGroup,
  useRemoveStudentFromGroup,
  SportGroup,
}                    from '@/lib/api/sports';
import { useStudents } from '@/lib/api/students';

interface Props {
  group:      SportGroup;
  isOnLeave:  boolean;
}

export function SportGroupStudents({ group, isOnLeave }: Props) {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [removeStudentId, setRemoveStudentId] = useState<string | null>(null);

  const { data: allStudents }   = useStudents();
  const addStudents             = useAddStudentsToGroup();
  const removeStudent           = useRemoveStudentFromGroup();

  const enrolledIds  = group.students.map(s => s.studentId);
  const available    = allStudents?.filter(s => !enrolledIds.includes(s.id)) ?? [];
  const removeTarget = group.students.find(s => s.studentId === removeStudentId);

  function handleAdd() {
    if (!selectedStudent) return;
    addStudents.mutate({ id: group.id, studentIds: [selectedStudent] });
    setSelectedStudent('');
  }

  return (
    <div className="space-y-4">
      {/* Agregar alumno */}
      {!isOnLeave && (
        <div className="flex gap-2">
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Agregar alumno al grupo..." />
            </SelectTrigger>
            <SelectContent>
              {available.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.lastName}, {s.firstName} — {s.documentNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleAdd}
            disabled={!selectedStudent || addStudents.isPending}
          >
            <UserPlusIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Lista de alumnos */}
      {group.students.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay alumnos en este grupo todavía.
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          {group.students.map(({ student, studentId }) => (
            <div key={studentId} className="flex items-center justify-between px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">
                  {student.lastName}, {student.firstName}
                </p>
                <p className="text-xs text-muted-foreground">{student.documentNumber}</p>
              </div>
              {!isOnLeave && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setRemoveStudentId(studentId)}
                >
                  <UserMinusIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirm remove */}
      <AlertDialog
        open={!!removeStudentId}
        onOpenChange={open => { if (!open) setRemoveStudentId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar alumno del grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget && (
                <>
                  {removeTarget.student.firstName} {removeTarget.student.lastName} será removido de {group.name}.
                  Sus registros de asistencia no se verán afectados.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeStudentId) {
                  removeStudent.mutate({ id: group.id, studentId: removeStudentId });
                  setRemoveStudentId(null);
                }
              }}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}