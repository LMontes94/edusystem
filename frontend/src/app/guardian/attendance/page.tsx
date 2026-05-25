'use client';

import { useState, useMemo } from 'react';
import { useMyChildren } from '@/lib/api/students';
import { useAttendance } from '@/lib/api/attendance';
import { GuardianStudentSelector } from '@/components/guardian/guardian-student-selector';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, XCircle, Clock, FileCheck } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PRESENT:   { label: 'Presente',    color: 'text-emerald-600', icon: CheckCircle },
  ABSENT:    { label: 'Ausente',     color: 'text-red-600',     icon: XCircle     },
  LATE:      { label: 'Tarde',       color: 'text-amber-600',   icon: Clock       },
  JUSTIFIED: { label: 'Justificado', color: 'text-blue-600',    icon: FileCheck   },
};

export default function GuardianAttendancePage() {
  const { data: children } = useMyChildren();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const { data: allRecords, isLoading, isError } = useAttendance({});

  const records = useMemo(() => {
    if (!allRecords || !selectedStudentId) return [];
    return allRecords.filter((r) => r.student.id === selectedStudentId);
  }, [allRecords, selectedStudentId]);

  const stats = useMemo(() => {
    if (records.length === 0) return null;
    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const justified = records.filter((r) => r.status === 'JUSTIFIED').length;
    return { total, present, absent, late, justified, pct: Math.round((present / total) * 100) };
  }, [records]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Asistencia</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consultá la asistencia de tus hijos
        </p>
      </div>

      {(!children || children.length === 0) ? (
        <p className="text-sm text-muted-foreground">
          No hay alumnos vinculados a tu cuenta
        </p>
      ) : (
        <>
          <GuardianStudentSelector
            value={selectedStudentId}
            onValueChange={setSelectedStudentId}
            placeholder="Seleccionar hijo..."
          />

          {!selectedStudentId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <AlertCircle className="h-4 w-4" />
              Seleccioná un alumno para ver su asistencia
            </div>
          )}

          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-sm text-destructive">
              Error al cargar la asistencia
            </p>
          )}

          {!isLoading && !isError && selectedStudentId && records.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay registros de asistencia
            </p>
          )}

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card>
                <CardContent className="py-3 px-4 text-center">
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 px-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{stats.present}</p>
                  <p className="text-xs text-muted-foreground">Presentes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 px-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                  <p className="text-xs text-muted-foreground">Ausencias</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 px-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
                  <p className="text-xs text-muted-foreground">Tardes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 px-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.justified}</p>
                  <p className="text-xs text-muted-foreground">Justificados</p>
                </CardContent>
              </Card>
            </div>
          )}

          {!isLoading && !isError && records.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="divide-y">
                {records.map((r) => {
                  const cfg = statusConfig[r.status] ?? { label: r.status, color: 'text-muted-foreground', icon: AlertCircle };
                  const Icon = cfg.icon;
                  return (
                    <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                        <span className={cfg.color + ' font-medium'}>{cfg.label}</span>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{r.date.split('-').reverse().join('/')}</p>
                        <p>{r.course?.name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
