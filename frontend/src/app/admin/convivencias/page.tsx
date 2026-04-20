'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useCourses } from '@/lib/api/courses';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Trash2, Pencil, Download, AlertTriangle,
  Star, Eye, Users, MessageSquare, Ban, Phone,
} from 'lucide-react';
import { useIsOnLeave } from '@/lib/hooks/use-is-on-leave';

interface Convivencia {
  id:           string;
  type:         string;
  date:         string;
  reason:       string;
  savedAt:      string;
  sentToParent: boolean;
  sentAt?:      string;
  readAt?:      string;
  student: { id: string; firstName: string; lastName: string; documentNumber: string };
  course:  { id: string; name: string; grade: number; division: string };
  author:  { id: string; firstName: string; lastName: string; role: string };
}

const typeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  observation:    { label: 'Observación',       color: 'bg-blue-50 text-blue-700 border-blue-300',       icon: Eye           },
  warning:        { label: 'Advertencia',        color: 'bg-amber-50 text-amber-700 border-amber-300',    icon: AlertTriangle },
  reprimand:      { label: 'Apercibimiento',     color: 'bg-orange-50 text-orange-700 border-orange-300', icon: MessageSquare },
  commendation:   { label: 'Felicitación',       color: 'bg-emerald-50 text-emerald-700 border-emerald-300', icon: Star       },
  suspension:     { label: 'Suspensión',         color: 'bg-red-50 text-red-700 border-red-300',          icon: Ban          },
  parent_meeting: { label: 'Citación de padres', color: 'bg-purple-50 text-purple-700 border-purple-300', icon: Phone        },
};

export default function ConvivenciasPage() {
  const { data: session } = useSession();
  const queryClient       = useQueryClient();
  const isOnLeave         = useIsOnLeave();

  const [selectedCourse,  setSelectedCourse]  = useState('all');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedType,    setSelectedType]    = useState('all');
  const [dialog,          setDialog]          = useState(false);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [generating,      setGenerating]      = useState<string | null>(null);

  const [formCourse,  setFormCourse]  = useState('');
  const [formStudent, setFormStudent] = useState('');
  const [formType,    setFormType]    = useState('observation');
  const [formDate,    setFormDate]    = useState(new Date().toLocaleDateString('en-CA'));
  const [formReason,  setFormReason]  = useState('');

  const { data: courses } = useCourses();

  const { data: courseDetail } = useQuery({
    queryKey: ['courses', formCourse],
    queryFn:  async () => {
      const res = await api.get(`/courses/${formCourse}`);
      return res.data;
    },
    enabled: !!formCourse,
  });

  const activeStudents = courseDetail?.courseStudents
    ?.filter((cs: any) => cs.status === 'ACTIVE')
    .sort((a: any, b: any) => a.student.lastName.localeCompare(b.student.lastName))
    ?? [];

  const { data: convivencias, isLoading } = useQuery({
    queryKey: ['convivencias', selectedCourse, selectedType],
    queryFn:  async () => {
      const params: any = {};
      if (selectedCourse !== 'all') params.courseId = selectedCourse;
      if (selectedType   !== 'all') params.type     = selectedType;
      const res = await api.get<Convivencia[]>('/convivencias', { params });
      return res.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['convivencias-stats', selectedCourse !== 'all' ? selectedCourse : undefined],
    queryFn:  async () => {
      const params: any = {};
      if (selectedCourse !== 'all') params.courseId = selectedCourse;
      const res = await api.get('/convivencias/stats', { params });
      return res.data;
    },
  });

  function toUTCDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/convivencias', {
        studentId: formStudent,
        courseId:  formCourse,
        type:      formType,
        date:      toUTCDate(formDate),
        reason:    formReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['convivencias'] });
      queryClient.invalidateQueries({ queryKey: ['convivencias-stats'] });
      toast.success('Convivencia registrada');
      handleClose();
    },
    onError: () => toast.error('Error al registrar'),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/convivencias/${editingId}`, {
        type:   formType,
        date:   toUTCDate(formDate),
        reason: formReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['convivencias'] });
      toast.success('Convivencia actualizada');
      handleClose();
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/convivencias/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['convivencias'] });
      queryClient.invalidateQueries({ queryKey: ['convivencias-stats'] });
      toast.success('Convivencia eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  function handleEdit(conv: Convivencia) {
    setEditingId(conv.id);
    setFormCourse(conv.course.id);
    setFormStudent(conv.student.id);
    setFormType(conv.type);
    setFormDate(conv.date.split('T')[0]);
    setFormReason(conv.reason);
    setDialog(true);
  }

  function handleClose() {
    setDialog(false);
    setEditingId(null);
    setFormCourse('');
    setFormStudent('');
    setFormType('observation');
    setFormDate(new Date().toLocaleDateString('en-CA'));
    setFormReason('');
  }

  async function handleGeneratePdf(studentId: string, studentName: string) {
    setGenerating(studentId);
    try {
      const res = await api.get(`/reports/convivencias/${studentId}`, { responseType: 'blob' });
      const contentDisposition = res.headers['content-disposition'];
      const filenameMatch      = contentDisposition?.match(/filename="(.+)"/);
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href     = url;
      link.download = filenameMatch?.[1] ?? `convivencias_${studentName}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF generado');
    } catch {
      toast.error('Error al generar el PDF');
    } finally {
      setGenerating(null);
    }
  }

  const byStudent = convivencias?.reduce((acc: any, conv) => {
    const key = conv.student.id;
    if (!acc[key]) acc[key] = { student: conv.student, items: [] };
    acc[key].items.push(conv);
    return acc;
  }, {}) ?? {};

  const canManage = ['ADMIN', 'DIRECTOR', 'PRECEPTOR', 'SUPER_ADMIN'].includes(
    session?.user?.role as string
  );

  // Puede gestionar solo si tiene el rol Y no está en licencia
  const canEdit = canManage && !isOnLeave;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Convivencia</h1>
          <p className="text-sm text-muted-foreground">Registro de convivencia escolar</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Registrar convivencia
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {Object.entries(typeConfig).map(([key, config]) => {
            const Icon  = config.icon;
            const count = stats.byType?.find((t: any) => t.type === key)?._count?.id ?? 0;
            return (
              <Card key={key}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md border ${config.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{config.label}</p>
                      <p className="text-lg font-semibold">{count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los cursos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los cursos</SelectItem>
            {courses?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(typeConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Lista general</TabsTrigger>
          <TabsTrigger value="byStudent">Por alumno</TabsTrigger>
        </TabsList>

        {/* ── Tab: Lista general ── */}
        <TabsContent value="list" className="mt-4">
          <div className="rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Estado</TableHead>
                  {canEdit && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : convivencias?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No hay convivencias registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  convivencias?.map((conv) => {
                    const config = typeConfig[conv.type];
                    const Icon   = config?.icon;
                    return (
                      <TableRow key={conv.id}>
                        <TableCell>
                          <p className="font-medium text-sm">
                            {conv.student.lastName}, {conv.student.firstName}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">{conv.course.name}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs border ${config?.color}`}>
                            {Icon && <Icon className="h-3 w-3 mr-1" />}
                            {config?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {conv.date.split('T')[0].split('-').reverse().join('/')}
                        </TableCell>
                        <TableCell className="text-sm max-w-48 truncate">
                          {conv.reason}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {conv.author.firstName} {conv.author.lastName}
                        </TableCell>
                        <TableCell>
                          {conv.readAt ? (
                            <Badge variant="default" className="text-xs">Leído</Badge>
                          ) : conv.sentAt ? (
                            <Badge variant="secondary" className="text-xs">Enviado</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Guardado</Badge>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon" variant="ghost"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => handleEdit(conv)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon" variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteMutation.mutate(conv.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tab: Por alumno ── */}
        <TabsContent value="byStudent" className="mt-4 space-y-4">
          {Object.values(byStudent).length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg border-dashed">
              No hay convivencias registradas
            </div>
          ) : (
            Object.values(byStudent).map((group: any) => (
              <Card key={group.student.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {group.student.lastName}, {group.student.firstName}
                      <Badge variant="secondary" className="text-xs">
                        {group.items.length} registro{group.items.length > 1 ? 's' : ''}
                      </Badge>
                    </CardTitle>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => handleGeneratePdf(
                        group.student.id,
                        `${group.student.lastName}_${group.student.firstName}`
                      )}
                      disabled={generating === group.student.id}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {generating === group.student.id ? 'Generando...' : 'PDF'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Solicitante</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((conv: Convivencia) => {
                        const config = typeConfig[conv.type];
                        const Icon   = config?.icon;
                        return (
                          <TableRow key={conv.id}>
                            <TableCell className="text-sm">
                              {new Date(conv.date).toLocaleDateString('es-AR')}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs border ${config?.color}`}>
                                {Icon && <Icon className="h-3 w-3 mr-1" />}
                                {config?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{conv.reason}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {conv.author.firstName} {conv.author.lastName}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog crear/editar — solo si puede editar */}
      {canEdit && (
        <Dialog open={dialog} onOpenChange={(open) => { if (!open) handleClose(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Editar convivencia' : 'Registrar convivencia'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {!editingId && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Curso</label>
                    <Select value={formCourse} onValueChange={(v) => { setFormCourse(v); setFormStudent(''); }}>
                      <SelectTrigger><SelectValue placeholder="Seleccioná un curso..." /></SelectTrigger>
                      <SelectContent>
                        {courses?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Alumno</label>
                    <Select value={formStudent} onValueChange={setFormStudent} disabled={!formCourse}>
                      <SelectTrigger><SelectValue placeholder="Seleccioná un alumno..." /></SelectTrigger>
                      <SelectContent>
                        {activeStudents.map((cs: any) => (
                          <SelectItem key={cs.student.id} value={cs.student.id}>
                            {cs.student.lastName}, {cs.student.firstName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tipo</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fecha</label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Motivo</label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
                  placeholder="Describí el motivo de la convivencia..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button
                  onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}
                  disabled={
                    (!editingId && (!formCourse || !formStudent)) ||
                    !formReason ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Guardando...'
                    : editingId ? 'Guardar cambios' : 'Registrar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}