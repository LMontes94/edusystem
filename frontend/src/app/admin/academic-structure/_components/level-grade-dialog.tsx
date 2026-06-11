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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateLevelGrade,
  useUpdateLevelGrade,
} from '@/lib/api/level-grades';
import { useEducationLevels } from '@/lib/api/education-levels';
import {
  LevelGrade,
  LevelGradeForm,
  levelGradeSchema,
} from './academic-structure.types';

interface Props {
  open: boolean;
  onClose: () => void;
  grade?: LevelGrade | null;
}

export function LevelGradeDialog({ open, onClose, grade }: Props) {
  const isEditing = !!grade;
  const createGrade = useCreateLevelGrade();
  const updateGrade = useUpdateLevelGrade();
  const { data: levels = [] } = useEducationLevels();

  const form = useForm<LevelGradeForm>({
    resolver: zodResolver(levelGradeSchema),
    defaultValues: {
      name: '',
      displayOrder: undefined,
      educationLevelId: '',
    },
  });

  useEffect(() => {
    if (grade) {
      form.reset({
        name: grade.name,
        displayOrder: grade.displayOrder,
        educationLevelId: grade.educationLevelId,
      });
    } else {
      form.reset({
        name: '',
        displayOrder: undefined,
        educationLevelId: '',
      });
    }
  }, [grade, form]);

  async function onSubmit(data: LevelGradeForm) {
    const { educationLevelId, ...rest } = data;
    if (isEditing) {
      await updateGrade.mutateAsync({
        educationLevelId: grade.educationLevelId,
        id: grade.id,
        data: rest,
      });
    } else {
      await createGrade.mutateAsync({
        educationLevelId,
        data: rest,
      });
    }
    onClose();
  }

  const isSaving = createGrade.isPending || updateGrade.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar grado' : 'Nuevo grado'}
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
                    <Input placeholder="Ej: 1ro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Orden</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Ej: 1"
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === '' ? undefined : Number(val));
                      }}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="educationLevelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nivel Educativo</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccioná un nivel..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {levels.map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {level.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    : 'Crear grado'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
