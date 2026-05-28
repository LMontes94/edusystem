'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, ChevronDown, Loader2 } from 'lucide-react';
import type { ReportType } from '../types';
import { REPORT_TYPES } from '../types';
import { useDownloadRiteReport, useDownloadValoracionesReport } from '../api';

interface Props {
  studentId: string;
  schoolYearId: string;
  studentName?: string;
  disabled?: boolean;
  showRite?: boolean;
  showValoraciones?: boolean;
  size?: 'default' | 'sm';
}

export function ReportActionsDropdown({
  studentId,
  schoolYearId,
  disabled,
  showRite = true,
  showValoraciones = true,
  size = 'sm',
}: Props) {
  const [open, setOpen] = useState(false);
  const riteMutation = useDownloadRiteReport();
  const valMutation = useDownloadValoracionesReport();

  const canDownload = !disabled && !!studentId && !!schoolYearId;

  const items: { reportType: ReportType; label: string; pending: boolean; action: () => void }[] = [];

  if (showRite) {
    items.push({
      reportType: 'RITE',
      label: REPORT_TYPES.RITE.shortLabel,
      pending: riteMutation.isPending,
      action: () => riteMutation.mutate({ studentId, schoolYearId }),
    });
  }

  if (showValoraciones) {
    items.push({
      reportType: 'VALORACIONES',
      label: REPORT_TYPES.VALORACIONES.shortLabel,
      pending: valMutation.isPending,
      action: () => valMutation.mutate({ studentId, schoolYearId }),
    });
  }

  if (items.length === 0) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size={size} disabled={!canDownload || items.every((i) => i.pending)}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Descargar
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.reportType}
            disabled={item.pending}
            onClick={() => {
              item.action();
              setOpen(false);
            }}
          >
            {item.pending ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-2" />
            )}
            {item.pending ? REPORT_TYPES[item.reportType].loadingMsg : `Descargar ${item.label}`}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
