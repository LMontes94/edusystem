import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export interface LevelGrade {
  id: string;
  name: string;
  displayOrder: number;
  educationLevelId: string;
  status: string;
  educationLevel?: {
    id: string;
    name: string;
  };
}

export interface CreateLevelGradeDto {
  name: string;
  displayOrder?: number;
}

export interface UpdateLevelGradeDto {
  name?: string;
  displayOrder?: number;
  status?: string;
}

export function useCreateLevelGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      educationLevelId,
      data,
    }: {
      educationLevelId: string;
      data: CreateLevelGradeDto;
    }) => {
      const res = await api.post<LevelGrade>(
        `/education-levels/${educationLevelId}/grades`,
        data,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education-levels'] });
      toast.success('Grado creado');
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error('Ya existe un grado con ese nombre en el nivel');
      } else {
        toast.error('Error al crear el grado');
      }
    },
  });
}

export function useUpdateLevelGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      educationLevelId,
      id,
      data,
    }: {
      educationLevelId: string;
      id: string;
      data: UpdateLevelGradeDto;
    }) => {
      const res = await api.patch<LevelGrade>(
        `/education-levels/${educationLevelId}/grades/${id}`,
        data,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education-levels'] });
      toast.success('Grado actualizado');
    },
    onError: () => toast.error('Error al actualizar el grado'),
  });
}

export function useDeleteLevelGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      educationLevelId,
      id,
    }: {
      educationLevelId: string;
      id: string;
    }) => {
      await api.delete(`/education-levels/${educationLevelId}/grades/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education-levels'] });
      toast.success('Grado eliminado');
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error('No se puede eliminar — el grado tiene datos asociados');
      } else {
        toast.error('Error al eliminar el grado');
      }
    },
  });
}

export function useReorderLevelGrades() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fromGrade,
      toGrade,
    }: {
      fromGrade: { id: string; educationLevelId: string; displayOrder: number };
      toGrade: { id: string; educationLevelId: string; displayOrder: number };
    }) => {
      await Promise.all([
        api.patch(
          `/education-levels/${fromGrade.educationLevelId}/grades/${fromGrade.id}`,
          { displayOrder: toGrade.displayOrder },
        ),
        api.patch(
          `/education-levels/${toGrade.educationLevelId}/grades/${toGrade.id}`,
          { displayOrder: fromGrade.displayOrder },
        ),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education-levels'] });
      toast.success('Orden actualizado');
    },
    onError: () => toast.error('Error al reordenar'),
  });
}
