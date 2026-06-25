'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { getStatusBadge } from '../../_components/promotions-columns';
import { useAppSession } from '@/lib/hooks/use-app-session';
import { useIsOnLeave } from '@/lib/hooks/use-is-on-leave';
import type { SchoolYear } from '@/app/admin/courses/_components/courses.types';

// SUPER_ADMIN queda fuera intencionalmente siguiendo el spec original de Phase 4.
// En reports/permissions.ts y middleware.ts, SUPER_ADMIN sí tiene permisos administrativos
// plenos — esto podría ser una inconsistencia real a validar con producto.
const CAN_EXECUTE_ROLES = ['ADMIN', 'DIRECTOR'];

interface Props {
  schoolYear: SchoolYear;
  onExecute?: () => void;
}

export function PromotionHeader({ schoolYear, onExecute }: Props) {
  const router = useRouter();
  const { data: session } = useAppSession();
  const isOnLeave = useIsOnLeave();

  const badge = getStatusBadge(schoolYear.promotionStatus);
  const currentRole = (session?.user as any)?.role ?? '';
  const canExecute = CAN_EXECUTE_ROLES.includes(currentRole) && !isOnLeave;

  const isExecuting = schoolYear.promotionStatus === 'EXECUTING';
  const showExecute = canExecute && schoolYear.promotionStatus !== 'COMPLETED';

  const { totalStudents, promoted, retained, graduated } =
    schoolYear.promotionSummary ?? {};

  return (
    <div className="space-y-4">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Ciclo lectivo {schoolYear.year}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {schoolYear.status === 'CLOSED' ? 'Cerrado' : schoolYear.status ?? 'Sin estado'}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalStudents ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Total estudiantes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{promoted ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Promovidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{retained ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Retenidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{graduated ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Graduados</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {showExecute && (
          <Button
            size="sm"
            variant="default"
            disabled={isExecuting}
            onClick={onExecute}
          >
            {isExecuting ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Ejecutando…</>
            ) : (
              'Ejecutar promoción'
            )}
          </Button>
        )}

        {schoolYear.promotionSummaryStale && (
          <Badge variant="destructive">Resumen desactualizado</Badge>
        )}
      </div>
    </div>
  );
}
