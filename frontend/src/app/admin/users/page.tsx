'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUsers, useCreateUser, useToggleUserStatus, useResetPassword } from '@/lib/api/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Search, MoreHorizontal, KeyRound, UserX, UserCheck,
  BriefcaseMedical, RotateCcw,
} from 'lucide-react';
import { useGrantLeave, useRevokeLeave } from '@/lib/api/users-leave';

// ── Schemas ───────────────────────────────────
const createUserSchema = z.object({
  firstName: z.string().min(1, 'Requerido'),
  lastName:  z.string().min(1, 'Requerido'),
  email:     z.string().email('Email inválido'),
  password:  z.string().min(8, 'Mínimo 8 caracteres'),
  role:      z.enum(['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER', 'PRECEPTOR', 'GUARDIAN']),
  phone:     z.string().optional(),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm:  z.string().min(8, 'Requerido'),
}).refine((d) => d.password === d.confirm, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm'],
});
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

// ── Constantes ────────────────────────────────
const roleLabels: Record<string, string> = {
  ADMIN:     'Administrador',
  DIRECTOR:  'Director',
  SECRETARY: 'Secretaria',
  TEACHER:   'Docente',
  PRECEPTOR: 'Preceptor',
  GUARDIAN:  'Tutor',
};

const roleVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  ADMIN:     'default',
  DIRECTOR:  'default',
  SECRETARY: 'secondary',
  TEACHER:   'secondary',
  PRECEPTOR: 'secondary',
  GUARDIAN:  'outline',
};

const LEAVE_ALLOWED_ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARY'];

// ── Badge de estado ───────────────────────────
function StatusBadge({ status, leaveStartDate }: { status: string; leaveStartDate?: string | null }) {
  
  if (status === 'ON_LEAVE') {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          En licencia
        </span>
        {leaveStartDate && (
          <span className="text-xs text-muted-foreground">
            desde {leaveStartDate.split('T')[0].split('-').reverse().join('/')}
          </span>
        )}
      </div>
    );
  }
  return (
    <Badge variant={status === 'ACTIVE' ? 'default' : 'secondary'}>
      {status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
    </Badge>
  );
}

// ── Componente principal ──────────────────────
export default function UsersPage() {
  const { data: session }                         = useSession();
  const currentRole                               = (session?.user as any)?.role ?? '';
  const canManageLeave                            = LEAVE_ALLOWED_ROLES.includes(currentRole);

  const [search,         setSearch]         = useState('');
  const [filterRole,     setFilterRole]     = useState('all');
  const [createDialog,   setCreateDialog]   = useState(false);
  const [resetDialog,    setResetDialog]    = useState(false);
  const [leaveDialog,    setLeaveDialog]    = useState(false);
  const [selectedUser,   setSelectedUser]   = useState<{ id: string; name: string } | null>(null);
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: users, isLoading } = useUsers();
  const createUser       = useCreateUser();
  const toggleUserStatus = useToggleUserStatus();
  const resetPassword    = useResetPassword();
  const grantLeave       = useGrantLeave();
  const revokeLeave      = useRevokeLeave();

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'TEACHER', firstName: '', lastName: '', email: '', password: '', phone: '' },
  });

  const resetForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const filtered = users?.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q)  ||
      u.email.toLowerCase().includes(q);
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });
  
  async function onCreateUser(data: CreateUserForm) {
    await createUser.mutateAsync(data);
    setCreateDialog(false);
    createForm.reset();
  }

  async function onResetPassword(data: ResetPasswordForm) {
    await resetPassword.mutateAsync({ id: selectedUser!.id, password: data.password });
    setResetDialog(false);
    resetForm.reset();
  }

  function openResetDialog(userId: string, name: string) {
    setSelectedUser({ id: userId, name });
    setResetDialog(true);
  }

  function openLeaveDialog(userId: string, name: string) {
    setSelectedUser({ id: userId, name });
    setLeaveStartDate(new Date().toISOString().split('T')[0]);
    setLeaveDialog(true);
  }

  async function handleGrantLeave() {
    if (!selectedUser) return;
    await grantLeave.mutateAsync({ userId: selectedUser.id, startDate: leaveStartDate });
    setLeaveDialog(false);
  }

  async function handleRevokeLeave(userId: string) {
    await revokeLeave.mutateAsync(userId);
  }

  const roleCounts = users?.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            {users?.length ?? 0} usuarios ·{' '}
            {roleCounts?.TEACHER ?? 0} docentes ·{' '}
            {roleCounts?.GUARDIAN ?? 0} tutores
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filtrar por rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="ADMIN">Administradores</SelectItem>
            <SelectItem value="DIRECTOR">Directores</SelectItem>
            <SelectItem value="SECRETARY">Secretarias</SelectItem>
            <SelectItem value="TEACHER">Docentes</SelectItem>
            <SelectItem value="PRECEPTOR">Preceptores</SelectItem>
            <SelectItem value="GUARDIAN">Tutores</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último acceso</TableHead>
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
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            ) : (
              filtered?.map((user) => {
                const initials  = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
                const isOnLeave = user.status === 'ON_LEAVE';
                const isInactive = user.status === 'INACTIVE';
                return (
                  <TableRow key={user.id} className={isOnLeave ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={`text-xs ${isOnLeave ? 'bg-amber-100 text-amber-700' : ''}`}>
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariant[user.role] ?? 'outline'}>
                        {roleLabels[user.role] ?? user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={user.status} leaveStartDate={(user as any).leaveStartDate} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString('es-AR')
                        : 'Nunca'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">

                          {/* Cambiar contraseña */}
                          <DropdownMenuItem onClick={() => openResetDialog(user.id, `${user.firstName} ${user.lastName}`)}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Cambiar contraseña
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Activar / Desactivar — solo si no está en licencia */}
                          {!isOnLeave && (
                            user.status === 'ACTIVE' ? (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => toggleUserStatus.mutate({ id: user.id, status: 'INACTIVE' })}
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Desactivar usuario
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => toggleUserStatus.mutate({ id: user.id, status: 'ACTIVE' })}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Activar usuario
                              </DropdownMenuItem>
                            )
                          )}

                          {/* Licencia — solo roles habilitados y usuarios activos o en licencia */}
                          {canManageLeave && !isInactive && (
                            <>
                              {!isOnLeave && <DropdownMenuSeparator />}
                              {isOnLeave ? (
                                <DropdownMenuItem
                                  className="text-emerald-600 focus:text-emerald-600"
                                  onClick={() => handleRevokeLeave(user.id)}
                                  disabled={revokeLeave.isPending}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Revocar licencia
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-amber-600 focus:text-amber-600"
                                  onClick={() => openLeaveDialog(user.id, `${user.firstName} ${user.lastName}`)}
                                >
                                  <BriefcaseMedical className="mr-2 h-4 w-4" />
                                  Otorgar licencia
                                </DropdownMenuItem>
                              )}
                            </>
                          )}

                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog crear usuario */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateUser)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={createForm.control} name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={createForm.control} name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField control={createForm.control} name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={createForm.control} name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={createForm.control} name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ADMIN">Administrador</SelectItem>
                        <SelectItem value="DIRECTOR">Director</SelectItem>
                        <SelectItem value="SECRETARY">Secretaria</SelectItem>
                        <SelectItem value="TEACHER">Docente</SelectItem>
                        <SelectItem value="PRECEPTOR">Preceptor</SelectItem>
                        <SelectItem value="GUARDIAN">Tutor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={createForm.control} name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono (opcional)</FormLabel>
                    <FormControl><Input placeholder="+54 11 1234-5678" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setCreateDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createUser.isPending}>
                  {createUser.isPending ? 'Guardando...' : 'Crear usuario'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog reset password */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
              <FormField control={resetForm.control} name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva contraseña</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={resetForm.control} name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar contraseña</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setResetDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={resetPassword.isPending}>
                  {resetPassword.isPending ? 'Guardando...' : 'Actualizar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog otorgar licencia */}
      <Dialog open={leaveDialog} onOpenChange={setLeaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Otorgar licencia</DialogTitle>
            <DialogDescription>
              {selectedUser?.name} quedará en licencia y no podrá realizar cambios
              hasta que se revoque.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fecha de inicio</label>
              <Input
                type="date"
                value={leaveStartDate}
                onChange={(e) => setLeaveStartDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLeaveDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleGrantLeave}
                disabled={!leaveStartDate || grantLeave.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {grantLeave.isPending ? 'Guardando...' : 'Confirmar licencia'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}