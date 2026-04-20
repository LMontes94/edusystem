'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useGrades, useCreateGrade, useDeleteGrade, usePeriods } from '@/lib/api/grades';
import { useCourses }   from '@/lib/api/courses';
import { useIsOnLeave } from '@/lib/hooks/use-is-on-leave';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Badge }  from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, TableIcon, ListIcon } from 'lucide-react';
import BulkGradesEntry from '@/components/grades/bulk-grades-entry';

const createGradeSchema = z.object({
  studentId:       z.string().min(1, 'Requerido'),
  courseSubjectId: z.string().min(1, 'Requerido'),
  periodId:        z.string().min(1, 'Requerido'),
  score:           z.coerce.number().min(0).max(10),
  type:            z.enum(['EXAM', 'ASSIGNMENT', 'ORAL', 'PROJECT', 'PARTICIPATION']),
  description:     z.string().optional(),
  date:            z.string().min(1, 'Requerido'),
});
type CreateGradeForm = z.infer<typeof createGradeSchema>;

const typeLabels: Record<string, string> = {
  EXAM:          'Examen',
  ASSIGNMENT:    'Tarea',
  ORAL:          'Oral',
  PROJECT:       'Proyecto',
  PARTICIPATION: 'Participación',
};

export default function GradesPage() {
  const [view,            setView]            = useState<'list' | 'bulk'>('list');
  const [dialogOpen,      setDialogOpen]      = useState(false);
  const [selectedCourse,  setSelectedCourse]  = useState('');
  const [selectedPeriod,  setSelectedPeriod]  = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const { data: grades, isLoading } = useGrades({
    periodId: selectedPeriod && selectedPeriod !== 'all' ? selectedPeriod : undefined,
  });
  const { data: courses } = useCourses();
  const createGrade       = useCreateGrade();
  const deleteGrade       = useDeleteGrade();
  const isOnLeave         = useIsOnLeave();

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

  const subjects = courseDetail?.courseSubjects?.map((cs: any) => cs.subject) ?? [];

  const form = useForm<CreateGradeForm>({
    resolver: zodResolver(createGradeSchema),
    defaultValues: {
      type: 'EXAM',
      date: new Date().toISOString().split('T')[0],
    },
  });

  async function onSubmit(data: CreateGradeForm) {
    await createGrade.mutateAsync(data);
    setDialogOpen(false);
    form.reset();
  }

  const filteredGrades = grades?.filter((g) => {
    const matchesCourse  = !selectedCourse  || selectedCourse  === 'all' ||
      courseDetail?.courseSubjects?.some((cs: any) => cs.id === g.courseSubject.id);
    const matchesPeriod  = !selectedPeriod  || selectedPeriod  === 'all' || g.period.id === selectedPeriod;
    const matchesSubject = !selectedSubject || selectedSubject === 'all' || g.courseSubject.subject.id === selectedSubject;
    return matchesCourse && matchesPeriod && matchesSubject;
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notas</h1>
          <p className="text-sm text-muted-foreground">
            {view === 'list'
              ? `${filteredGrades?.length ?? 0} registros`
              : 'Carga masiva tipo Excel'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle de vista */}
          <div className="flex rounded-md border overflow-hidden">
            <Button
              size="sm"
              variant={view === 'list' ? 'default' : 'ghost'}
              className="rounded-none border-0"
              onClick={() => setView('list')}
            >
              <ListIcon className="h-4 w-4 mr-1.5" />
              Lista
            </Button>
            <Button
              size="sm"
              variant={view === 'bulk' ? 'default' : 'ghost'}
              className="rounded-none border-0 border-l"
              onClick={() => setView('bulk')}
            >
              <TableIcon className="h-4 w-4 mr-1.5" />
              Carga masiva
            </Button>
          </div>

          {/* Botón cargar nota — oculto si está en licencia */}
          {view === 'list' && !isOnLeave && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Cargar nota
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Cargar nota</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormItem>
                      <FormLabel>Curso</FormLabel>
                      <Select onValueChange={setSelectedCourse} value={selectedCourse}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccioná un curso..." />
                        </SelectTrigger>
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
                              {courseDetail?.courseSubjects?.map((cs: any) => (
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
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
          )}
        </div>
      </div>

      {/* ── Vista: Carga masiva — disabled si está en licencia ── */}
      {view === 'bulk' && <BulkGradesEntry disabled={isOnLeave} />}

      {/* ── Vista: Lista ── */}
      {view === 'list' && (
        <>
          {/* Filtros */}
          <div className="flex gap-3 flex-wrap">
            <Select value={selectedCourse} onValueChange={(v) => {
              setSelectedCourse(v === 'all' ? '' : v);
              setSelectedPeriod('');
              setSelectedSubject('');
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por curso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los cursos</SelectItem>
                {courses?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedPeriod}
              onValueChange={setSelectedPeriod}
              disabled={!selectedCourse || selectedCourse === 'all'}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los períodos</SelectItem>
                {periods?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedSubject}
              onValueChange={setSelectedSubject}
              disabled={!selectedCourse || selectedCourse === 'all'}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por materia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las materias</SelectItem>
                {subjects.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          <div className="rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Materia</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Fecha</TableHead>
                  {/* Columna acciones — oculta si está en licencia */}
                  {!isOnLeave && <TableHead className="w-8" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isOnLeave ? 6 : 7} className="text-center py-8 text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filteredGrades?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isOnLeave ? 6 : 7} className="text-center py-8 text-muted-foreground">
                      No hay notas registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGrades?.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell className="font-medium">
                        {grade.student.lastName}, {grade.student.firstName}
                      </TableCell>
                      <TableCell>{grade.courseSubject.subject.name}</TableCell>
                      <TableCell>{grade.period.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[grade.type] ?? grade.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          Number(grade.score) >= 7 ? 'text-emerald-600'
                          : Number(grade.score) >= 4 ? 'text-amber-600'
                          : 'text-red-600'
                        }`}>
                          {Number(grade.score).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(grade.date).toLocaleDateString('es-AR')}
                      </TableCell>
                      {/* Botón eliminar — oculto si está en licencia */}
                      {!isOnLeave && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteGrade.mutate(grade.id)}
                            disabled={deleteGrade.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}