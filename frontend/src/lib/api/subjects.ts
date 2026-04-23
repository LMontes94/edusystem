// src/lib/api/subjects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api }  from '@/lib/api';
import { Subject, SubjectForm } from '@/app/admin/subjects/_components/subjects.types';

export function useSubjects() {
  return useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn:  async () => {
      const res = await api.get<Subject[]>('/subjects');
      return res.data;
    },
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SubjectForm) => {
      const res = await api.post<Subject>('/subjects', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Materia creada exitosamente');
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        toast.error('Ya existe una materia con ese código');
      } else {
        toast.error('Error al crear la materia');
      }
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SubjectForm }) => {
      const res = await api.patch<Subject>(`/subjects/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Materia actualizada');
    },
    onError: () => toast.error('Error al actualizar la materia'),
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/subjects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Materia eliminada');
    },
    onError: () => toast.error('No se puede eliminar — la materia tiene datos asociados'),
  });
}