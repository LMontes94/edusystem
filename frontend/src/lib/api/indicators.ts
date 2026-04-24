// src/lib/api/indicators.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api }  from '@/lib/api';

export interface Indicator {
  id:           string;
  description:  string;
  order:        number;
  subjectId:    string;
  schoolYearId: string;
}

export function useIndicators(params: {
  subjectId?:    string;
  schoolYearId?: string;
  grade?:        number | null;
}) {
  const { subjectId, schoolYearId, grade } = params;
  return useQuery<Indicator[]>({
    queryKey: ['indicators', subjectId, schoolYearId, grade],
    queryFn:  async () => {
      const res = await api.get<Indicator[]>('/indicators', {
        params: { subjectId, schoolYearId, grade },
      });
      return res.data;
    },
    enabled: !!subjectId && !!schoolYearId && grade !== null && grade !== undefined,
  });
}

export function useCreateIndicator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      subjectId:    string;
      schoolYearId: string;
      grade:        number;
      description:  string;
    }) => {
      await api.post('/indicators', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicators'] });
      toast.success('Indicador agregado');
    },
    onError: () => toast.error('Error al agregar el indicador'),
  });
}

export function useUpdateIndicator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      await api.patch(`/indicators/${id}`, { description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicators'] });
      toast.success('Indicador actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });
}

export function useDeleteIndicator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/indicators/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicators'] });
      toast.success('Indicador eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });
}