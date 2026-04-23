'use client';

import { useEffect }   from 'react';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button }      from '@/components/ui/button';
import { Input }       from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreateSubject, useUpdateSubject } from '@/lib/api/subjects';
import { Subject, SubjectForm, subjectSchema, DEFAULT_COLOR } from './subjects.types';

interface Props {
  open:      boolean;
  onClose:   () => void;
  subject?:  Subject | null; // si viene → modo edición
}

export function SubjectDialog({ open, onClose, subject }: Props) {
  const isEditing    = !!subject;
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();

  const form = useForm<SubjectForm>({
    resolver:      zodResolver(subjectSchema),
    defaultValues: { name: '', code: '', description: '', color: DEFAULT_COLOR },
  });

  // Cuando cambia el subject (abrir en edición) sincronizar el form
  useEffect(() => {
    if (subject) {
      form.reset({
        name:        subject.name,
        code:        subject.code,
        description: subject.description ?? '',
        color:       subject.color ?? DEFAULT_COLOR,
      });
    } else {
      form.reset({ name: '', code: '', description: '', color: DEFAULT_COLOR });
    }
  }, [subject, form]);

  async function onSubmit(data: SubjectForm) {
    if (isEditing) {
      await updateSubject.mutateAsync({ id: subject.id, data });
    } else {
      await createSubject.mutateAsync(data);
    }
    onClose();
  }

  const isSaving = createSubject.isPending || updateSubject.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar materia' : 'Nueva materia'}</DialogTitle>
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
                      <Input placeholder="#3B82F6" {...field} className="font-mono" />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear materia'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}