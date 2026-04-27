'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSession }  from 'next-auth/react';
import { Button }      from '@/components/ui/button';
import { Badge }       from '@/components/ui/badge';
import { ArrowLeft }   from 'lucide-react';
import { useUser }     from '@/lib/api/users';
import { roleLabels, roleVariant, LEAVE_ALLOWED_ROLES } from '../_components/users.types';
import { PersonalInfoCard } from './_components/personal-info-card';
import { AvatarCard }       from './_components/avatar-card';
import { RoleCard }         from './_components/role-card';
import { StatusCard }       from './_components/status-card';

export default function UserDetailPage() {
  const { id }        = useParams<{ id: string }>();
  const router        = useRouter();
  const { data: session } = useSession();

  const currentRole   = (session?.user as any)?.role ?? '';
  const canManage     = LEAVE_ALLOWED_ROLES.includes(currentRole);

  const { data: user, isLoading } = useUser(id);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      Cargando...
    </div>
  );

  if (!user) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      Usuario no encontrado
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant={roleVariant[user.role] ?? 'outline'}>
          {roleLabels[user.role] ?? user.role}
        </Badge>
      </div>

      {/* Grid layout */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

        {/* Columna izquierda — avatar + estado */}
        <div className="space-y-6">
          <AvatarCard user={user as any} />
          <StatusCard user={user as any} currentRole={currentRole} />
        </div>

        {/* Columna derecha — datos personales + roles */}
        <div className="md:col-span-2 space-y-6">
          <PersonalInfoCard user={user} />
          <RoleCard
            user={{ id: user.id, role: user.role, levelRoles: (user as any).levelRoles ?? [] }}
            canManage={canManage}
          />
        </div>

      </div>
    </div>
  );
}