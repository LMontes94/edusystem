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
  levelGradeId: string;
}

export interface LevelGrade {
  id:           string;
  name:         string;
  displayOrder: number;
  educationLevelId: string;
  educationLevel: { id: string; name: string; slug: string };
}

export function useLevelGrades() {
  return useQuery<LevelGrade[]>({
    queryKey: ['level-grades'],
    queryFn:  async () => {
      const res = await api.get<any[]>('/education-levels');
      const levels = res.data;
      const grades: LevelGrade[] = [];
      for (const el of levels) {
        for (const lg of el.levelGrades ?? []) {
          grades.push({ ...lg, educationLevel: { id: el.id, name: el.name, slug: el.slug } });
        }
      }
      return grades;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useIndicators(params: {
  subjectId?:    string;
  schoolYearId?: string;
  levelGradeId?: string | null;
}) {
  const { subjectId, schoolYearId, levelGradeId } = params;
  return useQuery<Indicator[]>({
    queryKey: ['indicators', subjectId, schoolYearId, levelGradeId],
    queryFn:  async () => {
      const res = await api.get<Indicator[]>('/indicators', {
        params: { subjectId, schoolYearId, levelGradeId },
      });
      return res.data;
    },
    enabled: !!subjectId && !!schoolYearId && !!levelGradeId,
  });
}

export function useCreateIndicator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      subjectId:    string;
      schoolYearId: string;
      levelGradeId: string;
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