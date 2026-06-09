'use client';

import { useState }    from 'react';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button }      from '@/components/ui/button';
import { Input }       from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus }        from 'lucide-react';
import { useCreateCourse }  from '@/lib/api/courses';
import { useSchoolYears }   from '@/lib/api/courses';
import { useEducationLevels } from '@/lib/api/user-level-roles';
import { createCourseSchema, CreateCourseForm } from './courses.types';

export function CreateCourseDialog() {
  const [open, setOpen] = useState(false);
  const [selectedEducationLevelId, setSelectedEducationLevelId] = useState('');

  const createCourse          = useCreateCourse();
  const { data: schoolYears } = useSchoolYears();
  const { data: educationLevels = [] } = useEducationLevels();

  const selectedEducLevel = selectedEducationLevelId
    ? (educationLevels as any[]).find((el: any) => el.id === selectedEducationLevelId)
    : null;
  const levelGrades = (selectedEducLevel?.levelGrades ?? []) as any[];
  const sortedLevelGrades = [...levelGrades].sort(
    (a: any, b: any) => a.displayOrder - b.displayOrder,
  );

  const form = useForm<CreateCourseForm>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: { name: '', division: 'A', levelGradeId: undefined as any },
  });

  async function onSubmit(data: CreateCourseForm) {
    await createCourse.mutateAsync(data);
    setOpen(false);
    form.reset();
    setSelectedEducationLevelId('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo curso
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo curso</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField control={form.control} name="schoolYearId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Año lectivo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccioná un año..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schoolYears?.map((sy) => (
                        <SelectItem key={sy.id} value={sy.id}>
                          {sy.year} {sy.isActive && '(activo)'}
                        </SelectItem>
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
                  <FormControl><Input placeholder="3ro A" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="division"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>División</FormLabel>
                  <FormControl><Input placeholder="A" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Nivel</FormLabel>
                <Select
                  onValueChange={(v) => {
                    setSelectedEducationLevelId(v);
                    form.resetField('levelGradeId');
                  }}
                  value={selectedEducationLevelId}
                >
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Seleccioná un nivel..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(educationLevels as any[]).map((el: any) => (
                      <SelectItem key={el.id} value={el.id}>
                        {el.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>

              <FormField control={form.control} name="levelGradeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedEducationLevelId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccioná un grado..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortedLevelGrades.map((lg: any) => (
                          <SelectItem key={lg.id} value={lg.id}>
                            {lg.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createCourse.isPending}>
                {createCourse.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
