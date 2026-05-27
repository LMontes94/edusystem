'use client';

import Image          from 'next/image';
import { useQuery }   from '@tanstack/react-query';
import { useAppSession } from '@/lib/hooks/use-app-session';
import { api }        from '@/lib/api';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

function useInstitutionLogo(institutionId: string | null | undefined) {
  return useQuery<{ url: string | null }>({
    queryKey: ['institution-logo', institutionId],
    queryFn:  async () => {
      const res = await api.get(`/institutions/${institutionId}/logo-url`);
      return res.data;
    },
    enabled:   !!institutionId,
    staleTime: 5 * 60 * 1000,
  });
}

function useInstitutionName(institutionId: string | null | undefined) {
  return useQuery<{ name: string }>({
    queryKey: ['institution-name', institutionId],
    queryFn:  async () => {
      const res = await api.get('/institutions/mine');
      return { name: res.data.name };
    },
    enabled:   !!institutionId,
    staleTime: 10 * 60 * 1000,
  });
}

const subtitleByRole: Record<string, string> = {
  ADMIN:     'Panel administrativo',
  DIRECTOR:  'Panel directivo',
  SECRETARY: 'Panel secretaría',
  PRECEPTOR: 'Panel preceptoría',
  TEACHER:   'Panel del docente',
};

export function SidebarBrand() {
  const { data: session } = useAppSession();
  const { state }         = useSidebar();
  const institutionId     = (session?.user as any)?.institutionId;
  const role              = (session?.user as any)?.role as string | undefined;
  const isCollapsed       = state === 'collapsed';

  const { data: logoData } = useInstitutionLogo(institutionId);
  const { data: nameData } = useInstitutionName(institutionId);

  const logoUrl  = logoData?.url  ?? null;
  const instName = nameData?.name ?? 'EduSystem';
  const subtitle = subtitleByRole[role ?? ''] ?? 'Panel';

  return (
    <div
      className={cn(
        'flex items-center py-2',
        isCollapsed ? 'justify-center px-0' : 'gap-3 px-2',
      )}
    >
      <div className="h-9 w-9 rounded-md border bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={instName}
            width={36}
            height={36}
            className="object-contain p-0.5"
            unoptimized
          />
        ) : (
          <span className="text-xs font-bold text-muted-foreground">
            {instName.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate leading-tight">{instName}</p>
          <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
        </div>
      )}
    </div>
  );
}