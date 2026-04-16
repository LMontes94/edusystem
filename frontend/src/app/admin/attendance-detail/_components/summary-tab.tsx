'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, FileCheck } from 'lucide-react';
import { useState } from 'react';
import {
  AttendanceSummary, rateColor, rateBadgeVariant,
} from './attendance-detail.types';

interface Props {
  summaries: AttendanceSummary[];
}

export function SummaryTab({ summaries }: Props) {
  const [search, setSearch] = useState('');

  const filtered = summaries.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.student.firstName.toLowerCase().includes(q) ||
      s.student.lastName.toLowerCase().includes(q)  ||
      s.student.documentNumber.includes(q)
    );
  });

  const globalStats = filtered.reduce(
    (acc, s) => {
      acc.present   += s.present;
      acc.absent    += s.absent;
      acc.late      += s.late;
      acc.justified += s.justified;
      acc.total     += s.total;
      return acc;
    },
    { present: 0, absent: 0, late: 0, justified: 0, total: 0 },
  );
  const globalRate = globalStats.total > 0
    ? Math.round(((globalStats.present + globalStats.late) / globalStats.total) * 100)
    : 0;

  return (
    <div className="space-y-4">

      {/* Métricas globales */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: 'Presentes',    value: globalStats.present,   color: 'text-emerald-600', Icon: CheckCircle },
          { label: 'Ausentes',     value: globalStats.absent,    color: 'text-red-600',     Icon: XCircle     },
          { label: 'Tardanzas',    value: globalStats.late,      color: 'text-amber-600',   Icon: Clock       },
          { label: 'Justificadas', value: globalStats.justified, color: 'text-blue-600',    Icon: FileCheck   },
        ].map(({ label, value, color, Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-xl font-semibold ${color}`}>{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">% Asistencia del curso</p>
            <p className={`text-xl font-semibold ${rateColor(globalRate)}`}>{globalRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <Input
        placeholder="Buscar alumno..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Tabla */}
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead className="text-center">Presentes</TableHead>
              <TableHead className="text-center">Ausentes</TableHead>
              <TableHead className="text-center">Tardanzas</TableHead>
              <TableHead className="text-center">Justificadas</TableHead>
              <TableHead className="text-center">Total días</TableHead>
              <TableHead className="text-center">% Asistencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay registros de asistencia
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.student.id}>
                  <TableCell>
                    <p className="font-medium text-sm">
                      {s.student.lastName}, {s.student.firstName}
                    </p>
                    <p className="text-xs text-muted-foreground">DNI {s.student.documentNumber}</p>
                  </TableCell>
                  <TableCell className="text-center text-emerald-600 font-medium">{s.present}</TableCell>
                  <TableCell className="text-center text-red-600 font-medium">{s.absent}</TableCell>
                  <TableCell className="text-center text-amber-600 font-medium">{s.late}</TableCell>
                  <TableCell className="text-center text-blue-600 font-medium">{s.justified}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{s.total}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={rateBadgeVariant(s.total, s.rate)}>
                      {s.total === 0 ? 'Sin datos' : `${s.rate}%`}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}