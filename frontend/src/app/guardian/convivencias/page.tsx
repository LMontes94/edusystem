'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMyChildren } from '@/lib/api/students';
import { GuardianStudentSelector } from '@/components/guardian/guardian-student-selector';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle, Eye, AlertTriangle, MessageSquare,
  Star, Ban, Phone,
} from 'lucide-react';

interface ConvivenciaRecord {
  id: string;
  type: string;
  date: string;
  reason: string;
  savedAt: string;
  author: { id: string; firstName: string; lastName: string; role: string };
  course: { id: string; name: string; grade: number; division: string };
}

const typeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  observation:    { label: 'Observación',       color: 'bg-blue-50 text-blue-700 border-blue-300',       icon: Eye           },
  warning:        { label: 'Advertencia',        color: 'bg-amber-50 text-amber-700 border-amber-300',    icon: AlertTriangle },
  reprimand:      { label: 'Apercibimiento',     color: 'bg-orange-50 text-orange-700 border-orange-300', icon: MessageSquare },
  commendation:   { label: 'Felicitación',       color: 'bg-emerald-50 text-emerald-700 border-emerald-300', icon: Star       },
  suspension:     { label: 'Suspensión',         color: 'bg-red-50 text-red-700 border-red-300',          icon: Ban          },
  parent_meeting: { label: 'Citación de padres', color: 'bg-purple-50 text-purple-700 border-purple-300', icon: Phone        },
};

export default function GuardianConvivenciasPage() {
  const { data: children } = useMyChildren();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const { data: records, isLoading, isError } = useQuery({
    queryKey: ['convivencias', 'student', selectedStudentId],
    queryFn: async () => {
      const res = await api.get<ConvivenciaRecord[]>(`/convivencias`, {
        params: { studentId: selectedStudentId },
      });
      return res.data;
    },
    enabled: !!selectedStudentId,
  });

  const sorted = [...(records ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Convivencia</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registros de convivencia escolar de tus hijos
        </p>
      </div>

      {(!children || children.length === 0) ? (
        <p className="text-sm text-muted-foreground">
          No hay alumnos vinculados a tu cuenta
        </p>
      ) : (
        <>
          <GuardianStudentSelector
            value={selectedStudentId}
            onValueChange={setSelectedStudentId}
            placeholder="Seleccionar hijo..."
          />

          {!selectedStudentId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <AlertCircle className="h-4 w-4" />
              Seleccioná un alumno para ver sus registros
            </div>
          )}

          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-sm text-destructive">
              Error al cargar los registros de convivencia
            </p>
          )}

          {!isLoading && !isError && selectedStudentId && sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay registros de convivencia
            </p>
          )}

          {!isLoading && !isError && sorted.length > 0 && (
            <div className="space-y-3">
              {sorted.map((r) => {
                const cfg = typeConfig[r.type] ?? {
                  label: r.type,
                  color: 'bg-gray-50 text-gray-700 border-gray-300',
                  icon: AlertCircle,
                };
                const Icon = cfg.icon;
                return (
                  <Card key={r.id}>
                    <CardContent className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-md border ${cfg.color} shrink-0 mt-0.5`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cfg.color}>
                              {cfg.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {r.date.split('-').reverse().join('/')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {r.course?.name}
                            </span>
                          </div>
                          <p className="text-sm mt-1.5 whitespace-pre-wrap">
                            {r.reason}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Registrado por {r.author.firstName} {r.author.lastName}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
