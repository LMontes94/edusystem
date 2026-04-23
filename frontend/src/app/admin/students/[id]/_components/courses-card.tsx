'use client';

import { useState }    from 'react';
import { Badge }       from '@/components/ui/badge';
import { Button }      from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Plus } from 'lucide-react';
import { useCourses, useEnrollStudent } from '@/lib/api/courses';

interface CourseStudent {
  course: { id: string; name: string };
  status: string;
}

interface Props {
  studentId:      string;
  courseStudents: CourseStudent[];
}

export function CoursesCard({ studentId, courseStudents }: Props) {
  const [open,             setOpen]             = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const { data: allCourses } = useCourses();
  const enrollStudent        = useEnrollStudent();

  const enrolledIds      = new Set(courseStudents.map((cs) => cs.course.id));
  const availableCourses = allCourses?.filter((c) => !enrolledIds.has(c.id));

  async function handleEnroll() {
    if (!selectedCourseId) return;
    await enrollStudent.mutateAsync({ studentId, courseId: selectedCourseId });
    setOpen(false);
    setSelectedCourseId('');
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Cursos
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Matricular
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Matricular en un curso</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un curso..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCourses?.length === 0 ? (
                      <SelectItem value="none" disabled>No hay cursos disponibles</SelectItem>
                    ) : (
                      availableCourses?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {(c as any).schoolYear?.year}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={handleEnroll}
                    disabled={!selectedCourseId || enrollStudent.isPending}
                  >
                    {enrollStudent.isPending ? 'Matriculando...' : 'Matricular'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {courseStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cursos asignados</p>
        ) : (
          <div className="space-y-2">
            {courseStudents.map((cs) => (
              <div
                key={cs.course.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm font-medium">{cs.course.name}</span>
                <Badge variant={cs.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {cs.status === 'ACTIVE' ? 'Activo' : cs.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}