'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCourses } from '@/lib/api/courses';
import { useEligibleSubjects, useCreatePendingSubject, useUpdatePendingStatus, useUpdatePendingProgress, useDeletePendingSubject } from '@/lib/api/pending';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Save, AlertCircle, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { downloadBlob } from '@/lib/utils/download/download-blob';
import type { PendingSubject, EligiblePeriod, PendingSubjectStatus } from './_components/pending.types';
import { statusLabels, statusColors } from './_components/pending.types';

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
  const [localData,          setLocalData]           = useState<Record<string, Partial<PendingSubject>>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [expandedEligible, setExpandedEligible] = useState<Set<string>>(new Set());

  const { data: courses }     = useCourses();
  const { data: schoolYears } = useQuery({
    queryKey: ['school-years'],
    queryFn:  async () => {
      const res = await api.get('/courses/school-years');
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

  const createPending = useCreatePendingSubject();
  const updateStatus = useUpdatePendingStatus();
  const deleteMutation = useDeletePendingSubject();
  const progressMutation = useUpdatePendingProgress();

  useEffect(() => {
    if (data?.pendingSubjects) {
      const initial: Record<string, Partial<PendingSubject>> = {};
      data.pendingSubjects.forEach((p: PendingSubject) => {
        initial[p.id] = { ...p };
      });
      setLocalData(initial);
    }
  }, [data]);

  function updateLocal(id: string, field: string, value: string) {
    setLocalData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  function handleSave(pending: Partial<PendingSubject> & { id: string }) {
    const local = localData[pending.id] ?? pending;
    progressMutation.mutate({
      id: pending.id,
      initialSabers: (local as any).initialSabers,
      march:         (local as any).march,
      august:        (local as any).august,
      november:      (local as any).november,
      december:      (local as any).december,
      february:      (local as any).february,
      finalScore:    (local as any).finalScore,
      closingSabers: (local as any).closingSabers,
    });
  }

  function toggleEligible(studentId: string) {
    setExpandedEligible((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  const eligibleIds: string[] = data?.eligibleStudentIds ?? [];
  const students = (data?.students ?? [])
    .map((student: any) => ({
      student,
      pendings: data.pendingSubjects.filter((p: PendingSubject) => p.studentId === student.id),
    }))
    .filter((s: any) => s.pendings.length > 0 || eligibleIds.includes(s.student.id));

  async function handleDownloadPdf(studentId: string) {
    if (!selectedCourse || !selectedSchoolYear) return;
    setGenerating(studentId);
    try {
      const res = await api.get(`/reports/pending/${studentId}`, {
        params:       { courseId: selectedCourse, schoolYearId: selectedSchoolYear },
        responseType: 'blob',
      });
      await downloadBlob(res.data, res.headers['content-disposition'], 'pendientes.pdf');
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
      await downloadBlob(res.data, res.headers['content-disposition'], 'pendientes_curso.zip');
      toast.success('ZIP generado');
    } catch {
      toast.error('Error al generar el ZIP');
    } finally {
      setGeneratingBulk(false);
    }
  }

  function EligiblePanel({ studentId }: { studentId: string }) {
    const { data: eligible, isLoading: loadingEligible } = useEligibleSubjects(studentId, selectedSchoolYear);

    if (loadingEligible) return <p className="text-xs text-muted-foreground">Cargando...</p>;
    if (!eligible || eligible.length === 0) return <p className="text-xs text-muted-foreground">No hay períodos elegibles</p>;

    return (
      <div className="space-y-2">
        {eligible.map((ep) => (
          <div key={ep.closingGradeId} className="flex items-center justify-between rounded border p-2">
            <div className="text-xs">
              <span className="font-medium">{ep.subjectName}</span>
              {' — '}
              <span className="text-muted-foreground">{ep.periodName}</span>
              {' — '}
              <span className="font-mono">Nota de cierre: {ep.closingScore}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => createPending.mutate({ closingGradeId: ep.closingGradeId })}
              disabled={createPending.isPending}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar
            </Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Materias pendientes</h1>
          <p className="text-sm text-muted-foreground">
            Intensificación de materias pendientes de aprobación
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadBulk}
          disabled={generatingBulk || !selectedCourse || !selectedSchoolYear || students.length === 0}
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
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed gap-2">
          <AlertCircle className="h-8 w-8 opacity-30" />
          <p>No hay alumnos en este curso</p>
        </div>
      ) : (
        <div className="space-y-4">
          {students.map(({ student, pendings }: any) => (
            <Card key={student.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span>{student.lastName}, {student.firstName}</span>
                  <div className="flex items-center gap-2">
                    {pendings.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {pendings.length} pendiente{pendings.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                    <Button
                      size="sm" variant="outline"
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
                {pendings.length > 0 ? pendings.map((pending: PendingSubject) => {
                  const local = localData[pending.id] ?? pending;
                  return (
                    <div key={pending.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-primary">
                            {pending.subject.name}
                          </p>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColors[pending.status]}`}>
                            {statusLabels[pending.status]}
                          </span>
                          {pending.closingGrade && (
                            <span className="text-xs text-muted-foreground">
                              ({pending.closingGrade.period.name})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={pending.status}
                            onValueChange={(v) => updateStatus.mutate({ id: pending.id, status: v as PendingSubjectStatus })}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ENROLLED">En curso</SelectItem>
                              <SelectItem value="COMPLETED">Completado</SelectItem>
                              <SelectItem value="NOT_COMPLETED">No completado</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon" variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(pending.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Saberes iniciales pendientes</label>
                        <textarea
                          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none min-h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          placeholder="Describí los saberes iniciales pendientes..."
                          value={(local as any).initialSabers ?? ''}
                          onChange={(e) => updateLocal(pending.id, 'initialSabers', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Períodos de intensificación</label>
                        <div className="grid grid-cols-5 gap-2">
                          {periodColumns.map((col) => (
                            <div key={col.key} className="space-y-1">
                              <label className="text-xs text-center block text-muted-foreground">{col.label}</label>
                              <Select value={(local as any)[col.key] ?? ''} onValueChange={(v) => updateLocal(pending.id, col.key, v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
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
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Calificación final</label>
                          <Input className="h-8 text-xs" placeholder="Ej: 6" value={(local as any).finalScore ?? ''} onChange={(e) => updateLocal(pending.id, 'finalScore', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Saberes pendientes al cierre</label>
                          <Input className="h-8 text-xs" placeholder="Opcional" value={(local as any).closingSabers ?? ''} onChange={(e) => updateLocal(pending.id, 'closingSabers', e.target.value)} />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => handleSave(pending)} disabled={progressMutation.isPending}>
                          <Save className="h-3.5 w-3.5 mr-1.5" />Guardar
                        </Button>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground">Sin materias pendientes registradas</p>
                )}

                {/* Eligible subjects panel */}
                <div className="border-t pt-3">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => toggleEligible(student.id)}
                  >
                    {expandedEligible.has(student.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Períodos elegibles para intensificación
                  </button>
                  {expandedEligible.has(student.id) && (
                    <div className="mt-2">
                      <EligiblePanel studentId={student.id} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
