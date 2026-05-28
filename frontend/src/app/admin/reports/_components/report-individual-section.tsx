'use client';

import { GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ReportDownloadButton } from '@/features/reports/components/report-download-button';
import type { ReportType } from '@/features/reports/types';

interface Props {
  reportType: ReportType;
  students: any[];
  selectedStudent: string;
  onStudentChange: (v: string) => void;
  schoolYearId: string;
  generating: boolean;
  studentSelectDisabled?: boolean;
}

export function ReportIndividualSection({
  reportType, students, selectedStudent, onStudentChange,
  schoolYearId, generating, studentSelectDisabled,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          Reporte individual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Alumno</label>
          <Select
            value={selectedStudent}
            onValueChange={onStudentChange}
            disabled={studentSelectDisabled}
          >
            <SelectTrigger><SelectValue placeholder="Seleccioná un alumno..." /></SelectTrigger>
            <SelectContent>
              {students.map((cs: any) => (
                <SelectItem key={cs.student.id} value={cs.student.id}>
                  {cs.student.lastName}, {cs.student.firstName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ReportDownloadButton
          reportType={reportType}
          studentId={selectedStudent}
          schoolYearId={schoolYearId}
          disabled={generating}
          size="default"
          className="w-full"
        />
      </CardContent>
    </Card>
  );
}
