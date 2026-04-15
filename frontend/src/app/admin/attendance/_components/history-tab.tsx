'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAttendance } from '@/lib/api/attendance';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FileCheck } from 'lucide-react';
import { statusConfig, formatDate } from './attendance.types';

interface Props {
  selectedCourse: string;
  selectedDate:   string;
}

export function HistoryTab({ selectedCourse, selectedDate }: Props) {
  const queryClient = useQueryClient();

  const [justifyDialog, setJustifyDialog] = useState(false);
  const [justifyId,     setJustifyId]     = useState('');
  const [justifyReason, setJustifyReason] = useState('');

  const { data: history } = useAttendance({
    courseId: selectedCourse || undefined,
    date:     selectedDate,
  });

  const justifyMutation = useMutation({
    mutationFn: async () => {
      await api.post('/justifications', {
        attendanceId: justifyId,
        reason:       justifyReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Inasistencia justificada');
      setJustifyDialog(false);
      setJustifyId('');
      setJustifyReason('');
    },
    onError: () => toast.error('Error al justificar'),
  });

  function openJustify(recordId: string) {
    setJustifyId(recordId);
    setJustifyDialog(true);
  }

  function closeJustify() {
    setJustifyDialog(false);
    setJustifyReason('');
  }

  return (
    <>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Registrado por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!history || history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {selectedCourse
                    ? 'No hay registros para este día'
                    : 'Seleccioná un curso para ver el historial'}
                </TableCell>
              </TableRow>
            ) : (
              history.map((record) => {
                const config = statusConfig[record.status];
                const Icon   = config.icon;
                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.student.lastName}, {record.student.firstName}
                    </TableCell>
                    <TableCell>{record.course.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(record.date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1.5 ${config.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {config.label}
                        </span>
                        {record.status === 'ABSENT' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-emerald-600"
                            title="Justificar inasistencia"
                            onClick={() => openJustify(record.id)}
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {record.recordedBy.firstName} {record.recordedBy.lastName}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog justificar */}
      <Dialog open={justifyDialog} onOpenChange={(open) => !open && closeJustify()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Justificar inasistencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Motivo de la justificación</label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
                placeholder="Ej: Certificado médico, viaje familiar..."
                value={justifyReason}
                onChange={(e) => setJustifyReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeJustify}>
                Cancelar
              </Button>
              <Button
                onClick={() => justifyMutation.mutate()}
                disabled={!justifyReason.trim() || justifyMutation.isPending}
              >
                {justifyMutation.isPending ? 'Guardando...' : 'Justificar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}