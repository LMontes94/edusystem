'use client';

import { useState }    from 'react';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button }      from '@/components/ui/button';
import { Input }       from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreatePeriod, useSchoolYears } from '@/lib/api/courses';
import { createPeriodSchema, CreatePeriodForm } from './courses.types';

export function CreatePeriodDialog() {
  const [open,               setOpen]               = useState(false);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');

  const createPeriod          = useCreatePeriod();
  const { data: schoolYears } = useSchoolYears();

  const form = useForm<CreatePeriodForm>({
    resolver: zodResolver(createPeriodSchema),
    defaultValues: { type: 'TRIMESTRE', order: 1 },
  });

  async function onSubmit(data: CreatePeriodForm) {
    await createPeriod.mutateAsync(data);
    setOpen(false);
    form.reset();
    setSelectedSchoolYear('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Período</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo período</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField control={form.control} name="schoolYearId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Año lectivo</FormLabel>
                  <Select
                    onValueChange={(v) => { field.onChange(v); setSelectedSchoolYear(v); }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccioná un año..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schoolYears?.map((sy) => (
                        <SelectItem key={sy.id} value={sy.id}>{sy.year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl><Input placeholder="Primer Trimestre" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TRIMESTRE">Trimestre</SelectItem>
                      <SelectItem value="BIMESTRE">Bimestre</SelectItem>
                      <SelectItem value="CUATRIMESTRE">Cuatrimestre</SelectItem>
                      <SelectItem value="SEMESTRE">Semestre</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Orden</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inicio</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fin</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createPeriod.isPending}>
                {createPeriod.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}