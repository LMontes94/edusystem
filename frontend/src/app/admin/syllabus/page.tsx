'use client';

import React, { useState } from 'react';
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
import { Plus, Trash2, BookOpen, ChevronDown, ChevronUp, Save } from 'lucide-react';

interface SyllabusUnit {
  id: string;
  courseSubjectId: string;
  periodId: string;
  title: string;
  contents: string;
  bibliography: string | null;
  status: 'completed' | 'pending' | 'postponed';
  order: number;
  period: { id: string; name: string };
}

const statusConfig = {
  completed: { label: 'Completado', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  pending:   { label: 'Pendiente',  color: 'bg-amber-50 text-amber-700 border-amber-300' },
  postponed: { label: 'Postergado', color: 'bg-red-50 text-red-700 border-red-300' },
};

const PeriodSection = React.memo(function PeriodSection({
  period,
  selectedSubject,
  expandedPeriods,
  togglePeriod,
  getNewUnit,
  updateNewUnit,
  editingUnit,
  setEditingUnit,
  createMutation,
  updateMutation,
  deleteMutation,
  changeStatusMutation,
}: any) {

  const { data: units, isLoading } = usePeriodSyllabus(selectedSubject,period.id);
  const isExpanded = expandedPeriods[period.id] ?? true;
  const nu = getNewUnit(period.id);

  return (
    <Card>
      <CardHeader className="pb-0 pt-4 px-4">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => togglePeriod(period.id)}
        >
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {period.name}
            {units && units.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {units.length} unidad{units.length > 1 ? 'es' : ''}
              </Badge>
            )}
          </CardTitle>
          {isExpanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-2">Cargando...</p>
          ) : units?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              No hay unidades cargadas para este período
            </p>
          ) : (
            <div className="space-y-3">
              {units.map((unit: SyllabusUnit) => {
                const isEditing = !!editingUnit[unit.id];
                const editData = editingUnit[unit.id] ?? unit;

                return (
                  <div key={unit.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">

                      {isEditing ? (
                        <Input
                          value={editData.title}
                          onChange={(e) => setEditingUnit((prev: any) => ({
                            ...prev,
                            [unit.id]: { ...editData, title: e.target.value },
                          }))}
                        />
                      ) : (
                        <p className="text-sm font-medium flex-1">{unit.title}</p>
                      )}

                      <div className="flex items-center gap-1">
                        <Select
                          value={unit.status}
                          onValueChange={(v) => changeStatusMutation.mutate({
                            id: unit.id,
                            status: v,
                            periodId: period.id,
                          })}
                        >
                          <SelectTrigger className={`h-6 text-xs w-28 ${statusConfig[unit.status].color}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completed">Completado</SelectItem>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="postponed">Postergado</SelectItem>
                          </SelectContent>
                        </Select>

                        {isEditing ? (
                          <Button size="icon" onClick={() =>
                            updateMutation.mutate({ id: unit.id, data: editData })
                          }>
                            <Save className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button size="icon" onClick={() =>
                            setEditingUnit((prev: any) => ({ ...prev, [unit.id]: { ...unit } }))
                          }>
                            ✎
                          </Button>
                        )}

                        <Button size="icon" onClick={() =>
                          deleteMutation.mutate({ id: unit.id, periodId: period.id })
                        }>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {isEditing ? (
                      <textarea
                        value={editData.contents}
                        onChange={(e) => setEditingUnit((prev: any) => ({
                          ...prev,
                          [unit.id]: { ...editData, contents: e.target.value },
                        }))}
                        className="w-full border rounded p-2 text-sm"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {unit.contents}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t pt-3 space-y-2">
            <Input
              placeholder="Título..."
              value={nu.title}
              onChange={(e) => updateNewUnit(period.id, 'title', e.target.value)}
            />
            <textarea
              value={nu.contents}
              onChange={(e) => updateNewUnit(period.id, 'contents', e.target.value)}
              className="w-full border rounded p-2"
            />
            <Input
              placeholder="Bibliografía..."
              value={nu.bibliography}
              onChange={(e) => updateNewUnit(period.id, 'bibliography', e.target.value)}
            />
            <Button
              onClick={() => createMutation.mutate({
                periodId: period.id,
                data: nu,
              })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar unidad
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
});

function usePeriodSyllabus(selectedSubject: string, periodId: string) {
  return useQuery({
    queryKey: ['syllabus', selectedSubject, periodId],
    queryFn:  async () => {
      const res = await api.get(`/teacher/syllabus/${selectedSubject}/${periodId}`);
      return res.data;
    },
    enabled: !!selectedSubject && !!periodId,
  });
}

export default function SyllabusPage() {

  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({});
  const [newUnit, setNewUnit] = useState<any>({});
  const [editingUnit, setEditingUnit] = useState<Record<string, SyllabusUnit>>({});

  const { data: courses } = useCourses();
  const selectedCourseData = courses?.find((c) => c.id === selectedCourse);
  const { data: periods } = usePeriods(selectedCourseData?.schoolYearId ?? undefined);

  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn: async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  const createMutation = useMutation({
    mutationFn: async ({ periodId, data }: {
      periodId: string;
      data: { title: string; contents: string; bibliography?: string };
    }) => {
      await api.post('/teacher/syllabus', {
        courseSubjectId: selectedSubject,
        periodId,
        ...data,
      });
    },
    onSuccess: (_, { periodId }) => {
      queryClient.invalidateQueries({ queryKey: ['syllabus', selectedSubject, periodId] });
      setNewUnit((prev) => ({
        ...prev,
        [periodId]: { title: '', contents: '', bibliography: '' }
      }));
      toast.success('Unidad agregada');
    },
    onError: () => toast.error('Error al agregar la unidad'),
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SyllabusUnit> }) => {
      await api.patch(`/teacher/syllabus/${id}`, data);
    },
    onSuccess: (_, { id }) => {
      const unit = editingUnit[id];
      if (unit) {
        queryClient.invalidateQueries({
          queryKey: ['syllabus', selectedSubject, unit.periodId]
        });
      }
      setEditingUnit((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      toast.success('Unidad actualizada');
    },
    onError: () => toast.error('Error al actualizar'),
  });
  
  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: string; periodId: string }) => {
      await api.delete(`/teacher/syllabus/${id}`);
    },
    onSuccess: (_, { periodId }) => {
      queryClient.invalidateQueries({
        queryKey: ['syllabus', selectedSubject, periodId]
      });
      toast.success('Unidad eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });
  
  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string; periodId: string }) => {
      await api.patch(`/teacher/syllabus/${id}`, { status });
    },
    onSuccess: (_, { periodId }) => {
      queryClient.invalidateQueries({
        queryKey: ['syllabus', selectedSubject, periodId]
      });
    },
    onError: () => toast.error('Error al cambiar el estado'),
  });
  
  const isTeacher = session?.user?.role === 'TEACHER';

  const subjects = courseDetail?.courseSubjects?.filter((cs: any) =>
    isTeacher ? cs.teacherId === session?.user?.id : true
  ) ?? [];

  function togglePeriod(id: string) {
    setExpandedPeriods(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function getNewUnit(id: string) {
    return newUnit[id] ?? { title: '', contents: '', bibliography: '' };
  }

  function updateNewUnit(id: string, field: string, value: string) {
    setNewUnit(prev => ({
      ...prev,
      [id]: { ...getNewUnit(id), [field]: value }
    }));
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-xl font-semibold">Temario</h1>
        <p className="text-sm text-muted-foreground">
          Planificación anual por materia y período
        </p>
      </div>

      {/* FILTROS (INTACTOS) */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 gap-4">

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Curso</label>
              <Select
                value={selectedCourse}
                onValueChange={(v) => {
                  setSelectedCourse(v);
                  setSelectedSubject('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un curso..." />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Materia</label>
              <Select
                value={selectedSubject}
                onValueChange={setSelectedSubject}
                disabled={!selectedCourse}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná una materia..." />
                </SelectTrigger>
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

      {/* PERÍODOS */}
      {!selectedSubject ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          Seleccioná un curso y una materia para ver el temario
        </div>
      ) : !periods?.length ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          No hay períodos creados
        </div>
      ) : (
        <div className="space-y-4">
          {[...periods].sort((a, b) => a.order - b.order).map((period) => (
            <PeriodSection
              key={period.id}
              period={period}
              selectedSubject={selectedSubject}
              expandedPeriods={expandedPeriods}
              togglePeriod={togglePeriod}
              getNewUnit={getNewUnit}
              updateNewUnit={updateNewUnit}
              editingUnit={editingUnit}
              setEditingUnit={setEditingUnit}
              createMutation={createMutation}
              updateMutation={updateMutation}
              deleteMutation={deleteMutation}
              changeStatusMutation={changeStatusMutation}
            />
          ))}
        </div>
      )}
    </div>
  );
}