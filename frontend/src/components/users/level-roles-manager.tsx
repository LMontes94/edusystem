'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Componente: LevelRolesManager
// Uso en /admin/users — se muestra dentro del dropdown o dialog de cada usuario
//
// Ejemplo de uso:
//   <LevelRolesManager user={user} canManage={canManageLeave} />
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge }  from '@/components/ui/badge';
import { Plus, X, Layers } from 'lucide-react';
import {
  useAddLevelRole, useRemoveLevelRole, LEVELS, LEVEL_ROLES,
} from '@/lib/api/user-level-roles';

interface LevelRole {
  id:    string;
  level: string;
  role:  string;
}

interface User {
  id:         string;
  firstName:  string;
  lastName:   string;
  levelRoles: LevelRole[];
}

const levelColors: Record<string, string> = {
  INICIAL:    'bg-purple-100 text-purple-700 border-purple-200',
  PRIMARIA:   'bg-blue-100 text-blue-700 border-blue-200',
  SECUNDARIA: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const roleLabels: Record<string, string> = {
  DIRECTOR:  'Director',
  SECRETARY: 'Secretaria',
  PRECEPTOR: 'Preceptor',
  TEACHER:   'Docente',
  GUARDIAN:  'Tutor',
};

// ── Botón que abre el dialog desde el dropdown ─
export function LevelRolesButton({ user, canManage }: { user: User; canManage: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full gap-2"
      >
        <Layers className="h-4 w-4" />
        Roles por nivel
        {user.levelRoles.length > 0 && (
          <span className="ml-auto text-xs bg-muted rounded-full px-1.5 py-0.5">
            {user.levelRoles.length}
          </span>
        )}
      </button>

      <LevelRolesDialog
        open={open}
        onClose={() => setOpen(false)}
        user={user}
        canManage={canManage}
      />
    </>
  );
}

// ── Dialog principal ──────────────────────────
function LevelRolesDialog({
  open, onClose, user, canManage,
}: {
  open:      boolean;
  onClose:   () => void;
  user:      User;
  canManage: boolean;
}) {
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Roles por nivel — {user.firstName} {user.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Roles actuales */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Roles asignados</p>
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
                    <span>{roleLabels[lr.role] ?? lr.role}</span>
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

          {/* Agregar nuevo rol — solo si puede gestionar */}
          {canManage && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Agregar rol</p>
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
                  size="sm"
                  className="h-8 px-2"
                  onClick={handleAdd}
                  disabled={!newLevel || !newRole || addLevelRole.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Badge compacto para mostrar en la tabla ───
export function LevelRolesBadges({ levelRoles }: { levelRoles: LevelRole[] }) {
  if (levelRoles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {levelRoles.map((lr) => (
        <span
          key={lr.id}
          className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded border font-medium ${levelColors[lr.level] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {lr.level.charAt(0)}{lr.level.slice(1).toLowerCase()} · {roleLabels[lr.role] ?? lr.role}
        </span>
      ))}
    </div>
  );
}