'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCourses } from '@/lib/api/courses';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Save, AlertCircle, Download } from 'lucide-react';

interface PendingSubject {
  id:             string;
  studentId:      string;
  subjectId:      string;
  initialSabers?: string;
  march?:         string;
  august?:        string;
  november?:      string;
  december?:      string;
  february?:      string;
  finalScore?:    string;
  closingSabers?: string;
  subject:        { id: string; name: string };
  student:        { id: string; firstName: string; lastName: string };
}

const periodColumns = [
  { key: 'march',    label: 'Marzo'     },
  { key: 'august',   label: 'Agosto'    },
  { key: 'november', label: 'Noviembre' },
  { key: 'december', label: 'Diciembre' },
  { key: 'february', label: 'Febrero'   },
];

const scoreOptions = ['AA', 'CCA', 'CSA', ''];

export default function PendingSubjectsPage() {
  const queryClient = useQueryClient();

  const [selectedCourse,     setSelectedCourse]     = useState('');
  const [selectedSchoolYear, setSelectedSchoolYear]  = useState('');
  const [addDialog,          setAddDialog]           = useState(false);
  const [selectedStudent,    setSelectedStudent]     = useState('');
  const [selectedSubject,    setSelectedSubject]     = useState('');
  const [localData,          setLocalData]           = useState<Record<string, Partial<PendingSubject>>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingBulk, setGeneratingBulk] = useState(false);

  const { data: courses }     = useCourses();
  const { data: schoolYears } = useQuery({
    queryKey: ['school-years'],
    queryFn:  async () => {
      const res = await api.get('/courses/school-years');
      return res.data;
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn:  async () => {
      const res = await api.get('/subjects');
      return res.data;
    },
  });

  const { data: data, isLoading } = useQuery({
    queryKey: ['pending-subjects', selectedCourse, selectedSchoolYear],
    queryFn:  async () => {
      const res = await api.get(`/teacher/pending/${selectedCourse}`, {
        params: { schoolYearId: selectedSchoolYear },
      });
      return res.data;
    },
    enabled: !!selectedCourse && !!selectedSchoolYear,
  });

  // Inicializar datos locales
  useEffect(() => {
    if (data?.pendingSubjects) {
      const initial: Record<string, Partial<PendingSubject>> = {};
      data.pendingSubjects.forEach((p: PendingSubject) => {
        initial[p.id] = { ...p };
      });
      setLocalData(initial);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (pending: Partial<PendingSubject> & { id: string }) => {
      await api.post('/teacher/pending', {
        studentId:      pending.studentId,
        subjectId:      pending.subjectId,
        schoolYearId:   selectedSchoolYear,
        initialSabers:  pending.initialSabers,
        march:          pending.march,
        august:         pending.august,
        november:       pending.november,
        december:       pending.december,
        february:       pending.february,
        finalScore:     pending.finalScore,
        closingSabers:  pending.closingSabers,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-subjects'] });
      toast.success('Guardado');
    },
    onError: () => toast.error('Error al guardar'),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await api.post('/teacher/pending', {
        studentId:    selectedStudent,
        subjectId:    selectedSubject,
        schoolYearId: selectedSchoolYear,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-subjects'] });
      setAddDialog(false);
      setSelectedStudent('');
      setSelectedSubject('');
      toast.success('Materia pendiente agregada');
    },
    onError: () => toast.error('Error al agregar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/teacher/pending/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-subjects'] });
      toast.success('Eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  function updateLocal(id: string, field: string, value: string) {
    setLocalData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }
  
  // Agrupar pendientes por alumno
  const pendingByStudent = data?.students?.map((student: any) => ({
    student,
    pendings: data.pendingSubjects.filter((p: PendingSubject) => p.studentId === student.id),
  })).filter((s: any) => s.pendings.length > 0) ?? [];
  
  async function handleDownloadPdf(studentId: string) {
  if (!selectedCourse || !selectedSchoolYear) return;
  setGenerating(studentId);
  try {
    const res = await api.get(`/reports/pending/${studentId}`, {
      params:       { courseId: selectedCourse, schoolYearId: selectedSchoolYear },
      responseType: 'blob',
    });
    const contentDisposition = res.headers['content-disposition'];
    const filenameMatch      = contentDisposition?.match(/filename="(.+)"/);
    const url  = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href     = url;
    link.download = filenameMatch?.[1] ?? `pendientes_${studentId}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('PDF generado');
  } catch {
    toast.error('Error al generar el PDF');
  } finally {
    setGenerating(null);
  }
}

async function handleDownloadBulk() {
  setGeneratingBulk(true);
  try {
    const res = await api.get(`/reports/pending/bulk/${selectedCourse}`, {
      params:       { schoolYearId: selectedSchoolYear },
      responseType: 'blob',
    });
    const url  = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href     = url;
    link.download = `pendientes_curso.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('ZIP generado');
  } catch {
    toast.error('Error al generar el ZIP');
  } finally {
    setGeneratingBulk(false);
  }
}

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Materias pendientes</h1>
          <p className="text-sm text-muted-foreground">
            Registro de materias pendientes de aprobación
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setAddDialog(true)}
          disabled={!selectedCourse || !selectedSchoolYear}
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar pendiente
        </Button>
        <Button
  size="sm"
  variant="outline"
  onClick={handleDownloadBulk}
  disabled={generatingBulk || !selectedCourse || !selectedSchoolYear || pendingByStudent.length === 0}
>
  <Download className="h-4 w-4 mr-2" />
  {generatingBulk ? 'Generando...' : 'Descargar todos (ZIP)'}
</Button>

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
              <label className="text-sm font-medium">Curso</label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un curso..." /></SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de pendientes */}
      {!selectedCourse || !selectedSchoolYear ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          Seleccioná un año lectivo y un curso
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Cargando...
        </div>
      ) : pendingByStudent.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed gap-2">
          <AlertCircle className="h-8 w-8 opacity-30" />
          <p>No hay materias pendientes en este curso</p>
          <Button size="sm" variant="outline" onClick={() => setAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar primera pendiente
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingByStudent.map(({ student, pendings }: any) => (
            <Card key={student.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {student.lastName}, {student.firstName}
                  <div className="flex items-center gap-2">
  <Badge variant="secondary" className="text-xs">
    {pendings.length} pendiente{pendings.length > 1 ? 's' : ''}
  </Badge>
  <Button
    size="sm"
    variant="outline"
    onClick={() => handleDownloadPdf(student.id)}
    disabled={generating === student.id}
  >
    <Download className="h-3.5 w-3.5 mr-1.5" />
    {generating === student.id ? 'Generando...' : 'PDF'}
  </Button>
</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendings.map((pending: PendingSubject) => {
                  const local = localData[pending.id] ?? pending;
                  return (
                    <div key={pending.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-primary">
                          {pending.subject.name}
                        </p>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(pending.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Saberes iniciales */}
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Saberes iniciales pendientes
                        </label>
                        <textarea
                          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none min-h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          placeholder="Describí los saberes iniciales pendientes..."
                          value={(local as any).initialSabers ?? ''}
                          onChange={(e) => updateLocal(pending.id, 'initialSabers', e.target.value)}
                        />
                      </div>

                      {/* Períodos de intensificación */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">
                          Períodos de intensificación
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          {periodColumns.map((col) => (
                            <div key={col.key} className="space-y-1">
                              <label className="text-xs text-center block text-muted-foreground">
                                {col.label}
                              </label>
                              <Select
                                value={(local as any)[col.key] ?? ''}
                                onValueChange={(v) => updateLocal(pending.id, col.key, v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">—</SelectItem>
                                  {scoreOptions.filter(Boolean).map((opt) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Nota final y saberes cierre */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            Calificación final
                          </label>
                          <Input
                            className="h-8 text-xs"
                            placeholder="Ej: 6"
                            value={(local as any).finalScore ?? ''}
                            onChange={(e) => updateLocal(pending.id, 'finalScore', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            Saberes pendientes al cierre
                          </label>
                          <Input
                            className="h-8 text-xs"
                            placeholder="Opcional"
                            value={(local as any).closingSabers ?? ''}
                            onChange={(e) => updateLocal(pending.id, 'closingSabers', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => saveMutation.mutate({ ...local, id: pending.id } as any)}
                          disabled={saveMutation.isPending}
                        >
                          <Save className="h-3.5 w-3.5 mr-1.5" />
                          Guardar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog agregar pendiente */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar materia pendiente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Alumno</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un alumno..." /></SelectTrigger>
                <SelectContent>
                  {data?.students?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.lastName}, {s.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Materia pendiente</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger><SelectValue placeholder="Seleccioná la materia..." /></SelectTrigger>
                <SelectContent>
                  {(subjects as any[])?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddDialog(false)}>Cancelar</Button>
              <Button
                onClick={() => addMutation.mutate()}
                disabled={!selectedStudent || !selectedSubject || addMutation.isPending}
              >
                {addMutation.isPending ? 'Agregando...' : 'Agregar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}