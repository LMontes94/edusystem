'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useCourses } from '@/lib/api/courses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Settings, FileText, Download, Plus, X, AlertTriangle } from 'lucide-react';
import { formatDate } from './attendance.types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AbsenceRecord = {
  id:           string;
  threshold:    number;
  absenceCount: number;
  generatedAt:  string;
  student: { id: string; firstName: string; lastName: string };
  course:  { id: string; name: string; grade: string; division: string };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function thresholdBadgeClass(threshold: number) {
  if (threshold <= 10) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (threshold <= 20) return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

async function downloadRecordPdf(record: AbsenceRecord) {
  try {
    const res = await api.get(`/reports/absence-record/${record.id}`, {
      responseType: 'blob',
    });
    const disposition = res.headers['content-disposition'] ?? '';
    const match       = disposition.match(/filename="?([^"]+)"?/);
    const filename    = match?.[1] ?? `acta-${record.student.lastName}-${record.threshold}.pdf`;

    const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Error al descargar el PDF');
  }
}

// ─── Sub-componente: configuración de umbrales ────────────────────────────────

function ThresholdsConfig() {
  const queryClient = useQueryClient();
  const [open,       setOpen]       = useState(false);
  const [thresholds, setThresholds] = useState<number[]>([10, 20, 30]);
  const [newValue,   setNewValue]   = useState('');

  const updateMutation = useMutation({
    mutationFn: async (values: number[]) => {
      await api.post('/justifications/thresholds', { thresholds: values });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absence-records'] });
      toast.success('Umbrales actualizados');
      setOpen(false);
    },
    onError: () => toast.error('Error al actualizar umbrales'),
  });

  function addThreshold() {
    const num = parseInt(newValue);
    if (isNaN(num) || num <= 0 || num > 365) return;
    if (thresholds.includes(num)) { toast.warning('Ese umbral ya existe'); return; }
    setThresholds((prev) => [...prev, num].sort((a, b) => a - b));
    setNewValue('');
  }

  function removeThreshold(val: number) {
    if (thresholds.length <= 1) { toast.warning('Debe haber al menos un umbral'); return; }
    setThresholds((prev) => prev.filter((t) => t !== val));
  }

  return (
    <div>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen((v) => !v)}>
        <Settings className="h-3.5 w-3.5" />
        Configurar umbrales
      </Button>

      {open && (
        <Card className="mt-3 border-dashed">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Umbrales de inasistencia
              <span className="text-xs font-normal text-muted-foreground">
                — Se genera un acta al superar cada umbral
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Umbrales actuales */}
            <div className="flex flex-wrap gap-2">
              {thresholds.map((t) => (
                <span
                  key={t}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${thresholdBadgeClass(t)}`}
                >
                  {t} faltas
                  <button onClick={() => removeThreshold(t)} className="ml-0.5 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Agregar umbral */}
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                placeholder="Ej: 15"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addThreshold()}
                className="w-28 h-8 text-sm"
              />
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addThreshold}>
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                size="sm"
                onClick={() => updateMutation.mutate(thresholds)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function RecordsTab() {
  const [filterCourse,  setFilterCourse]  = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const { data: courses } = useCourses();

  const params = new URLSearchParams();
  if (filterCourse) params.set('courseId', filterCourse);

  const { data: records, isLoading } = useQuery<AbsenceRecord[]>({
    queryKey: ['absence-records', filterCourse],
    queryFn:  async () => {
      const res = await api.get(`/justifications/records?${params.toString()}`);
      return res.data;
    },
  });

  // Filtro client-side por nombre de alumno
  const filtered = records?.filter((r) => {
    if (!studentSearch.trim()) return true;
    const fullName = `${r.student.firstName} ${r.student.lastName}`.toLowerCase();
    return fullName.includes(studentSearch.toLowerCase());
  }) ?? [];

  return (
    <div className="space-y-4">

      {/* Barra superior: filtros + configuración */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select
            value={filterCourse}
            onValueChange={(v) => setFilterCourse(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Todos los cursos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los cursos</SelectItem>
              {courses?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Buscar alumno..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="w-44 h-8 text-sm"
          />
        </div>

        <ThresholdsConfig />
      </div>

      {/* Contador */}
      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          {filtered.length === 0
            ? 'No hay actas generadas'
            : `${filtered.length} acta${filtered.length !== 1 ? 's' : ''} encontrada${filtered.length !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* Tabla */}
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Umbral</TableHead>
              <TableHead className="text-center">Faltas al generar</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">PDF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  Cargando actas...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No hay actas generadas</p>
                    <p className="text-xs opacity-70">
                      Se generan automáticamente al superar los umbrales configurados
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {record.student.lastName}, {record.student.firstName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {record.course.name}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${thresholdBadgeClass(record.threshold)}`}>
                      {record.threshold} faltas
                    </span>
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm">
                    {record.absenceCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(record.generatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                      title="Descargar PDF"
                      onClick={() => downloadRecordPdf(record)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}