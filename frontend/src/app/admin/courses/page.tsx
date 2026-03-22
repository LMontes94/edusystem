'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Users, BookOpen, ChevronRight } from 'lucide-react';

// ── Tipos ─────────────────────────────────────
interface SchoolYear {
  id:       string;
  year:     number;
  isActive: boolean;
}

interface Course {
  id:         string;
  name:       string;
  grade:      number;
  division:   string;
  level:      string;
  schoolYear: SchoolYear;
  _count:     { courseStudents: number; courseSubjects: number };
}

// ── Schema ────────────────────────────────────
const createCourseSchema = z.object({
  schoolYearId: z.string().min(1, 'Requerido'),
  name:         z.string().min(1, 'Requerido'),
  grade:        z.coerce.number().int().min(1).max(12),
  division:     z.string().min(1, 'Requerido'),
  level:        z.enum(['INICIAL', 'PRIMARIA', 'SECUNDARIA']),
});
type CreateCourseForm = z.infer<typeof createCourseSchema>;

const createSchoolYearSchema = z.object({
  year:      z.coerce.number().int().min(2020).max(2100),
  startDate: z.string().min(1, 'Requerido'),
  endDate:   z.string().min(1, 'Requerido'),
});
type CreateSchoolYearForm = z.infer<typeof createSchoolYearSchema>;

const createPeriodSchema = z.object({
  schoolYearId: z.string().min(1, 'Requerido'),
  name:         z.string().min(1, 'Requerido'),
  type:         z.enum(['TRIMESTRE', 'BIMESTRE', 'CUATRIMESTRE', 'SEMESTRE']),
  order:        z.coerce.number().int().min(1),
  startDate:    z.string().min(1, 'Requerido'),
  endDate:      z.string().min(1, 'Requerido'),
});
type CreatePeriodForm = z.infer<typeof createPeriodSchema>;

// ── Hooks ─────────────────────────────────────
function useSchoolYears() {
  return useQuery({
    queryKey: ['school-years'],
    queryFn:  async () => {
      const res = await api.get<SchoolYear[]>('/courses/school-years');
      return res.data;
    },
  });
}
function usePeriods(schoolYearId?: string) {
  return useQuery({
    queryKey: ['periods', schoolYearId],
    queryFn:  async () => {
      const res = await api.get(`/courses/school-years/${schoolYearId}/periods`);
      return res.data;
    },
    enabled: !!schoolYearId,
  });
}

function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { schoolYearId: string; name: string; type: string; order: number; startDate: string; endDate: string }) => {
      const res = await api.post('/courses/periods', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
      toast.success('Período creado');
    },
    onError: () => toast.error('Error al crear el período'),
  });
}

function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn:  async () => {
      const res = await api.get<Course[]>('/courses');
      return res.data;
    },
  });
}

function useCreateSchoolYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSchoolYearForm) => {
      const res = await api.post('/courses/school-years', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-years'] });
      toast.success('Año lectivo creado');
    },
    onError: () => toast.error('Error al crear el año lectivo'),
  });
}

function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCourseForm) => {
      const res = await api.post('/courses', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Curso creado exitosamente');
    },
    onError: () => toast.error('Error al crear el curso'),
  });
}

// ── Componente ────────────────────────────────
export default function CoursesPage() {
  const [search,          setSearch]          = useState('');
  const [courseDialog,    setCourseDialog]    = useState(false);
  const [schoolYearDialog, setSchoolYearDialog] = useState(false);

  const { data: courses,     isLoading } = useCourses();
  const { data: schoolYears }            = useSchoolYears();
  const createCourse     = useCreateCourse();
  const createSchoolYear = useCreateSchoolYear();

  const courseForm = useForm<CreateCourseForm>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: { name: '', grade: 1, division: 'A', level: 'PRIMARIA' },
  });

  const schoolYearForm = useForm<CreateSchoolYearForm>({
    resolver: zodResolver(createSchoolYearSchema),
    defaultValues: { year: new Date().getFullYear() },
  });

  const filtered = courses?.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.level.toLowerCase().includes(q)
    );
  });
  const [periodDialog,    setPeriodDialog]    = useState(false);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const createPeriod   = useCreatePeriod();
  const { data: periods } = usePeriods(selectedSchoolYear || undefined);

  const periodForm = useForm<CreatePeriodForm>({
    resolver: zodResolver(createPeriodSchema),
    defaultValues: { type: 'TRIMESTRE', order: 1 },
  });

  async function onCreatePeriod(data: CreatePeriodForm) {
    await createPeriod.mutateAsync(data);
    setPeriodDialog(false);
    periodForm.reset();
  }

  async function onCreateCourse(data: CreateCourseForm) {
    await createCourse.mutateAsync(data);
    setCourseDialog(false);
    courseForm.reset();
  }

  async function onCreateSchoolYear(data: CreateSchoolYearForm) {
    await createSchoolYear.mutateAsync(data);
    setSchoolYearDialog(false);
    schoolYearForm.reset();
  }

  const levelLabel: Record<string, string> = {
    INICIAL:    'Inicial',
    PRIMARIA:   'Primaria',
    SECUNDARIA: 'Secundaria',
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cursos</h1>
          <p className="text-sm text-muted-foreground">
            {courses?.length ?? 0} cursos registrados
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={periodDialog} onOpenChange={setPeriodDialog}>
  <DialogTrigger asChild>
    <Button size="sm" variant="outline">Período</Button>
  </DialogTrigger>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Nuevo período</DialogTitle>
    </DialogHeader>
    <Form {...periodForm}>
      <form onSubmit={periodForm.handleSubmit(onCreatePeriod)} className="space-y-4">
        <FormField control={periodForm.control} name="schoolYearId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Año lectivo</FormLabel>
              <Select onValueChange={(v) => { field.onChange(v); setSelectedSchoolYear(v); }} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleccioná un año..." /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {schoolYears?.map((sy) => (
                    <SelectItem key={sy.id} value={sy.id}>{sy.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField control={periodForm.control} name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl><Input placeholder="Primer Trimestre" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField control={periodForm.control} name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="TRIMESTRE">Trimestre</SelectItem>
                  <SelectItem value="BIMESTRE">Bimestre</SelectItem>
                  <SelectItem value="CUATRIMESTRE">Cuatrimestre</SelectItem>
                  <SelectItem value="SEMESTRE">Semestre</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField control={periodForm.control} name="order"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Orden</FormLabel>
              <FormControl><Input type="number" min={1} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={periodForm.control} name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inicio</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField control={periodForm.control} name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fin</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setPeriodDialog(false)}>Cancelar</Button>
          <Button type="submit" disabled={createPeriod.isPending}>
            {createPeriod.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Form>
  </DialogContent>
</Dialog>
          {/* Crear año lectivo */}
          <Dialog open={schoolYearDialog} onOpenChange={setSchoolYearDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">Año lectivo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Nuevo año lectivo</DialogTitle>
              </DialogHeader>
              <Form {...schoolYearForm}>
                <form onSubmit={schoolYearForm.handleSubmit(onCreateSchoolYear)} className="space-y-4">
                  <FormField control={schoolYearForm.control} name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Año</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={schoolYearForm.control} name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inicio</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={schoolYearForm.control} name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fin</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setSchoolYearDialog(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createSchoolYear.isPending}>
                      {createSchoolYear.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Crear curso */}
          <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo curso
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nuevo curso</DialogTitle>
              </DialogHeader>
              <Form {...courseForm}>
                <form onSubmit={courseForm.handleSubmit(onCreateCourse)} className="space-y-4">
                  <FormField control={courseForm.control} name="schoolYearId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Año lectivo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccioná un año..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {schoolYears?.map((sy) => (
                              <SelectItem key={sy.id} value={sy.id}>
                                {sy.year} {sy.isActive && '(activo)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField control={courseForm.control} name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl><Input placeholder="3ro A" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={courseForm.control} name="grade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grado</FormLabel>
                          <FormControl><Input type="number" min={1} max={12} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={courseForm.control} name="division"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>División</FormLabel>
                          <FormControl><Input placeholder="A" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField control={courseForm.control} name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nivel</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="INICIAL">Inicial</SelectItem>
                            <SelectItem value="PRIMARIA">Primaria</SelectItem>
                            <SelectItem value="SECUNDARIA">Secundaria</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setCourseDialog(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createCourse.isPending}>
                      {createCourse.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cursos..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid de cursos */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filtered?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No se encontraron cursos</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered?.map((course) => (
            <Link key={course.id} href={`/admin/courses/${course.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{course.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {levelLabel[course.level]} · {course.schoolYear?.year}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
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
          ))}
        </div>
      )}
    </div>
  );
}