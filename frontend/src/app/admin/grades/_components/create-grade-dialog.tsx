'use client';

import { useState, useEffect } from 'react';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery }    from '@tanstack/react-query';
import { api }         from '@/lib/api';
import { useAppSession } from '@/lib/hooks/use-app-session';
import { Button }      from '@/components/ui/button';
import { Input }       from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus }         from 'lucide-react';
import { useCourses, usePeriods } from '@/lib/api/courses';
import { useCreateGrade }         from '@/lib/api/grades';
import { createGradeSchema, CreateGradeForm, typeLabels } from './grades.types';

export function CreateGradeDialog() {
  const [open,           setOpen]           = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');

  const { data: session } = useAppSession();
  const createGrade = useCreateGrade();
  const { data: courses } = useCourses();

  const selectedCourseData = courses?.find((c) => c.id === selectedCourse);
  const { data: periods }  = usePeriods(selectedCourseData?.schoolYearId ?? undefined);

  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn:  async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  const isTeacher = session?.user?.role === 'TEACHER';
  const filteredSubjects = courseDetail?.courseSubjects
    ?.filter((cs: any) => isTeacher ? cs.teacherId === session?.user?.id : true) ?? [];

  const form = useForm<CreateGradeForm>({
    resolver:      zodResolver(createGradeSchema),
    defaultValues: { type: 'EXAM', date: new Date().toISOString().split('T')[0] },
  });

  useEffect(() => {
    if (filteredSubjects.length === 1) {
      form.setValue('courseSubjectId', filteredSubjects[0].id);
    }
  }, [selectedCourse, filteredSubjects]);

  async function onSubmit(data: CreateGradeForm) {
    await createGrade.mutateAsync(data);
    setOpen(false);
    form.reset();
    setSelectedCourse('');
  }

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (!o) { form.reset(); setSelectedCourse(''); }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Cargar nota
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cargar nota</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Curso — fuera del form pero afecta los selects dependientes */}
            <FormItem>
              <FormLabel>Curso</FormLabel>
              <Select onValueChange={setSelectedCourse} value={selectedCourse}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un curso..." /></SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>

            <FormField control={form.control} name="courseSubjectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Materia</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCourse}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccioná una materia..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredSubjects.map((cs: any) => (
                        <SelectItem key={cs.id} value={cs.id}>{cs.subject.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="studentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alumno</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCourse}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccioná un alumno..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {courseDetail?.courseStudents
                        ?.filter((cs: any) => cs.status === 'ACTIVE')
                        .map((cs: any) => (
                          <SelectItem key={cs.student.id} value={cs.student.id}>
                            {cs.student.lastName}, {cs.student.firstName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="periodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Período</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCourse}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccioná un período..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {periods?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota (0-10)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={10} step={0.01} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(typeLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField control={form.control} name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createGrade.isPending}>
                {createGrade.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}