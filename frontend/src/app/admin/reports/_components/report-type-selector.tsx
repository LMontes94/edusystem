'use client';

import { Button } from '@/components/ui/button';
import { REPORT_TAB_OPTIONS } from './report-tab-config';
import type { ReportType } from '@/features/reports/types';

interface Props {
  value: ReportType;
  onChange: (value: ReportType) => void;
}

export function ReportTypeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {REPORT_TAB_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          size="sm"
          variant={value === opt.value ? 'default' : 'outline'}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
