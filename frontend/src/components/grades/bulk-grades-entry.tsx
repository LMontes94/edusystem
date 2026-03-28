'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCourses } from '@/lib/api/courses';
import { usePeriods } from '@/lib/api/grades';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, ClipboardPaste, CheckSquare } from 'lucide-react';
import { useSession } from 'next-auth/react';

// ── Tipos ─────────────────────────────────────
interface StudentRow {
  studentId:  string;
  firstName:  string;
  lastName:   string;
  score:      string;
  saved:      boolean;
  error:      string | null;
}

const typeLabels: Record<string, string> = {
  EXAM:          'Examen',
  ASSIGNMENT:    'Tarea',
  ORAL:          'Oral',
  PROJECT:       'Proyecto',
  PARTICIPATION: 'Participación',
};

// ── Validación ────────────────────────────────
function validateScore(value: string): string | null {
  if (value === '' || value === null) return null;
  const num = Number(value);
  if (isNaN(num))       return 'No es un número';
  if (num < 0)          return 'Mínimo 0';
  if (num > 10)         return 'Máximo 10';
  return null;
}

function getScoreStatus(value: string): 'empty' | 'valid' | 'invalid' {
  if (value === '') return 'empty';
  return validateScore(value) === null ? 'valid' : 'invalid';
}

// ── Debounce hook ─────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Componente principal ──────────────────────
export default function BulkGradesEntry() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  // Filtros
  const [selectedCourse,  setSelectedCourse]  = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedPeriod,  setSelectedPeriod]  = useState('');
  const [selectedType,    setSelectedType]    = useState('EXAM');
  const [selectedDate,    setSelectedDate]    = useState(
    new Date().toISOString().split('T')[0]
  );
  const [fillValue, setFillValue] = useState('');

  // Filas de alumnos
  const [rows, setRows] = useState<StudentRow[]>([]);

  // Refs para navegación por teclado
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Datos ──────────────────────────────────
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

  const subjects = courseDetail?.courseSubjects?.filter((cs: any) => {
  // ADMIN y DIRECTOR ven todas las materias
    if (['ADMIN', 'DIRECTOR', 'SECRETARY', 'SUPER_ADMIN'].includes(session?.user?.role as string)) {
      return true;
    }
    // TEACHER solo ve sus materias
    return cs.teacherId === session?.user?.id;
  }) ?? [];

  // ── Inicializar filas cuando cambia el curso ──
  useEffect(() => {
    if (courseDetail?.courseStudents) {
      const activeStudents = courseDetail.courseStudents
        .filter((cs: any) => cs.status === 'ACTIVE')
        .sort((a: any, b: any) =>
          a.student.lastName.localeCompare(b.student.lastName)
        );

      setRows(
        activeStudents.map((cs: any) => ({
          studentId: cs.student.id,
          firstName: cs.student.firstName,
          lastName:  cs.student.lastName,
          score:     '',
          saved:     false,
          error:     null,
        }))
      );
    }
  }, [courseDetail]);

  // ── Guardar notas ─────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (gradesToSave: { studentId: string; score: number }[]) => {
      await Promise.all(
        gradesToSave.map((g) =>
          api.post('/grades', {
            studentId:       g.studentId,
            courseSubjectId: selectedSubject,
            periodId:        selectedPeriod,
            score:           g.score,
            type:            selectedType,
            date:            selectedDate,
          })
        )
      );
    },
    onSuccess: (_, gradesToSave) => {
      setRows((prev) =>
        prev.map((row) =>
          gradesToSave.find((g) => g.studentId === row.studentId)
            ? { ...row, saved: true }
            : row
        )
      );
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast.success('Notas guardadas exitosamente');
    },
    onError: () => toast.error('Error al guardar las notas'),
  });

  // ── Guardado automático con debounce ──────
  const debouncedRows = useDebounce(rows, 2000);

  useEffect(() => {
  if (!selectedSubject || !selectedPeriod) return;
  if (saveMutation.isPending) return;
  
  const toSave = debouncedRows.filter(
    (row) => row.score !== '' && !row.saved && validateScore(row.score) === null
  );

  if (toSave.length > 0) {
    saveMutation.mutate(
      toSave.map((r) => ({ studentId: r.studentId, score: Number(r.score) }))
    );
  }
}, [debouncedRows, selectedSubject, selectedPeriod]);

  // ── Actualizar score de una fila ──────────
  function updateScore(index: number, value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? { ...row, score: value, saved: false, error: validateScore(value) }
          : row
      )
    );
  }

  // ── Navegación por teclado ────────────────
  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Tab') {
      // Tab navega normalmente entre inputs
    }
  }

  // ── Pegar desde Excel ─────────────────────
  async function handlePasteFromExcel() {
    try {
      const text = await navigator.clipboard.readText();
      const values = text
        .split('\n')
        .map((line) => line.split('\t')[0].trim().replace(',', '.'));

      setRows((prev) =>
        prev.map((row, i) => {
          if (i >= values.length || values[i] === '') return row;
          const val   = values[i];
          const error = validateScore(val);
          return { ...row, score: val, saved: false, error };
        })
      );
      toast.success(`${values.filter(Boolean).length} notas pegadas desde Excel`);
    } catch {
      toast.error('No se pudo acceder al portapapeles. Permitir acceso en el navegador.');
    }
  }

  // ── Completar todos ───────────────────────
  function fillAll() {
    if (!fillValue) return;
    const error = validateScore(fillValue);
    setRows((prev) =>
      prev.map((row) => ({ ...row, score: fillValue, saved: false, error }))
    );
  }

  // ── Guardar manualmente ───────────────────
  function handleManualSave() {
  const toSave = rows.filter(
    (row) => row.score !== '' && !row.saved && validateScore(row.score) === null
  );
  if (toSave.length === 0) {
    toast.info('No hay notas nuevas para guardar');
    return;
  }
  saveMutation.mutate(
    toSave.map((r) => ({ studentId: r.studentId, score: Number(r.score) }))
  );
}

  const canSave = selectedCourse && selectedSubject && selectedPeriod;
  const validCount   = rows.filter((r) => r.score !== '' && validateScore(r.score) === null).length;
  const invalidCount = rows.filter((r) => r.error !== null).length;
  const savedCount   = rows.filter((r) => r.saved).length;

  return (
    <div className="space-y-4">

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Select value={selectedCourse} onValueChange={(v) => {
          setSelectedCourse(v);
          setSelectedSubject('');
          setRows([]);
        }}>
          <SelectTrigger><SelectValue placeholder="Curso" /></SelectTrigger>
          <SelectContent>
            {courses?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedCourse}>
          <SelectTrigger><SelectValue placeholder="Materia" /></SelectTrigger>
          <SelectContent>
            {subjects.map((cs: any) => (
              <SelectItem key={cs.id} value={cs.id}>{cs.subject.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={!selectedCourse}>
          <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            {periods?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(typeLabels).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {/* Toolbar */}
      {rows.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Completar todos */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={10}
              step={0.01}
              placeholder="Nota para todos"
              value={fillValue}
              onChange={(e) => setFillValue(e.target.value)}
              className="w-36"
            />
            <Button size="sm" variant="outline" onClick={fillAll} disabled={!fillValue}>
              <CheckSquare className="h-4 w-4 mr-1.5" />
              Completar todos
            </Button>
          </div>

          {/* Pegar desde Excel */}
          <Button size="sm" variant="outline" onClick={handlePasteFromExcel}>
            <ClipboardPaste className="h-4 w-4 mr-1.5" />
            Pegar desde Excel
          </Button>

          <div className="flex-1" />

          {/* Estado */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {savedCount > 0 && (
              <Badge variant="default">{savedCount} guardadas</Badge>
            )}
            {validCount > 0 && (
              <Badge variant="secondary">{validCount} pendientes</Badge>
            )}
            {invalidCount > 0 && (
              <Badge variant="destructive">{invalidCount} con error</Badge>
            )}
            {saveMutation.isPending && (
              <span className="text-muted-foreground">Guardando...</span>
            )}
          </div>

          {/* Guardar 
          <Button
            size="sm"
            onClick={handleManualSave}
            disabled={!canSave || saveMutation.isPending || validCount === 0}
          >
            <Save className="h-4 w-4 mr-1.5" />
            Guardar ahora
          </Button>*/}
          <div className="flex items-center gap-2 text-xs">
            {saveMutation.isPending && (
              <span className="text-muted-foreground animate-pulse">Guardando...</span>
            )}
            {!saveMutation.isPending && savedCount > 0 && (
              <span className="text-emerald-600">✓ Todo guardado</span>
            )}
          </div>
        </div>
      )}

      {/* Tabla de carga */}
      {!selectedCourse ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
          Seleccioná un curso para comenzar
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
          No hay alumnos en este curso
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-8">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Alumno</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40">
                  Nota (0–10)
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const status = getScoreStatus(row.score);
                return (
                  <tr
                    key={row.studentId}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2 text-muted-foreground">{index + 1}</td>
                    <td className="px-4 py-2 font-medium">
                      {row.lastName}, {row.firstName}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="number"
                        min={0}
                        max={10}
                        step={0.01}
                        value={row.score}
                        onChange={(e) => updateScore(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        disabled={!canSave}
                        className={`h-8 w-28 text-center font-mono ${
                          status === 'valid'   ? 'border-emerald-400 focus-visible:ring-emerald-400' :
                          status === 'invalid' ? 'border-red-400 focus-visible:ring-red-400' :
                          ''
                        }`}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-4 py-2">
                      {status === 'empty' && (
                        <span className="text-xs text-muted-foreground">Sin nota</span>
                      )}
                      {status === 'valid' && row.saved && (
                        <span className="text-xs text-emerald-600 font-medium">✓ Guardada</span>
                      )}
                      {status === 'valid' && !row.saved && (
                        <span className="text-xs text-amber-600">Pendiente</span>
                      )}
                      {status === 'invalid' && (
                        <span className="text-xs text-red-600">{row.error}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && !canSave && (
        <p className="text-xs text-muted-foreground text-center">
          Seleccioná materia y período para habilitar la carga
        </p>
      )}

      {canSave && rows.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Navegá con Enter ↓ o ↑ · Tab para moverse · Las notas se guardan automáticamente en 2 segundos
        </p>
      )}
    </div>
  );
}