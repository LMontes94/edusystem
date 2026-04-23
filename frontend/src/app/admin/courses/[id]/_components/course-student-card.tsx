'use client';

import Link          from 'next/link';
import { Badge }     from '@/components/ui/badge';
import { Button }    from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Users, Download } from 'lucide-react';
import { useExportCourseStudents } from '@/lib/api/courses';

interface CourseStudent {
  status:  string;
  student: { id: string; firstName: string; lastName: string; documentNumber: string };
}

interface Props {
  courseId:   string;
  courseName: string;
  students:   CourseStudent[];
}

export function CourseStudentsCard({ courseId, courseName, students }: Props) {
  const exportStudents = useExportCourseStudents();
  const active         = students.filter((cs) => cs.status === 'ACTIVE');

  function handleExport() {
    exportStudents.mutate({
      courseId,
      courseName,
      students: active.map((cs) => ({
        firstName:      cs.student.firstName,
        lastName:       cs.student.lastName,
        documentNumber: cs.student.documentNumber,
        status:         cs.status,
      })),
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Alumnos ({active.length})
          </CardTitle>
          {active.length > 0 && (
            <Button
              size="sm" variant="outline"
              onClick={handleExport}
              disabled={exportStudents.isPending}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar Excel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 py-4">Sin alumnos matriculados</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((cs) => (
                <TableRow key={cs.student.id}>
                  <TableCell>
                    <Link
                      href={`/admin/students/${cs.student.id}`}
                      className="font-medium hover:underline"
                    >
                      {cs.student.lastName}, {cs.student.firstName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {cs.student.documentNumber}
                  </TableCell>
                  <TableCell>
                    <Badge variant={cs.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {cs.status === 'ACTIVE' ? 'Activo' : cs.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}