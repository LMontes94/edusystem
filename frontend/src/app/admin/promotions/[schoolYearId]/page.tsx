'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSchoolYears } from '@/lib/api/courses';
import { TABS, type TabId } from './_components/promotion-detail.types';
import { PromotionHeader } from './_components/promotion-header';
import { PreviewTab } from './_components/preview-tab';
import { StatisticsTab } from './_components/statistics-tab';
import { ResultsTab } from './_components/results-tab';
import { ExecuteDialog } from './_components/execute-dialog';
import { OverrideDialog } from './_components/override-dialog';

export default function PromotionDetailPage() {
  const { schoolYearId } = useParams<{ schoolYearId: string }>();
  const [tab, setTab] = useState<TabId>('preview');
  const [executeOpen, setExecuteOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const { data: schoolYears, isLoading } = useSchoolYears();

  const schoolYear = schoolYears?.find((sy) => sy.id === schoolYearId);
  const visibleTabs = TABS.filter((t) => t.show(schoolYear?.promotionStatus));
  const status = schoolYear?.promotionStatus;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (!schoolYear) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Ciclo lectivo no encontrado
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay información disponible para este ciclo lectivo.
      </div>
    );
  }

  // If current tab is hidden, switch to first visible
  if (!visibleTabs.some((t) => t.id === tab)) {
    setTab(visibleTabs[0].id);
  }

  return (
    <div className="space-y-6">
      <PromotionHeader
        schoolYear={schoolYear}
        onExecute={() => setExecuteOpen(true)}
        onOverride={() => setOverrideOpen(true)}
      />

      {/* Tab bar */}
      <div className="flex gap-2 border-b pb-0">
        {visibleTabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? 'default' : 'ghost'}
            className="rounded-b-none"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'preview' && status !== 'EXECUTING' && status !== 'COMPLETED' && (
        <PreviewTab schoolYearId={schoolYearId} />
      )}
      {tab === 'statistics' && status !== undefined && (
        <StatisticsTab schoolYearId={schoolYearId} />
      )}
      {tab === 'results' && status !== undefined && (
        <ResultsTab schoolYearId={schoolYearId} />
      )}

      <ExecuteDialog
        schoolYearId={schoolYearId}
        schoolYear={schoolYear}
        open={executeOpen}
        onOpenChange={setExecuteOpen}
      />
      <OverrideDialog
        schoolYearId={schoolYearId}
        schoolYear={schoolYear}
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
      />
    </div>
  );
}
