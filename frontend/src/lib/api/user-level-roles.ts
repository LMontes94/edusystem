// src/lib/api/user-level-roles.ts
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api }  from '@/lib/api';

export interface EducationLevel {
  id:    string;
  name:  string;
  slug:  string;
  institutionId: string;
  status: string;
}

export const LEVELS = [
  { value: 'INICIAL',    label: 'Inicial'    },
  { value: 'PRIMARIA',   label: 'Primaria'   },
  { value: 'SECUNDARIA', label: 'Secundaria' },
] as const;

export const LEVEL_ROLES = [
  { value: 'DIRECTOR',  label: 'Director'  },
  { value: 'SECRETARY', label: 'Secretaria'},
  { value: 'PRECEPTOR', label: 'Preceptor' },
  { value: 'TEACHER',   label: 'Docente'   },
  { value: 'GUARDIAN',  label: 'Tutor'     },
] as const;

export function useEducationLevels() {
  return useQuery<EducationLevel[]>({
    queryKey: ['education-levels'],
    queryFn:  async () => {
      const res = await api.get<EducationLevel[]>('/education-levels');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddLevelRole(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { educationLevelId: string; role: string; level?: string }) => {
      const res = await api.post(`/users/${userId}/level-roles`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Rol agregado');
    },
    onError: () => toast.error('Error al agregar el rol'),
  });
}

export function useRemoveLevelRole(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (levelRoleId: string) => {
      await api.delete(`/users/${userId}/level-roles/${levelRoleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Rol eliminado');
    },
    onError: () => toast.error('Error al eliminar el rol'),
  });
}