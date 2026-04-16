'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Archivo: src/lib/api/users-leave.ts
// Hooks para otorgar y revocar licencias
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api }  from '@/lib/api';

export function useGrantLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, startDate }: { userId: string; startDate: string }) => {
      const res = await api.patch(`/users/${userId}/leave`, { startDate });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Licencia otorgada');
    },
    onError: () => toast.error('Error al otorgar la licencia'),
  });
}

export function useRevokeLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.patch(`/users/${userId}/restore`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Licencia revocada — usuario activo nuevamente');
    },
    onError: () => toast.error('Error al revocar la licencia'),
  });
}