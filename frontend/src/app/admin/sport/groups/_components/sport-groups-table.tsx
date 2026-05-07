'use client';

import { useState }    from 'react';
import Link            from 'next/link';
import { Badge }       from '@/components/ui/badge';
import { Button }      from '@/components/ui/button';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
}                      from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
}                      from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
}                      from '@/components/ui/alert-dialog';
import {
  MoreHorizontalIcon, PencilIcon, TrashIcon,
  UsersIcon, ChevronRightIcon,
}                      from 'lucide-react';
import { useSportGroups, useDeleteSportGroup, SportGroup } from '@/lib/api/sports';
import { SportGroupDialog } from './sport-group-dialog';

interface Props {
  sportId?:      string;
  schoolYearId?: string;
}

export function SportGroupsTable({ sportId, schoolYearId }: Props) {
  const { data: groups, isLoading } = useSportGroups({ sportId, schoolYearId });
  const deleteGroup = useDeleteSportGroup();
  const [editGroup, setEditGroup] = useState<SportGroup | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);

  if (isLoading) return (
    <p className="text-sm text-muted-foreground text-center py-12">Cargando grupos...</p>
  );

  if (!groups?.length) return (
    <p className="text-sm text-muted-foreground text-center py-12">
      No hay grupos registrados. Creá el primero.
    </p>
  );

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>Deporte</TableHead>
              <TableHead>Docentes</TableHead>
              <TableHead className="text-center">
                <UsersIcon className="h-4 w-4 inline mr-1" />
                Alumnos
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(group => (
              <TableRow key={group.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link
                    href={`/admin/sport/groups/${group.id}`}
                    className="flex items-center gap-1 font-medium hover:underline"
                  >
                    {group.name}
                    <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{group.sport.name}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {group.teachers.map(t =>
                    `${t.user.firstName} ${t.user.lastName}`
                  ).join(', ')}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{group._count.students}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditGroup(group)}>
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(group.id)}
                      >
                        <TrashIcon className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editGroup && (
        <SportGroupDialog
          group={editGroup}
          open={!!editGroup}
          onOpenChange={open => { if (!open) setEditGroup(null); }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también los docentes y alumnos asignados al grupo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteGroup.mutate(deleteId); setDeleteId(null); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}