'use client';

import { useRouter } from 'next/navigation';
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
import { getStatusBadge } from './promotions-columns';
import type { SchoolYear } from '@/app/admin/courses/_components/courses.types';

export function PromotionsTable({ schoolYears }: { schoolYears: SchoolYear[] }) {
  const router = useRouter();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Año</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Total estudiantes</TableHead>
            <TableHead>Promovidos</TableHead>
            <TableHead>Retenidos</TableHead>
            <TableHead>Graduados</TableHead>
            <TableHead>Desactualizado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {schoolYears.map((sy) => {
            const badge = getStatusBadge(sy.promotionStatus);
            return (
              <TableRow key={sy.id}>
                <TableCell className="font-medium">{sy.year}</TableCell>
                <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                <TableCell>{sy.promotionSummary?.totalStudents ?? '—'}</TableCell>
                <TableCell>{sy.promotionSummary?.promoted ?? '—'}</TableCell>
                <TableCell>{sy.promotionSummary?.retained ?? '—'}</TableCell>
                <TableCell>{sy.promotionSummary?.graduated ?? '—'}</TableCell>
                <TableCell>
                  {sy.promotionSummaryStale
                    ? <Badge variant="destructive">Desactualizado</Badge>
                    : '—'}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/admin/promotions/${sy.id}`)}
                  >
                    {/* TODO Phase 3: Promotion Detail Page */}
                    Ver promoción
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
