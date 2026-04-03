'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useCourses } from '@/lib/api/courses';
import { usePeriods } from '@/lib/api/grades';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Save, BookOpen, Trash2 } from 'lucide-react';

interface SyllabusEntry {
  id:              string;
  courseSubjectId: string;
  periodId:        string;
  title:           string;
  contents:        string;
  bibliography:    string | null;
  period:          { id: string; name: string; order: number };
}

export default function SyllabusPage() {
  const { data: session }   = useSession();
  const queryClient         = useQueryClient();
  const [selectedCourse,  setSelectedCourse]  = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const { data: courses }      = useCourses();
  const selectedCourseData     = courses?.find((c) => c.id === selectedCourse);
  const { data: periods }      = usePeriods(selectedCourseData?.schoolYearId ?? undefined);

  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn:  async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  // Filtrar materias por docente si es TEACHER
  const isTeacher = session?.user?.role === 'TEACHER';
  const subjects  = courseDetail?.courseSubjects?.filter((cs: any) =>
    isTeacher ? cs.teacherId === session?.user?.id : true
  ) ?? [];

  const { data: syllabuses, isLoading } = useQuery({
    queryKey: ['syllabus', selectedSubject],
    queryFn:  async () => {
      const res = await api.get<SyllabusEntry[]>(`/teacher/syllabus/${selectedSubject}`);
      return res.data;
    },
    enabled: !!selectedSubject,
  });

  // Estado local para edición
  const [localData, setLocalData] = useState<Record<string, {
    title:        string;
    contents:     string;
    bibliography: string;
    changed:      boolean;
  }>>({});

  // Inicializar cuando cargan los datos
  const getLocal = (periodId: string) => {
    if (localData[periodId]) return localData[periodId];
    const existing = syllabuses?.find((s) => s.periodId === periodId);
    return {
      title:        existing?.title        ?? '',
      contents:     existing?.contents     ?? '',
      bibliography: existing?.bibliography ?? '',
      changed:      false,
    };
  };

  const updateLocal = (periodId: string, field: string, value: string) => {
    setLocalData((prev) => ({
      ...prev,
      [periodId]: { ...getLocal(periodId), [field]: value, changed: true },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const data = getLocal(periodId);
      await api.post('/teacher/syllabus', {
        courseSubjectId: selectedSubject,
        periodId,
        title:           data.title,
        contents:        data.contents,
        bibliography:    data.bibliography || undefined,
      });
    },
    onSuccess: (_, periodId) => {
      queryClient.invalidateQueries({ queryKey: ['syllabus'] });
      setLocalData((prev) => ({
        ...prev,
        [periodId]: { ...getLocal(periodId), changed: false },
      }));
      toast.success('Temario guardado');
    },
    onError: () => toast.error('Error al guardar el temario'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/teacher/syllabus/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syllabus'] });
      toast.success('Temario eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const hasAnyChange = Object.values(localData).some((d) => d.changed);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Temario</h1>
        <p className="text-sm text-muted-foreground">
          Planificación anual por materia y período
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Curso</label>
              <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v); setSelectedSubject(''); setLocalData({}); }}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un curso..." /></SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Materia</label>
              <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setLocalData({}); }} disabled={!selectedCourse}>
                <SelectTrigger><SelectValue placeholder="Seleccioná una materia..." /></SelectTrigger>
                <SelectContent>
                  {subjects.map((cs: any) => (
                    <SelectItem key={cs.id} value={cs.id}>
                      {cs.subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Períodos con temario */}
      {!selectedSubject ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          Seleccioná un curso y una materia para ver el temario
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Cargando...
        </div>
      ) : !periods?.length ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          No hay períodos creados para este año lectivo
        </div>
      ) : (
        <div className="space-y-4">
          {periods.sort((a, b) => a.order - b.order).map((period) => {
            const local    = getLocal(period.id);
            const existing = syllabuses?.find((s) => s.periodId === period.id);

            return (
              <Card key={period.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {period.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {local.changed && (
                        <Badge variant="secondary" className="text-xs">Sin guardar</Badge>
                      )}
                      {existing && !local.changed && (
                        <Badge variant="default" className="text-xs">Guardado</Badge>
                      )}
                      {existing && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(existing.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Título de la unidad
                    </label>
                    <Input
                      placeholder="Ej: Números naturales y operaciones básicas"
                      value={local.title}
                      onChange={(e) => updateLocal(period.id, 'title', e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Contenidos / temas
                    </label>
                    <textarea
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none min-h-24"
                      placeholder="Listá los temas a desarrollar en este período..."
                      value={local.contents}
                      onChange={(e) => updateLocal(period.id, 'contents', e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Bibliografía (opcional)
                    </label>
                    <Input
                      placeholder="Ej: Libro de texto — Capítulos 1 al 4"
                      value={local.bibliography}
                      onChange={(e) => updateLocal(period.id, 'bibliography', e.target.value)}
                    />
                  </div>

                  {local.changed && (
                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        onClick={() => saveMutation.mutate(period.id)}
                        disabled={saveMutation.isPending || !local.title || !local.contents}
                      >
                        <Save className="h-4 w-4 mr-1.5" />
                        Guardar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}