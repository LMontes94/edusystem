'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePromotionPreview } from '@/lib/api/promotion';
import { StudentNameCell } from './student-name-cell';
import type { StudentProjection, RuleResultProjection } from '@/types/promotion.types';

const RESULT_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' }> = {
  PROMOTED: { label: 'Promovido', variant: 'default' },
  RETAINED: { label: 'Retenido',  variant: 'secondary' },
  GRADUATED:{ label: 'Graduado',  variant: 'default' },
};

function RuleResults({ rules }: { rules: RuleResultProjection[] }) {
  return (
    <div className="space-y-1 py-1">
      {rules.map((rule, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <Badge variant={rule.passed ? 'default' : 'destructive'} className="h-5 px-1.5">
            {rule.passed ? '✓' : '✗'}
          </Badge>
          <span className="text-muted-foreground">{rule.rule}</span>
          {rule.reason && (
            <span className="text-muted-foreground/70 italic">— {rule.reason}</span>
          )}
        </div>
      ))}
    </div>
  );
}

interface Props {
  schoolYearId: string;
}

export function PreviewTab({ schoolYearId }: Props) {
  const { data: preview, isLoading } = usePromotionPreview(schoolYearId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleRow = (studentId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Cargando previsualización...
      </p>
    );
  }

  if (!preview || preview.students.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No se encontraron proyecciones de promoción para este ciclo lectivo.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Alumno</TableHead>
            <TableHead>Resultado</TableHead>
            <TableHead>Próximo curso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.students.map((student: StudentProjection) => {
            const config = RESULT_CONFIG[student.result];
            const isExpanded = expanded.has(student.studentId);
            return (
              <>
                <TableRow
                  key={student.studentId}
                  className="cursor-pointer"
                  onClick={() => toggleRow(student.studentId)}
                >
                  <TableCell>
                    {student.ruleResults.length > 0 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />
                        }
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <StudentNameCell name={student.studentFullName} studentId={student.studentId} className="font-medium" />
                  </TableCell>
                  <TableCell>
                    <Badge variant={config?.variant ?? 'outline'}>
                      {config?.label ?? student.result}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {student.toSchoolYearId ?? student.toLevelGradeId ?? '—'}
                  </TableCell>
                </TableRow>
                {isExpanded && student.ruleResults.length > 0 && (
                  <TableRow key={`${student.studentId}-rules`}>
                    <TableCell />
                    <TableCell colSpan={3}>
                      <RuleResults rules={student.ruleResults} />
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
