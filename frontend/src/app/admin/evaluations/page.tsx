'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCourses } from '@/lib/api/courses';
import { usePeriods } from '@/lib/api/grades';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Save, CheckCircle, MinusCircle, XCircle } from 'lucide-react';

type EvalValue = 'achieved' | 'in-progress' | 'not-achieved' | null;

const valueConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  'achieved':     { label: 'Logrado',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', icon: CheckCircle  },
  'in-progress':  { label: 'Med. Logrado', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-300',     icon: MinusCircle  },
  'not-achieved': { label: 'No logrado',   color: 'text-red-700',     bg: 'bg-red-50 border-red-300',         icon: XCircle      },
};

const valueOrder: EvalValue[] = ['achieved', 'in-progress', 'not-achieved', null];

export default function EvaluationsPage() {
  const queryClient = useQueryClient();

  const [selectedCourse,     setSelectedCourse]     = useState('');
  const [selectedSubject,    setSelectedSubject]     = useState('');
  const [selectedPeriod,     setSelectedPeriod]      = useState('');
  const [selectedSchoolYear, setSelectedSchoolYear]  = useState('');
  const [localValues, setLocalValues] = useState<Record<string, EvalValue>>({});
  const [hasChanges,  setHasChanges]  = useState(false);

  const { data: courses }     = useCourses();
  const { data: schoolYears } = useQuery({
    queryKey: ['school-years'],
    queryFn:  async () => {
      const res = await api.get('/courses/school-years');
      return res.data;
    },
  });

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

  const subjects = courseDetail?.courseSubjects ?? [];

  // Cargar grilla de evaluaciones
  const { data: grid, isLoading } = useQuery({
    queryKey: ['evaluations-grid', selectedCourse, selectedSubject, selectedSchoolYear, selectedPeriod],
    queryFn:  async () => {
      const res = await api.get(`/indicators/course/${selectedCourse}`, {
        params: {
          subjectId:    selectedSubject,
          schoolYearId: selectedSchoolYear,
          periodId:     selectedPeriod,
        },
      });
      return res.data;
    },
    enabled: !!selectedCourse && !!selectedSubject && !!selectedSchoolYear && !!selectedPeriod,
  });

  // Inicializar valores locales cuando carga la grilla
  useEffect(() => {
    if (grid) {
      const initial: Record<string, EvalValue> = {};
      grid.grid.forEach((row: any) => {
        Object.entries(row.valuesByStudent).forEach(([studentId, value]) => {
          initial[`${row.indicator.id}|${studentId}`] = value as EvalValue;
        });
      });
      setLocalValues(initial);
      setHasChanges(false);
    }
  }, [grid]);

  function toggleValue(indicatorId: string, studentId: string) {
    const key = `${indicatorId}|${studentId}`;
    const current = localValues[key] ?? null;
    const next    = valueOrder[(valueOrder.indexOf(current) + 1) % valueOrder.length];
    setLocalValues((prev) => ({ ...prev, [key]: next }));
    setHasChanges(true);
  }

  const saveMutation = useMutation({
  mutationFn: async () => {
    const evaluations = Object.entries(localValues)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => {
        // La key es "indicatorId|studentId" — usar | como separador
        const [indicatorId, studentId] = key.split('|');
        return { indicatorId, studentId, periodId: selectedPeriod, value: value! };
      });

    await api.post('/indicators/evaluations/bulk', { evaluations });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations-grid'] });
      setHasChanges(false);
      toast.success('Evaluaciones guardadas');
    },
    onError: () => toast.error('Error al guardar'),
  });

  const canRender = selectedCourse && selectedSubject && selectedSchoolYear && selectedPeriod;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Evaluación de indicadores</h1>
          <p className="text-sm text-muted-foreground">
            Completá la valoración de cada indicador por alumno
          </p>
        </div>
        {hasChanges && (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Año lectivo</label>
              <Select value={selectedSchoolYear} onValueChange={setSelectedSchoolYear}>
                <SelectTrigger><SelectValue placeholder="Año..." /></SelectTrigger>
                <SelectContent>
                  {schoolYears?.map((sy: any) => (
                    <SelectItem key={sy.id} value={sy.id}>{sy.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Curso</label>
              <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v); setSelectedSubject(''); }}>
                <SelectTrigger><SelectValue placeholder="Curso..." /></SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Materia</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedCourse}>
                <SelectTrigger><SelectValue placeholder="Materia..." /></SelectTrigger>
                <SelectContent>
                  {subjects.map((cs: any) => (
                    <SelectItem key={cs.subject.id} value={cs.subject.id}>
                      {cs.subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Período</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={!selectedCourse}>
                <SelectTrigger><SelectValue placeholder="Período..." /></SelectTrigger>
                <SelectContent>
                  {periods?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leyenda */}
      {canRender && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Hacé click en cada celda para cambiar la valoración:</span>
          {Object.entries(valueConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <span key={key} className={`flex items-center gap-1 ${config.color}`}>
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </span>
            );
          })}
          <span className="text-muted-foreground">· Sin valoración</span>
        </div>
      )}

      {/* Grilla de evaluación */}
      {!canRender ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          Seleccioná año, curso, materia y período para ver la grilla
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Cargando...
        </div>
      ) : !grid?.indicators?.length ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          No hay indicadores cargados para esta materia.{' '}
          <a href="/admin/indicators" className="text-primary underline ml-1">
            Agregalos desde Indicadores
          </a>
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-auto">
  <table className="text-sm w-full">
    <thead>
      <tr className="border-b bg-muted/50">
        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground sticky left-0 bg-muted/50 min-w-48">
          Alumno
        </th>
        {grid.grid.map((row: any, index: number) => (
          <th key={row.indicator.id} className="px-3 py-2.5 font-medium text-muted-foreground text-center min-w-32">
            <div className="text-xs text-muted-foreground mb-0.5">{index + 1}.</div>
            <div className="text-xs leading-tight max-w-28 mx-auto">
              {row.indicator.description.length > 40
                ? row.indicator.description.substring(0, 40) + '...'
                : row.indicator.description}
            </div>
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {grid.students.map((student: any, studentIndex: number) => (
        <tr
          key={student.id}
          className={`border-b last:border-0 ${studentIndex % 2 === 1 ? 'bg-muted/20' : ''}`}
        >
          <td className="px-4 py-2 sticky left-0 bg-background font-medium text-sm">
            {student.lastName}, {student.firstName}
          </td>
          {grid.grid.map((row: any) => {
            const key    = `${row.indicator.id}|${student.id}`;
            const value  = localValues[key] ?? null;
            const config = value ? valueConfig[value] : null;
            const Icon   = config?.icon;

            return (
              <td key={row.indicator.id} className="px-2 py-1.5 text-center">
                <button
                  onClick={() => toggleValue(row.indicator.id, student.id)}
                  className={`
                    w-full rounded-md border py-1.5 px-2 text-xs transition-all
                    ${config
                      ? `${config.bg} ${config.color}`
                      : 'border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-muted-foreground/50'
                    }
                  `}
                >
                  {Icon && config ? (
                    <span className="flex items-center justify-center gap-1">
                      <Icon className="h-3 w-3" />
                      <span className="hidden lg:inline">{config.label}</span>
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  </table>
</div>
      )}

      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      )}
    </div>
  );
}