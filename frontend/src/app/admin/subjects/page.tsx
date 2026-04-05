'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

interface Subject {
  id:          string;
  name:        string;
  code:        string;
  description: string | null;
  color:       string | null;
  createdAt:   string;
}

const subjectSchema = z.object({
  name:        z.string().min(1, 'Requerido'),
  code:        z.string().min(1, 'Requerido').max(10, 'Máximo 10 caracteres'),
  description: z.string().optional(),
  color:       z.string().optional(),
});
type SubjectForm = z.infer<typeof subjectSchema>;

export default function SubjectsPage() {
  const queryClient                       = useQueryClient();
  const [search,      setSearch]          = useState('');
  const [dialog,      setDialog]          = useState(false);
  const [editingId,   setEditingId]       = useState<string | null>(null);

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn:  async () => {
      const res = await api.get<Subject[]>('/subjects');
      return res.data;
    },
  });

  const form = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: '', code: '', description: '', color: '#3B82F6' },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SubjectForm) => {
      const res = await api.post<Subject>('/subjects', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Materia creada exitosamente');
      handleClose();
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        toast.error('Ya existe una materia con ese código');
      } else {
        toast.error('Error al crear la materia');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SubjectForm }) => {
      const res = await api.patch<Subject>(`/subjects/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Materia actualizada');
      handleClose();
    },
    onError: () => toast.error('Error al actualizar la materia'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/subjects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Materia eliminada');
    },
    onError: () => toast.error('No se puede eliminar — la materia tiene datos asociados'),
  });

  function handleEdit(subject: Subject) {
    setEditingId(subject.id);
    form.reset({
      name:        subject.name,
      code:        subject.code,
      description: subject.description ?? '',
      color:       subject.color ?? '#3B82F6',
    });
    setDialog(true);
  }

  function handleClose() {
    setDialog(false);
    setEditingId(null);
    form.reset({ name: '', code: '', description: '', color: '#3B82F6' });
  }

  async function onSubmit(data: SubjectForm) {
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  }

  const filtered = subjects?.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Materias</h1>
          <p className="text-sm text-muted-foreground">
            {subjects?.length ?? 0} materias registradas
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva materia
        </Button>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o código..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Materia</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No se encontraron materias
                </TableCell>
              </TableRow>
            ) : (
              filtered?.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{subject.code}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {subject.description ?? '—'}
                  </TableCell>
                  <TableCell>
                    {subject.color ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-5 w-5 rounded-full border"
                          style={{ background: subject.color }}
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {subject.color}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => handleEdit(subject)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(subject.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={dialog} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar materia' : 'Nueva materia'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Matemáticas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: MAT" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Descripción breve..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="h-9 w-12 rounded border cursor-pointer"
                      />
                      <FormControl>
                        <Input
                          placeholder="#3B82F6"
                          {...field}
                          className="font-mono"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear materia'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}