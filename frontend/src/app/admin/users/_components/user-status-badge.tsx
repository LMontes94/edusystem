'use client';

import { Badge } from '@/components/ui/badge';

interface Props {
  status:          string;
  leaveStartDate?: string | null;
}

export function UserStatusBadge({ status, leaveStartDate }: Props) {
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