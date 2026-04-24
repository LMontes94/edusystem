'use client';

import { useState }    from 'react';
import { useSession }  from 'next-auth/react';
import { Input }       from '@/components/ui/input';
import { Badge }       from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search } from 'lucide-react';
import { useUsers } from '@/lib/api/users';
import { LEVELS, LEVEL_ROLES } from '@/lib/api/user-level-roles';
import { LevelRolesBadges }  from '@/components/users/level-roles-manager';
import { CreateUserDialog }  from './_components/create-user-dialog';
import { UserRowActions }    from './_components/user-row-actions';
import { UserStatusBadge }   from './_components/user-status-badge';
import { roleLabels, roleVariant } from './_components/users.types';

export default function UsersPage() {
  const { data: session } = useSession();
  const currentRole       = (session?.user as any)?.role ?? '';

  const [search,        setSearch]        = useState('');
  const [filterRole,    setFilterRole]    = useState('all');
  const [filterLevel,   setFilterLevel]   = useState('all');
  const [filterLvlRole, setFilterLvlRole] = useState('all');

  const { data: users, isLoading } = useUsers({
    level: filterLevel   !== 'all' ? filterLevel   : undefined,
    role:  filterLvlRole !== 'all' ? filterLvlRole : undefined,
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
            {roleCounts?.PRECEPTOR ?? 0} preceptores
          </p>
        </div>
        <CreateUserDialog />
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
          <SelectTrigger className="w-44"><SelectValue placeholder="Rol principal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            {Object.entries(roleLabels).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={(v) => { setFilterLevel(v); setFilterLvlRole('all'); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Nivel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los niveles</SelectItem>
            {LEVELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLvlRole} onValueChange={setFilterLvlRole} disabled={filterLevel === 'all'}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Rol en nivel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            {LEVEL_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol principal</TableHead>
              <TableHead>Niveles</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último acceso</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell>
              </TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron usuarios</TableCell>
              </TableRow>
            ) : (
              filtered?.map((user) => {
                const initials  = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
                const isOnLeave = user.status === 'ON_LEAVE';
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
                          <p className="font-medium text-sm">{user.firstName} {user.lastName}</p>
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
                      <LevelRolesBadges levelRoles={(user as any).levelRoles ?? []} />
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge status={user.status} leaveStartDate={(user as any).leaveStartDate} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString('es-AR')
                        : 'Nunca'}
                    </TableCell>
                    <TableCell>
                      <UserRowActions user={user as any} currentRole={currentRole} />
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