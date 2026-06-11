import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export interface LevelGrade {
  id: string;
  name: string;
  displayOrder: number;
  educationLevelId: string;
  status: string;
}

export interface EducationLevel {
  id: string;
  name: string;
  slug: string;
  institutionId: string;
  status: string;
  displayOrder: number;
  levelGrades: LevelGrade[];
}

export interface CreateEducationLevelDto {
  name: string;
  slug: string;
}

export interface UpdateEducationLevelDto {
  name?: string;
  slug?: string;
  status?: string;
}

export function useEducationLevels() {
  return useQuery<EducationLevel[]>({
    queryKey: ['education-levels'],
    queryFn: async () => {
      const res = await api.get<EducationLevel[]>('/education-levels');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateEducationLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateEducationLevelDto) => {
      const res = await api.post<EducationLevel>('/education-levels', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education-levels'] });
      toast.success('Nivel educativo creado');
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error('Ya existe un nivel con ese nombre o slug');
      } else {
        toast.error('Error al crear el nivel educativo');
      }
    },
  });
}

export function useUpdateEducationLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEducationLevelDto }) => {
      const res = await api.patch<EducationLevel>(`/education-levels/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education-levels'] });
      toast.success('Nivel educativo actualizado');
    },
    onError: () => toast.error('Error al actualizar el nivel educativo'),
  });
}

export function useDeleteEducationLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/education-levels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education-levels'] });
      toast.success('Nivel educativo eliminado');
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error('No se puede eliminar — el nivel tiene datos asociados');
      } else {
        toast.error('Error al eliminar el nivel educativo');
      }
    },
  });
}
