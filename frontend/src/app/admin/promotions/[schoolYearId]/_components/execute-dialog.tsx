'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useExecutePromotion, usePromotionPreview } from '@/lib/api/promotion';
import type { SchoolYear } from '@/app/admin/courses/_components/courses.types';

interface Props {
  schoolYearId: string;
  schoolYear: SchoolYear;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecuteDialog({ schoolYearId, schoolYear, open, onOpenChange }: Props) {
  const execute = useExecutePromotion();
  const { data: preview } = usePromotionPreview(schoolYearId);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Ejecutar promoción?</AlertDialogTitle>
          <AlertDialogDescription>
            Se procesarán los resultados de promoción para el ciclo lectivo{' '}
            <strong>{schoolYear.year}</strong>.

            {preview && (
              <div className="mt-3 space-y-1 text-sm">
                <p>Total estudiantes: <strong>{preview.totalStudents}</strong></p>
                <p className="text-green-600">Promovidos: <strong>{preview.projections.promoted}</strong></p>
                <p className="text-amber-600">Retenidos: <strong>{preview.projections.retained}</strong></p>
                <p className="text-blue-600">Graduados: <strong>{preview.projections.graduated}</strong></p>
              </div>
            )}

            {!preview && (
              <p className="mt-2 text-sm text-muted-foreground italic">
                No hay previsualización disponible. La promoción se ejecutará con la configuración actual.
              </p>
            )}

            <p className="mt-4 text-sm text-destructive font-medium">
              Esta acción no se puede deshacer. Los resultados se aplicarán definitivamente.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={execute.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={execute.isPending}
            onClick={(e) => {
              e.preventDefault();
              execute.mutate(schoolYearId, {
                onSuccess: () => onOpenChange(false),
              });
            }}
          >
            {execute.isPending ? 'Ejecutando…' : 'Ejecutar promoción'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
