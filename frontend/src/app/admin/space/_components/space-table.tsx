'use client';

import { useState }         from 'react';
import { Badge }            from '@/components/ui/badge';
import { Button }           from '@/components/ui/button';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
}                           from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
}                           from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
}                           from '@/components/ui/alert-dialog';
import {
  MoreHorizontalIcon, PencilIcon, TrashIcon,
  ToggleLeftIcon, ToggleRightIcon, UsersIcon,
}                           from 'lucide-react';
import { useSpaces, useDeleteSpace, useToggleSpaceAvailability } from '@/lib/api/spaces';
import { SpaceDialog }      from './space-dialog';
import { Space }            from './space.types';

export function SpacesTable() {
  const { data: spaces, isLoading } = useSpaces();

  const deleteSpace  = useDeleteSpace();
  const toggleSpace  = useToggleSpaceAvailability();

  const [editSpace,   setEditSpace]   = useState<Space | null>(null);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12">
        Cargando espacios...
      </div>
    );
  }

  if (!spaces?.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12">
        No hay espacios registrados. Creá el primero.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-center">
                <UsersIcon className="h-4 w-4 inline mr-1" />
                Capacidad
              </TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {spaces.map(space => (
              <TableRow key={space.id}>
                <TableCell>
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-black/10"
                    style={{ backgroundColor: space.color }}
                    title={space.color}
                  />
                </TableCell>
                <TableCell className="font-medium">{space.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {space.description ?? '—'}
                </TableCell>
                <TableCell className="text-center">{space.capacity}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={space.isAvailable ? 'default' : 'secondary'}>
                    {space.isAvailable ? 'Disponible' : 'No disponible'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditSpace(space)}>
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleSpace.mutate(space.id)}>
                        {space.isAvailable
                          ? <><ToggleLeftIcon  className="h-4 w-4 mr-2" />Deshabilitar</>
                          : <><ToggleRightIcon className="h-4 w-4 mr-2" />Habilitar</>
                        }
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(space.id)}
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

      {/* Edit dialog */}
      {editSpace && (
        <SpaceDialog
          space={editSpace}
          open={!!editSpace}
          onOpenChange={open => { if (!open) setEditSpace(null); }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar espacio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si el espacio tiene reservas activas no podrá eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteSpace.mutate(deleteId); setDeleteId(null); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}