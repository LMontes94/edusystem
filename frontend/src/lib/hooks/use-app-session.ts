'use client';

// src/lib/hooks/use-app-session.ts
// Hook centralizado que evita múltiples llamadas a /api/auth/session
// usando React Query como caché en lugar del polling interno de NextAuth

import { useQuery } from '@tanstack/react-query';
import { getSession } from 'next-auth/react';

export function useAppSession() {
  return useQuery({
    queryKey: ['auth-session'],
    queryFn:  () => getSession(),
    staleTime: 5 * 60 * 1000,  // considera la sesión válida por 5 minutos
    gcTime:    10 * 60 * 1000, // mantiene en caché 10 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: false,      // no refetch al montar — usa el caché
    refetchInterval: 5 * 60 * 1000, // refresca cada 5 minutos
  });
}