import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { EligiblePeriod, PendingSubjectStatus } from '@/app/admin/pending/_components/pending.types';

export function useEligibleSubjects(studentId: string, schoolYearId: string) {
  return useQuery({
    queryKey: ['pending', 'eligible', studentId, schoolYearId],
    queryFn: async () => {
      const res = await api.get(`/teacher/pending/eligible/${studentId}`, {
        params: { schoolYearId },
      });
      return res.data as EligiblePeriod[];
    },
    enabled: !!studentId && !!schoolYearId,
  });
}

export function useCreatePendingSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { closingGradeId: string }) => {
      await api.post('/teacher/pending', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['pending', 'eligible'] });
      toast.success('Intensificación creada');
    },
    onError: () => toast.error('Error al crear intensificación'),
  });
}

export function useUpdatePendingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PendingSubjectStatus }) => {
      await api.patch(`/teacher/pending/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-subjects'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar estado'),
  });
}

export function useUpdatePendingProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, string | undefined>) => {
      await api.patch(`/teacher/pending/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-subjects'] });
      toast.success('Seguimiento guardado');
    },
    onError: () => toast.error('Error al guardar seguimiento'),
  });
}

export function useDeletePendingSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/teacher/pending/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-subjects'] });
      toast.success('Eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });
}
