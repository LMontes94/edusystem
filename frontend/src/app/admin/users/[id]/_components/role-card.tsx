'use client';

import { useState }  from 'react';
import { Badge }     from '@/components/ui/badge';
import { Button }    from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Plus, X } from 'lucide-react';
import { useAddLevelRole, useRemoveLevelRole, LEVELS, LEVEL_ROLES } from '@/lib/api/user-level-roles';
import { roleLabels, roleVariant } from '../../_components/users.types';

const levelColors: Record<string, string> = {
  INICIAL:    'bg-purple-100 text-purple-700 border-purple-200',
  PRIMARIA:   'bg-blue-100 text-blue-700 border-blue-200',
  SECUNDARIA: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const levelRoleLabels: Record<string, string> = {
  DIRECTOR:  'Director',
  SECRETARY: 'Secretaria',
  PRECEPTOR: 'Preceptor',
  TEACHER:   'Docente',
  GUARDIAN:  'Tutor',
};

interface LevelRole {
  id:    string;
  level: string;
  role:  string;
}

interface Props {
  user: {
    id:         string;
    role:       string;
    levelRoles: LevelRole[];
  };
  canManage: boolean;
}

export function RoleCard({ user, canManage }: Props) {
  const [newLevel, setNewLevel] = useState('');
  const [newRole,  setNewRole]  = useState('');

  const addLevelRole    = useAddLevelRole(user.id);
  const removeLevelRole = useRemoveLevelRole(user.id);

  async function handleAdd() {
    if (!newLevel || !newRole) return;
    await addLevelRole.mutateAsync({ level: newLevel, role: newRole });
    setNewLevel('');
    setNewRole('');
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Roles y permisos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Rol principal */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Rol principal</p>
          <Badge variant={roleVariant[user.role] ?? 'outline'} className="text-sm px-3 py-1">
            {roleLabels[user.role] ?? user.role}
          </Badge>
        </div>

        {/* Roles por nivel */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Roles por nivel educativo</p>
          {user.levelRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sin roles por nivel asignados</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {user.levelRoles.map((lr) => (
                <span
                  key={lr.id}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${levelColors[lr.level] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  <span className="opacity-70">{lr.level}</span>
                  <span>·</span>
                  <span>{levelRoleLabels[lr.role] ?? lr.role}</span>
                  {canManage && (
                    <button
                      onClick={() => removeLevelRole.mutate(lr.id)}
                      className="ml-0.5 hover:opacity-70 transition-opacity"
                      disabled={removeLevelRole.isPending}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Agregar rol por nivel */}
        {canManage && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Agregar rol por nivel</p>
            <div className="flex gap-2">
              <Select value={newLevel} onValueChange={setNewLevel}>
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <SelectValue placeholder="Nivel" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm" className="h-8 px-2"
                onClick={handleAdd}
                disabled={!newLevel || !newRole || addLevelRole.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}