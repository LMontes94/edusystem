'use client';

import { Badge } from '@/components/ui/badge';
import type { ReportType } from '../types';
import { REPORT_TYPES } from '../types';

interface Props {
  reportType: ReportType;
  size?: 'sm' | 'default';
}

export function ReportTypeBadge({ reportType, size }: Props) {
  const config = REPORT_TYPES[reportType];

  return (
    <Badge
      variant={config.badgeVariant}
      className={size === 'sm' ? 'text-[10px] px-1.5 py-0' : undefined}
    >
      {config.badge}
    </Badge>
  );
}
