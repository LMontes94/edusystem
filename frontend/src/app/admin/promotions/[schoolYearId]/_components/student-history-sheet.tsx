'use client';

import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useStudentPromotionHistory } from '@/lib/api/promotion';
import { useSchoolYears } from '@/lib/api/courses';
import type { PromotionHistoryItem } from '@/types/promotion.types';

const RESULT_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' }> = {
  PROMOTED: { label: 'Promovido', variant: 'default' },
  RETAINED: { label: 'Retenido', variant: 'secondary' },
  GRADUATED: { label: 'Graduado', variant: 'default' },
};

function formatDisplayDate(raw: string): string {
  return raw.split('T')[0].split('-').reverse().join('/');
}

interface Props {
  studentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentHistorySheet({ studentId, open, onOpenChange }: Props) {
  const { data: history, isLoading } = useStudentPromotionHistory(studentId);
  const { data: schoolYears } = useSchoolYears();

  const yearMap = new Map((schoolYears ?? []).map((sy) => [sy.id, sy.year]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Historial de promociones</SheetTitle>
          <SheetDescription>
            {history?.studentFullName ?? 'Cargando...'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Cargando historial...
            </p>
          )}

          {!isLoading && (!history || history.results.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin resultados de promoción para este alumno.
            </p>
          )}

          {!isLoading && history && history.results.length > 0 && (
            <>
              {history.results.map((item: PromotionHistoryItem, idx: number) => {
                const config = RESULT_CONFIG[item.result];
                const year = yearMap.get(item.fromSchoolYearId);
                return (
                  <div
                    key={`${item.fromSchoolYearId}-${idx}`}
                    className="rounded-lg border p-3 space-y-1.5 text-sm"
                  >
                    <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                      {year ?? item.fromSchoolYearId.slice(0, 8)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={config?.variant ?? 'outline'}>
                        {config?.label ?? item.result}
                      </Badge>
                      {item.isOverride && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5">
                          Manual
                        </Badge>
                      )}
                    </div>
                    {item.reason && (
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {item.reason}
                      </p>
                    )}
                    <p className="text-muted-foreground/60 text-[11px]">
                      {formatDisplayDate(item.decidedAt)}
                    </p>
                  </div>
                );
              })}

              {history.effectiveGraduationDate && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <p className="font-medium">🎓 Graduado</p>
                  <p className="text-xs text-blue-600">
                    {formatDisplayDate(history.effectiveGraduationDate)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
