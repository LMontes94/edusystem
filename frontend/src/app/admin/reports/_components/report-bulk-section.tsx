'use client';

import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BulkReportDownload } from '@/features/reports/components/bulk-report-download';
import type { ReportType } from '@/features/reports/types';

interface Props {
  reportType: ReportType;
  courseId: string;
  schoolYearId: string;
  studentCount: number;
  generating: boolean;
  disabled?: boolean;
}

export function ReportBulkSection({
  reportType, courseId, schoolYearId, studentCount, generating, disabled,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Curso completo
          {studentCount > 0 && (
            <Badge variant="secondary">{studentCount} alumnos</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <BulkReportDownload
          reportType={reportType}
          courseId={courseId}
          schoolYearId={schoolYearId}
          studentCount={studentCount}
          disabled={disabled || generating}
        />
      </CardContent>
    </Card>
  );
}
