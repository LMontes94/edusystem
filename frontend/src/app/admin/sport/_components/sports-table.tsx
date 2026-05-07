'use client';

import { useState } from 'react';
import { Badge }    from '@/components/ui/badge';
import { Button }   from '@/components/ui/button';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
}                   from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
}                   from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
}                   from '@/components/ui/alert-dialog';
import { MoreHorizontalIcon, PencilIcon, TrashIcon } from 'lucide-react';
import { useSports, useDeleteSport, Sport } from '@/lib/api/sports';
import { SportDialog } from './sport-dialog';

export function SportsTable() {
  const { data: sports, isLoading } = useSports();
  const deleteSport = useDeleteSport();
  const [editSport, setEditSport]   = useState<Sport | null>(null);
  const [deleteId,  setDeleteId]    = useState<string | null>(null);

  if (isLoading) return (
    <p className="text-sm text-muted-foreground text-center py-12">Cargando deportes...</p>
  );

  if (!sports?.length) return (
    <p className="text-sm text-muted-foreground text-center py-12">
      No hay deportes registrados. Creá el primero.
    </p>
  );

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-center">Grupos activos</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sports.map(sport => (
              <TableRow key={sport.id}>
                <TableCell className="font-medium">{sport.name}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{sport._count.groups}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditSport(sport)}>
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(sport.id)}
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

      {editSport && (
        <SportDialog
          sport={editSport}
          open={!!editSport}
          onOpenChange={open => { if (!open) setEditSport(null); }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar deporte?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede eliminar si no tiene grupos activos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteSport.mutate(deleteId); setDeleteId(null); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}