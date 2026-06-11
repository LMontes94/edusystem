'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useDeleteEducationLevel } from '@/lib/api/education-levels';
import { EducationLevel } from './academic-structure.types';
import { EducationLevelDialog } from './education-level-dialog';

interface Props {
  levels: EducationLevel[];
  isLoading: boolean;
}

export function EducationLevelsTable({ levels, isLoading }: Props) {
  const deleteLevel = useDeleteEducationLevel();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EducationLevel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleEdit(level: EducationLevel) {
    setEditing(level);
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditing(null);
  }

  function statusLabel(status: string) {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'INACTIVE':
        return 'Inactivo';
      default:
        return status;
    }
  }

  function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
    switch (status) {
      case 'ACTIVE':
        return 'default';
      case 'INACTIVE':
        return 'secondary';
      default:
        return 'outline';
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Niveles Educativos</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Nivel
        </Button>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  Cargando...
                </TableCell>
              </TableRow>
            ) : levels.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  No hay niveles educativos registrados
                </TableCell>
              </TableRow>
            ) : (
              levels.map((level) => (
                <TableRow key={level.id}>
                  <TableCell className="font-medium">{level.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {level.slug}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(level.status)}>
                      {statusLabel(level.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => handleEdit(level)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(level.id)}
                        disabled={deleteLevel.isPending}
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

      <EducationLevelDialog
        open={dialogOpen}
        onClose={handleClose}
        level={editing}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desea eliminar este nivel educativo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si el nivel tiene grados, cursos u
              otros datos asociados no podrá eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  deleteLevel.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
