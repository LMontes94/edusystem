'use client';

import { useState }  from 'react';
import { useQuery }  from '@tanstack/react-query';
import { api }       from '@/lib/api';
import { Badge }     from '@/components/ui/badge';
import { Button }    from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input }     from '@/components/ui/input';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { useAssignSubject, useRemoveSubject } from '@/lib/api/courses';

interface CourseSubject {
  id:           string;
  hoursPerWeek: number | null;
  subject:      { id: string; name: string; code: string; color: string | null };
  teacher:      { id: string; firstName: string; lastName: string };
}

interface Props {
  courseId:       string;
  courseSubjects: CourseSubject[];
}

export function CourseSubjectsCard({ courseId, courseSubjects }: Props) {
  const [open,            setOpen]            = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [hoursPerWeek,    setHoursPerWeek]    = useState('');

  const assignSubject = useAssignSubject(courseId);
  const removeSubject = useRemoveSubject(courseId);

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn:  async () => {
      const res = await api.get('/subjects');
      return res.data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn:  async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });

  const teachersList = (users as any[])?.filter((u) =>
    ['TEACHER', 'PRECEPTOR'].includes(u.role),
  );

  // Materias que todavía no están asignadas al curso
  const availableSubjects = (subjects as any[])?.filter((s) =>
    !courseSubjects.some((cs) => cs.subject.id === s.id),
  );

  function handleClose() {
    setOpen(false);
    setSelectedSubject('');
    setSelectedTeacher('');
    setHoursPerWeek('');
  }

  async function handleAssign() {
    await assignSubject.mutateAsync({
      subjectId:    selectedSubject,
      teacherId:    selectedTeacher,
      hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : undefined,
    });
    handleClose();
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Materias y docentes
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Asignar materia
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {courseSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin materias asignadas</p>
          ) : (
            <div className="space-y-2">
              {courseSubjects.map((cs) => (
                <div key={cs.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="flex items-center gap-3">
                    {cs.subject.color && (
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cs.subject.color }} />
                    )}
                    <div>
                      <p className="text-sm font-medium">{cs.subject.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cs.teacher.firstName} {cs.teacher.lastName}
                        {cs.hoursPerWeek && ` · ${cs.hoursPerWeek}hs/sem`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{cs.subject.code}</Badge>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSubject.mutate(cs.id)}
                      disabled={removeSubject.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog asignar */}
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Asignar materia al curso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Materia</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger><SelectValue placeholder="Seleccioná una materia..." /></SelectTrigger>
                <SelectContent>
                  {availableSubjects?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Docente</label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un docente..." /></SelectTrigger>
                <SelectContent>
                  {teachersList?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.lastName}, {t.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Horas semanales (opcional)</label>
              <Input
                type="number" min={1} max={40} placeholder="Ej: 5"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedSubject || !selectedTeacher || assignSubject.isPending}
              >
                {assignSubject.isPending ? 'Asignando...' : 'Asignar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}