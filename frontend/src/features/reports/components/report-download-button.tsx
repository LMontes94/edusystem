'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { ReportType } from '../types';
import { REPORT_TYPES } from '../types';
import { useDownloadRiteReport, useDownloadValoracionesReport, useDownloadPrimaryReport } from '../api';

interface Props {
  reportType: ReportType;
  studentId: string;
  schoolYearId: string;
  studentName?: string;
  disabled?: boolean;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

const hookMap = {
  RITE: useDownloadRiteReport,
  VALORACIONES: useDownloadValoracionesReport,
  PRIMARY_QUALITATIVE: useDownloadPrimaryReport,
} as const;

export function ReportDownloadButton({
  reportType,
  studentId,
  schoolYearId,
  disabled,
  size,
  className,
}: Props) {
  const config = REPORT_TYPES[reportType];
  const useHook = hookMap[reportType];
  const { mutate, isPending } = useHook();

  return (
    <Button
      size={size ?? 'sm'}
      className={className}
      disabled={disabled || isPending || !studentId || !schoolYearId}
      onClick={() => mutate({ studentId, schoolYearId })}
    >
      <Download className="h-3.5 w-3.5 mr-1.5" />
      {isPending ? config.loadingMsg : config.shortLabel}
    </Button>
  );
}
