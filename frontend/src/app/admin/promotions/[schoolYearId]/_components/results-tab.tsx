'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePromotionResults } from '@/lib/api/promotion';
import { StudentNameCell } from './student-name-cell';
import type { PromotionResultType, PromotionResult } from '@/types/promotion.types';

const RESULT_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' }> = {
  PROMOTED: { label: 'Promovido', variant: 'default' },
  RETAINED: { label: 'Retenido', variant: 'secondary' },
  GRADUATED: { label: 'Graduado', variant: 'default' },
};

function formatDisplayDate(raw: string): string {
  return raw.split('T')[0].split('-').reverse().join('/');
}

interface Props {
  schoolYearId: string;
}

export function ResultsTab({ schoolYearId }: Props) {
  const [resultFilter, setResultFilter] = useState<PromotionResultType | ''>('');
  const [overrideFilter, setOverrideFilter] = useState<boolean | ''>('');
  const [search, setSearch] = useState('');

  const { data: results, isLoading } = usePromotionResults({
    schoolYearId,
    ...(resultFilter ? { result: resultFilter } : {}),
    ...(overrideFilter !== '' ? { isOverride: overrideFilter } : {}),
  });

  const filtered = search
    ? (results ?? []).filter((r) =>
        (r.studentFullName ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : (results ?? []);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Cargando resultados...
      </p>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No hay resultados de promoción para este ciclo lectivo.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-44">
          <Select
            value={resultFilter}
            onValueChange={(v) => setResultFilter(v as PromotionResultType | '')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los resultados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los resultados</SelectItem>
              <SelectItem value="PROMOTED">Promovidos</SelectItem>
              <SelectItem value="RETAINED">Retenidos</SelectItem>
              <SelectItem value="GRADUATED">Graduados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Select
            value={overrideFilter === '' ? '' : String(overrideFilter)}
            onValueChange={(v) => {
              if (v === '') setOverrideFilter('');
              else setOverrideFilter(v === 'true');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los tipos</SelectItem>
              <SelectItem value="false">Automáticos</SelectItem>
              <SelectItem value="true">Manuales</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Buscar alumno..."
          className="w-60"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Override</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Decidido por</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron resultados con los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r: PromotionResult) => {
                const config = RESULT_CONFIG[r.result];
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <StudentNameCell name={r.studentFullName ?? '—'} studentId={r.studentId} className="font-medium" />
                    </TableCell>
                    <TableCell>
                      <Badge variant={config?.variant ?? 'outline'}>
                        {config?.label ?? r.result}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.isOverride ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Manual
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {r.reason ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.decidedByName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDisplayDate(r.decidedAt)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
