// src/lib/api/institution.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api }  from '@/lib/api';

export interface Institution {
  id:          string;
  name:        string;
  domain:      string | null;
  logoUrl:     string | null;
  address:     string | null;
  phone:       string | null;
  plan:        'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  status:      'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  trialEndsAt: string | null;
  settings:    {
    report?: {
      primaryColor?:   string;
      secondaryColor?: string;
      textColor?:      string;
      logoPosition?:   'center' | 'left' | 'none';
      layout?:         'classic' | 'institutional' | 'modern';
    };
    absenceThresholds?: number[];
    district?:          string;
  } | null;
  _count: { users: number; students: number; courses: number };
}

export interface Invitation {
  id:          string;
  email:       string;
  role:        string;
  expiresAt:   string;
  acceptedAt:  string | null;
  createdAt:   string;
  inviteLink?: string;
}

// ── Mi institución ────────────────────────────
export function useMyInstitution() {
  return useQuery<Institution>({
    queryKey: ['institution', 'mine'],
    queryFn:  async () => {
      const res = await api.get('/institutions/mine');
      return res.data;
    },
  });
}

// ── Actualizar institución ────────────────────
export function useUpdateInstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/institutions/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institution'] });
      toast.success('Configuración guardada');
    },
    onError: () => toast.error('Error al guardar'),
  });
}

// ── Invitaciones ──────────────────────────────
export function useInvitations(institutionId: string) {
  return useQuery<Invitation[]>({
    queryKey: ['invitations', institutionId],
    queryFn:  async () => {
      const res = await api.get(`/institutions/${institutionId}/invitations`);
      return res.data;
    },
    enabled: !!institutionId,
  });
}

export function useCreateInvitation(institutionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await api.post(`/institutions/${institutionId}/invite`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', institutionId] });
      toast.success('Invitación enviada');
    },
    onError: () => toast.error('Error al enviar la invitación'),
  });
}

export function useRevokeInvitation(institutionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      await api.delete(`/institutions/${institutionId}/invitations/${invitationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', institutionId] });
      toast.success('Invitación revocada');
    },
    onError: () => toast.error('Error al revocar la invitación'),
  });
}

// ── Todas las instituciones (superadmin) ──────
export function useAllInstitutions() {
  return useQuery<Institution[]>({
    queryKey: ['institutions', 'all'],
    queryFn:  async () => {
      const res = await api.get('/institutions');
      return res.data;
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/institutions/${id}/plan`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] });
      toast.success('Plan actualizado');
    },
    onError: () => toast.error('Error al actualizar el plan'),
  });
}