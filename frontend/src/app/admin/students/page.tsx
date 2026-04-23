'use client';

import { useState } from 'react';
import Link         from 'next/link';
import { Input }    from '@/components/ui/input';
import { Badge }    from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, ChevronRight } from 'lucide-react';
import { useStudents } from '@/lib/api/students';
import { CreateStudentDialog } from './_components/create-student-dialog';

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  const { data: students, isLoading } = useStudents();

  const filtered = students?.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q)  ||
      s.documentNumber.includes(q)
    );
  });

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
        <CreateStudentDialog />
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
                        <span className="text-sm">{activeCourse.course.name}</span>
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