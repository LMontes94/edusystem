'use client';

// src/components/sidebar-brand.tsx
// Muestra el logo de la institución si existe, sino las iniciales.

import Image      from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { api }      from '@/lib/api';
import { Session }  from 'next-auth';

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

interface SidebarBrandProps {
  session:   Session | null;
  subtitle?: string; // ej: "Panel administrativo" o "Panel del docente"
}

export function SidebarBrand({ session, subtitle = 'Panel administrativo' }: SidebarBrandProps) {
  const institutionId = (session?.user as any)?.institutionId;

  const { data: logoData } = useInstitutionLogo(institutionId);
  const { data: nameData } = useInstitutionName(institutionId);

  const logoUrl  = logoData?.url  ?? null;
  const instName = nameData?.name ?? 'EduSystem';
  const initials = instName.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Escudo / logo */}
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
          <span className="text-xs font-bold text-muted-foreground">{initials}</span>
        )}
      </div>

      {/* Nombre + subtítulo */}
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate leading-tight">{instName}</p>
        <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
      </div>
    </div>
  );
}