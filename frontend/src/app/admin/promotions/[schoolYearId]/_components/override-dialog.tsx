'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePromotionResults, useCreatePromotionOverride } from '@/lib/api/promotion';
import { useSchoolYears } from '@/lib/api/courses';
import { createOverrideSchema } from './promotion-detail.types';
import type { CreateOverrideForm } from './promotion-detail.types';

interface Props {
  schoolYearId: string;
  schoolYear: { year: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OverrideDialog({ schoolYearId, schoolYear, open, onOpenChange }: Props) {
  const { data: results } = usePromotionResults({ schoolYearId });
  const { data: schoolYears } = useSchoolYears();
  const createOverride = useCreatePromotionOverride();

  const form = useForm<CreateOverrideForm>({
    resolver: zodResolver(createOverrideSchema),
    defaultValues: {
      studentId: '',
      result: 'PROMOTED',
      toSchoolYearId: '',
      reason: '',
    },
  });

  const selectedResult = form.watch('result');

  async function onSubmit(data: CreateOverrideForm) {
    await createOverride.mutateAsync({
      studentId: data.studentId,
      fromSchoolYearId: schoolYearId,
      result: data.result,
      reason: data.result === 'PROMOTED' && data.toSchoolYearId
        ? `${data.reason} (promovido a ${data.toSchoolYearId})`
        : data.reason,
      ...(data.result === 'PROMOTED' && data.toSchoolYearId
        ? { toSchoolYearId: data.toSchoolYearId }
        : {}),
    });
    onOpenChange(false);
    form.reset();
  }

  function handleOpenChange(o: boolean) {
    onOpenChange(o);
    if (!o) {
      form.reset();
    }
  }

  const studentOptions = (results ?? []).map((r) => ({
    value: r.studentId,
    label: r.studentFullName,
  }));

  const schoolYearOptions = (schoolYears ?? [])
    .filter((sy) => sy.id !== schoolYearId)
    .map((sy) => ({ value: sy.id, label: String(sy.year) }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resultado manual — {schoolYear.year}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estudiante</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estudiante" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {studentOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="result"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resultado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PROMOTED">Promovido</SelectItem>
                      <SelectItem value="RETAINED">Retenido</SelectItem>
                      <SelectItem value="GRADUATED">Graduado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedResult === 'PROMOTED' && (
              <FormField
                control={form.control}
                name="toSchoolYearId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Promovido a</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar ciclo lectivo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {schoolYearOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describí la justificación (mín. 10 caracteres)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createOverride.isPending}>
                {createOverride.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
