'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  useCreateEducationLevel,
  useUpdateEducationLevel,
} from '@/lib/api/education-levels';
import {
  EducationLevel,
  EducationLevelForm,
  educationLevelSchema,
} from './academic-structure.types';

interface Props {
  open: boolean;
  onClose: () => void;
  level?: EducationLevel | null;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function EducationLevelDialog({ open, onClose, level }: Props) {
  const isEditing = !!level;
  const createLevel = useCreateEducationLevel();
  const updateLevel = useUpdateEducationLevel();

  const form = useForm<EducationLevelForm>({
    resolver: zodResolver(educationLevelSchema),
    defaultValues: { name: '', slug: '' },
  });

  useEffect(() => {
    if (level) {
      form.reset({ name: level.name, slug: level.slug });
    } else {
      form.reset({ name: '', slug: '' });
    }
  }, [level, form]);

  function handleNameChange(value: string) {
    if (!isEditing) {
      form.setValue('name', value);
      form.setValue('slug', slugify(value));
    } else {
      form.setValue('name', value);
    }
  }

  async function onSubmit(data: EducationLevelForm) {
    if (isEditing) {
      await updateLevel.mutateAsync({ id: level.id, data });
    } else {
      await createLevel.mutateAsync(data);
    }
    onClose();
  }

  const isSaving = createLevel.isPending || updateLevel.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar nivel educativo' : 'Nuevo nivel educativo'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Primaria"
                      {...field}
                      onChange={(e) => handleNameChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: primaria"
                      {...field}
                      readOnly={isEditing}
                      className={isEditing ? 'bg-muted text-muted-foreground' : ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? 'Guardando...'
                  : isEditing
                    ? 'Guardar cambios'
                    : 'Crear nivel'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
