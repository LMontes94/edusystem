'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import type { ReportType } from '../types';
import { REPORT_TYPES } from '../types';
import { useDownloadRiteBulkReport, useDownloadValoracionesBulkReport, useDownloadPrimaryBulkReport } from '../api';

interface Props {
  reportType: ReportType;
  courseId: string;
  schoolYearId: string;
  studentCount?: number;
  disabled?: boolean;
}

const hookMap = {
  RITE: useDownloadRiteBulkReport,
  VALORACIONES: useDownloadValoracionesBulkReport,
  PRIMARY_QUALITATIVE: useDownloadPrimaryBulkReport,
} as const;

export function BulkReportDownload({
  reportType,
  courseId,
  schoolYearId,
  studentCount,
  disabled,
}: Props) {
  const config = REPORT_TYPES[reportType];
  const useHook = hookMap[reportType];
  const { mutate, isPending } = useHook();

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || isPending || !courseId || !schoolYearId}
        onClick={() => mutate({ courseId, schoolYearId })}
      >
        <FileText className="h-3.5 w-3.5 mr-1.5" />
        {isPending ? 'Generando ZIP...' : `Descargar ${config.shortLabel} del curso`}
      </Button>
      {studentCount !== undefined && studentCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {studentCount} alumnos
        </Badge>
      )}
    </div>
  );
}
