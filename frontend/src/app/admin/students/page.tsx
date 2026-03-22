'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useStudents, useCreateStudent } from '@/lib/api/students';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, ChevronRight } from 'lucide-react';
import { useCourses, useEnrollStudent } from '@/lib/api/courses';

const createStudentSchema = z.object({
  firstName:      z.string().min(1, 'Requerido'),
  lastName:       z.string().min(1, 'Requerido'),
  documentNumber: z.string().min(1, 'Requerido'),
  birthDate:      z.string().min(1, 'Requerido'),
  bloodType:      z.string().optional(),
  medicalNotes:   z.string().optional(),
  courseId:       z.string().optional(),
});

type CreateStudentForm = z.infer<typeof createStudentSchema>;

export default function StudentsPage() {
  const [search,    setSearch]    = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: students, isLoading } = useStudents();
  const createStudent = useCreateStudent();
  const { data: courses }  = useCourses();
  const enrollStudent      = useEnrollStudent();

  const form = useForm<CreateStudentForm>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: { firstName: '', lastName: '', documentNumber: '', birthDate: '' },
  });

  const filtered = students?.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.documentNumber.includes(q)
    );
  });

  async function onSubmit(data: CreateStudentForm) {
    const { courseId, ...studentData } = data;
    const student = await createStudent.mutateAsync(studentData);
  
    if (courseId && student?.id) {
      await enrollStudent.mutateAsync({ studentId: student.id, courseId });
    }
  
    setDialogOpen(false);
    form.reset();
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Alumnos</h1>
          <p className="text-sm text-muted-foreground">
            {students?.length ?? 0} alumnos registrados
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo alumno
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo alumno</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="documentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de nacimiento</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                    control={form.control}
                    name="courseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Curso (opcional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccioná un curso..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {courses?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} — {c.schoolYear?.year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
              />

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createStudent.isPending}>
                    {createStudent.isPending ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o DNI..."
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
              <TableHead>Alumno</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-8" />
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
                  No se encontraron alumnos
                </TableCell>
              </TableRow>
            ) : (
              filtered?.map((student) => {
                const activeCourse = student.courseStudents?.find(
                  (cs) => cs.status === 'ACTIVE',
                );
                return (
                  <TableRow key={student.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link href={`/admin/students/${student.id}`} className="block">
                        <p className="font-medium">
                          {student.lastName}, {student.firstName}
                        </p>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.documentNumber}
                    </TableCell>
                    <TableCell>
                      {activeCourse ? (
                        <span className="text-sm">
                          {activeCourse.course.name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin curso</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.isActive ? 'default' : 'secondary'}>
                        {student.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/students/${student.id}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
