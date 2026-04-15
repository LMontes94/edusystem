'use client';

import { useState } from 'react';
import { useCourses } from '@/lib/api/courses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TakeAttendanceTab } from './_components/take-attendance-tab';
import { HistoryTab }        from './_components/history-tab';
import { RecordsTab }        from './_components/records-tab';
import { ViewMode }          from './_components/attendance.types';

export default function AttendancePage() {
  const today = new Date().toISOString().split('T')[0];

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedDate,   setSelectedDate]   = useState(today);
  const [viewMode,       setViewMode]       = useState<ViewMode>('take');

  const { data: courses } = useCourses();

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Asistencia</h1>
          <p className="text-sm text-muted-foreground">
            Registrá la asistencia diaria por curso
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === 'take' ? 'default' : 'outline'}
            onClick={() => setViewMode('take')}
          >
            Tomar lista
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'history' ? 'default' : 'outline'}
            onClick={() => setViewMode('history')}
          >
            Historial
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'records' ? 'default' : 'outline'}
            onClick={() => setViewMode('records')}
          >
            Actas
          </Button>
        </div>
      </div>

      {/* Filtros — se ocultan en la tab de Actas (tiene los suyos propios) */}
      {viewMode !== 'records' && (
        <div className="flex gap-3 flex-wrap">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Seleccioná un curso" />
            </SelectTrigger>
            <SelectContent>
              {courses?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
        </div>
      )}

      {/* Tabs */}
      {viewMode === 'take' && (
        <>
          <TakeAttendanceTab
            selectedCourse={selectedCourse}
            selectedDate={selectedDate}
            courses={courses}
          />
          {!selectedCourse && (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Seleccioná un curso para comenzar
            </div>
          )}
        </>
      )}

      {viewMode === 'history' && (
        <HistoryTab
          selectedCourse={selectedCourse}
          selectedDate={selectedDate}
        />
      )}

      {viewMode === 'records' && <RecordsTab />}

    </div>
  );
}