'use client';

import { useState }        from 'react';
import { Input }           from '@/components/ui/input';
import { Badge }           from '@/components/ui/badge';
import { Button }          from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useSubjects, useDeleteSubject } from '@/lib/api/subjects';
import { SubjectDialog }   from './_components/subject-dialog';
import { Subject }         from './_components/subjects.types';

export default function SubjectsPage() {
  const [search,   setSearch]   = useState('');
  const [dialog,   setDialog]   = useState(false);
  const [editing,  setEditing]  = useState<Subject | null>(null);

  const { data: subjects, isLoading } = useSubjects();
  const deleteSubject = useDeleteSubject();

  const filtered = subjects?.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
  });

  function handleEdit(subject: Subject) {
    setEditing(subject);
    setDialog(true);
  }

  function handleClose() {
    setDialog(false);
    setEditing(null);
  }

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
                        onClick={() => deleteSubject.mutate(subject.id)}
                        disabled={deleteSubject.isPending}
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

      <SubjectDialog
        open={dialog}
        onClose={handleClose}
        subject={editing}
      />

    </div>
  );
}