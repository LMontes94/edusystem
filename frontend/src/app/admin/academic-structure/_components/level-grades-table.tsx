'use client';

import { useState } from 'react';
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
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  useDeleteLevelGrade,
  useReorderLevelGrades,
} from '@/lib/api/level-grades';
import { EducationLevel, LevelGrade } from './academic-structure.types';
import { LevelGradeDialog } from './level-grade-dialog';

interface Props {
  grades: LevelGrade[];
  levels: EducationLevel[];
  isLoading: boolean;
}

export function LevelGradesTable({ grades, levels, isLoading }: Props) {
  const deleteGrade = useDeleteLevelGrade();
  const reorderGrades = useReorderLevelGrades();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LevelGrade | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleEdit(grade: LevelGrade) {
    setEditing(grade);
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditing(null);
  }

  function getSiblings(current: LevelGrade) {
    return grades
      .filter((g) => g.educationLevelId === current.educationLevelId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  function handleMoveUp(grade: LevelGrade) {
    const siblings = getSiblings(grade);
    const idx = siblings.findIndex((g) => g.id === grade.id);
    if (idx <= 0) return;
    const target = siblings[idx - 1];
    reorderGrades.mutate({
      fromGrade: {
        id: grade.id,
        educationLevelId: grade.educationLevelId,
        displayOrder: grade.displayOrder,
      },
      toGrade: {
        id: target.id,
        educationLevelId: target.educationLevelId,
        displayOrder: target.displayOrder,
      },
    });
  }

  function handleMoveDown(grade: LevelGrade) {
    const siblings = getSiblings(grade);
    const idx = siblings.findIndex((g) => g.id === grade.id);
    if (idx < 0 || idx >= siblings.length - 1) return;
    const target = siblings[idx + 1];
    reorderGrades.mutate({
      fromGrade: {
        id: grade.id,
        educationLevelId: grade.educationLevelId,
        displayOrder: grade.displayOrder,
      },
      toGrade: {
        id: target.id,
        educationLevelId: target.educationLevelId,
        displayOrder: target.displayOrder,
      },
    });
  }

  function getLevelName(educationLevelId: string) {
    return levels.find((l) => l.id === educationLevelId)?.name ?? '—';
  }

  const sortedGrades = [...grades].sort(
    (a, b) =>
      a.displayOrder - b.displayOrder ||
      a.name.localeCompare(b.name),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Grados</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Grado
        </Button>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Orden</TableHead>
              <TableHead>Nivel Educativo</TableHead>
              <TableHead className="w-36" />
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
            ) : sortedGrades.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  No hay grados registrados
                </TableCell>
              </TableRow>
            ) : (
              sortedGrades.map((grade) => {
                const siblings = getSiblings(grade);
                const idx = siblings.findIndex((g) => g.id === grade.id);
                const isFirst = idx <= 0;
                const isLast = idx >= siblings.length - 1;

                return (
                  <TableRow key={grade.id}>
                    <TableCell className="font-medium">{grade.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {grade.displayOrder}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {getLevelName(grade.educationLevelId)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => handleMoveUp(grade)}
                          disabled={isFirst || reorderGrades.isPending}
                          title="Subir"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => handleMoveDown(grade)}
                          disabled={isLast || reorderGrades.isPending}
                          title="Bajar"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => handleEdit(grade)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(grade.id)}
                          disabled={deleteGrade.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <LevelGradeDialog
        open={dialogOpen}
        onClose={handleClose}
        grade={editing}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desea eliminar este grado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si el grado tiene cursos,
              indicadores u otros datos asociados no podrá eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  const grade = grades.find((g) => g.id === deleteId);
                  if (grade) {
                    deleteGrade.mutate({
                      educationLevelId: grade.educationLevelId,
                      id: deleteId,
                    });
                  }
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
