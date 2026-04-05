'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Pencil, Check, X } from 'lucide-react';

interface Indicator {
  id:          string;
  description: string;
  order:       number;
  subjectId:   string;
  schoolYearId: string;
}

export default function IndicatorsPage() {
  const { data: session }       = useSession();
  const queryClient             = useQueryClient();
  const [selectedSubject,    setSelectedSubject]    = useState('');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [newIndicator,       setNewIndicator]       = useState('');
  const [editingId,          setEditingId]          = useState<string | null>(null);
  const [editingText,        setEditingText]        = useState('');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);

  // Solo ADMIN y DIRECTOR pueden gestionar indicadores
  const canManage = ['ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(
    session?.user?.role as string
  );

  const { data: schoolYears } = useQuery({
    queryKey: ['school-years'],
    queryFn:  async () => {
      const res = await api.get('/courses/school-years');
      return res.data;
    },
  });

  // Materias únicas de todos los cursos
  const { data: subjects } = useQuery({
  queryKey: ['subjects'],
  queryFn:  async () => {
    const res = await api.get('/subjects');
    return res.data;
  },
});

  const { data: indicators } = useQuery({
  queryKey: ['indicators', selectedSubject, selectedSchoolYear, selectedGrade],
  queryFn:  async () => {
    const res = await api.get<Indicator[]>('/indicators', {
      params: { subjectId: selectedSubject, schoolYearId: selectedSchoolYear, grade: selectedGrade },
    });
    return res.data;
  },
  enabled: !!selectedSubject && !!selectedSchoolYear && selectedGrade !== null,
});

  const createMutation = useMutation({
    mutationFn: async (description: string) => {
      await api.post('/indicators', {
        subjectId:    selectedSubject,
        schoolYearId: selectedSchoolYear,
        grade:        selectedGrade,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicators'] });
      setNewIndicator('');
      toast.success('Indicador agregado');
    },
    onError: () => toast.error('Error al agregar el indicador'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      await api.patch(`/indicators/${id}`, { description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicators'] });
      setEditingId(null);
      toast.success('Indicador actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/indicators/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicators'] });
      toast.success('Indicador eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  function handleAdd() {
    if (!newIndicator.trim()) return;
    createMutation.mutate(newIndicator.trim());
  }

  function handleEdit(indicator: Indicator) {
    setEditingId(indicator.id);
    setEditingText(indicator.description);
  }

  function handleSaveEdit() {
    if (!editingId || !editingText.trim()) return;
    updateMutation.mutate({ id: editingId, description: editingText.trim() });
  }

  const selectedSubjectName = (subjects as any[])?.find((s) => s.id === selectedSubject)?.name;
  const selectedYearName    = schoolYears?.find((sy: any) => sy.id === selectedSchoolYear)?.year;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Indicadores de evaluación</h1>
        <p className="text-sm text-muted-foreground">
          Definí los indicadores de cada materia para el informe cualitativo de primaria
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Año lectivo</label>
              <Select value={selectedSchoolYear} onValueChange={setSelectedSchoolYear}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un año..." /></SelectTrigger>
                <SelectContent>
                  {schoolYears?.map((sy: any) => (
                    <SelectItem key={sy.id} value={sy.id}>
                      {sy.year} {sy.isActive && '(activo)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
  <label className="text-sm font-medium">Grado</label>
  <Select
    value={selectedGrade?.toString() ?? ''}
    onValueChange={(v) => setSelectedGrade(Number(v))}
    disabled={!selectedSchoolYear}
  >
    <SelectTrigger><SelectValue placeholder="Seleccioná un grado..." /></SelectTrigger>
    <SelectContent>
      {[1,2,3,4,5,6,7].map((g) => (
        <SelectItem key={g} value={g.toString()}>{g}° grado</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Materia / Área</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger><SelectValue placeholder="Seleccioná una materia..." /></SelectTrigger>
                <SelectContent>
                  {(subjects as any[] ?? []).map((s) => (
  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de indicadores */}
      {selectedSubject && selectedSchoolYear && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Indicadores — {selectedSubjectName} {selectedYearName && `(${selectedYearName})`}
              </CardTitle>
              <Badge variant="secondary">{indicators?.length ?? 0} indicadores</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Cargando...</p>
            ) : indicators?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay indicadores cargados. Agregá el primero.
              </p>
            ) : (
              <div className="space-y-2">
                {indicators?.map((indicator, index) => (
                  <div
                    key={indicator.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 group"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                      <GripVertical className="h-4 w-4 opacity-40" />
                      <span className="text-xs w-5 text-center">{index + 1}</span>
                    </div>

                    {editingId === indicator.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="h-7 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={handleSaveEdit}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="flex-1 text-sm">{indicator.description}</p>
                        {canManage && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={() => handleEdit(indicator)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteMutation.mutate(indicator.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Agregar nuevo indicador */}
            {canManage && (
              <div className="flex gap-2 pt-2 border-t">
                <Input
                  placeholder="Descripción del indicador..."
                  value={newIndicator}
                  onChange={(e) => setNewIndicator(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!newIndicator.trim() || createMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Agregar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedSubject && (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          Seleccioná un año lectivo y una materia para ver sus indicadores
        </div>
      )}
    </div>
  );
}