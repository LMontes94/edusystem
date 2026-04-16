'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCourses } from '@/lib/api/courses';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SummaryTab }           from './_components/summary-tab';
import { RankingTab }           from './_components/ranking-tab';
import { MonthlyEvolutionTab }  from './_components/monthly-evolution-tab';
import {
  DetailViewMode, MONTHS, buildSummaries, buildDateParams,
} from './_components/attendance-detail.types';

export default function AttendanceDetailPage() {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedMonth,  setSelectedMonth]  = useState('all');
  const [viewMode,       setViewMode]       = useState<DetailViewMode>('summary');

  const { data: courses } = useCourses();

  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn:  async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  const { data: attendance, isLoading } = useQuery({
    queryKey: ['attendance-detail', selectedCourse, selectedMonth],
    queryFn:  async () => {
      const res = await api.get('/attendance', {
        params: { courseId: selectedCourse, ...buildDateParams(selectedMonth) },
      });
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  const summaries = attendance && courseDetail
    ? buildSummaries(attendance, courseDetail.courseStudents ?? [])
    : [];

  const tabs: { id: DetailViewMode; label: string }[] = [
    { id: 'summary',   label: 'Resumen'            },
    { id: 'ranking',   label: 'Ranking faltas'      },
    { id: 'evolution', label: 'Evolución mensual'   },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Detalle de asistencia</h1>
          <p className="text-sm text-muted-foreground">
            Resumen de asistencia por alumno y curso
          </p>
        </div>
        {/* Tabs — solo visibles cuando hay curso seleccionado */}
        {selectedCourse && (
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={viewMode === tab.id ? 'default' : 'outline'}
                onClick={() => setViewMode(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Filtros */}
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

        {/* El filtro de mes solo aplica a Summary y Ranking; Evolution lo avisa internamente */}
        {viewMode !== 'evolution' && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Contenido */}
      {!selectedCourse ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
          Seleccioná un curso para ver el detalle de asistencia
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Cargando...
        </div>
      ) : (
        <>
          {viewMode === 'summary'   && <SummaryTab  summaries={summaries} />}
          {viewMode === 'ranking'   && <RankingTab  summaries={summaries} />}
          {viewMode === 'evolution' && (
            <MonthlyEvolutionTab
              attendance={attendance ?? []}
              courseStudents={courseDetail?.courseStudents ?? []}
            />
          )}
        </>
      )}
    </div>
  );
}