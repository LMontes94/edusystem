'use client';

import { useState }  from 'react';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Badge }     from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, FileCheck } from 'lucide-react';
import { useBulkSportAttendance, SportGroup, BulkSportAttendanceRecord } from '@/lib/api/sports';
import { useCourses } from '@/lib/api/courses';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
}                    from '@/components/ui/select';
import { statusConfig, AttendanceStatus } from '../../../_components/sports.types';

interface Props {
  group: SportGroup;
}

const STATUS_ICONS = {
  PRESENT:   CheckCircle,
  ABSENT:    XCircle,
  LATE:      Clock,
  JUSTIFIED: FileCheck,
};

export function TakeSportAttendance({ group }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const [date,     setDate]     = useState(today);
  const [courseId, setCourseId] = useState('');
  const [records,  setRecords]  = useState<Record<string, AttendanceStatus>>({});

  const { data: courses } = useCourses();
  const bulkAttendance    = useBulkSportAttendance();

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords(prev => ({ ...prev, [studentId]: status }));
  }

  function markAll(status: AttendanceStatus) {
    const all: Record<string, AttendanceStatus> = {};
    group.students.forEach(s => { all[s.studentId] = status; });
    setRecords(all);
  }

  async function handleSubmit() {
    if (!courseId) return;

    const recordList: BulkSportAttendanceRecord[] = group.students.map(s => ({
      studentId: s.studentId,
      status:    records[s.studentId] ?? 'PRESENT',
    }));

    await bulkAttendance.mutateAsync({
      sportGroupId: group.id,
      courseId,
      date,
      records: recordList,
    });
  }

  const filled  = Object.keys(records).length;
  const total   = group.students.length;

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Fecha</p>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1 flex-1 min-w-40">
          <p className="text-xs text-muted-foreground">Curso (para el registro)</p>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccioná el curso" />
            </SelectTrigger>
            <SelectContent>
              {courses?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Marcar todos:</span>
        {(['PRESENT', 'ABSENT', 'LATE'] as AttendanceStatus[]).map(s => {
          const Icon = STATUS_ICONS[s];
          return (
            <Button
              key={s}
              size="sm"
              variant="outline"
              className={`h-7 text-xs gap-1.5 ${statusConfig[s].color}`}
              onClick={() => markAll(s)}
            >
              <Icon className="h-3.5 w-3.5" />
              {statusConfig[s].label}
            </Button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">
          {filled}/{total} registrados
        </span>
      </div>

      {/* Lista de alumnos */}
      {group.students.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Este grupo no tiene alumnos asignados.
        </p>
      ) : (
        <div className="space-y-2">
          {group.students.map(({ student, studentId }) => {
            const status = records[studentId] ?? 'PRESENT';
            const config = statusConfig[status];
            return (
              <div
                key={studentId}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${config.bgColor}`}
              >
                <div>
                  <p className="text-sm font-medium">
                    {student.lastName}, {student.firstName}
                  </p>
                  <p className="text-xs text-muted-foreground">{student.documentNumber}</p>
                </div>
                <div className="flex gap-1">
                  {(['PRESENT', 'LATE', 'ABSENT', 'JUSTIFIED'] as AttendanceStatus[]).map(s => {
                    const Icon = STATUS_ICONS[s];
                    const isSelected = status === s;
                    return (
                      <Button
                        key={s}
                        size="icon"
                        variant={isSelected ? 'default' : 'ghost'}
                        className={`h-8 w-8 ${!isSelected ? statusConfig[s].color : ''}`}
                        title={statusConfig[s].label}
                        onClick={() => setStatus(studentId, s)}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Guardar */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSubmit}
          disabled={bulkAttendance.isPending || !courseId || group.students.length === 0}
        >
          {bulkAttendance.isPending ? 'Guardando...' : 'Guardar asistencia'}
        </Button>
      </div>
    </div>
  );
}