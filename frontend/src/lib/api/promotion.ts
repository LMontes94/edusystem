// src/lib/api/promotion.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  PromotionPreviewResponse,
  PromotionResult,
  PromotionStatisticsResponse,
  StudentPromotionHistoryResponse,
  PromotionResultsFilters,
  CreatePromotionOverrideDto,
  OverrideResponse,
  ExecutePromotionResponse,
} from '@/types/promotion.types';

// ── Queries ────────────────────────────────────

export function usePromotionPreview(schoolYearId: string) {
  return useQuery({
    queryKey: ['promotion-preview', schoolYearId],
    queryFn: async () => {
      const res = await api.get<PromotionPreviewResponse>(
        `/promotion/preview/${schoolYearId}`,
      );
      return res.data;
    },
    enabled: !!schoolYearId,
  });
}

export function usePromotionResults(filters: PromotionResultsFilters) {
  return useQuery({
    queryKey: ['promotion-results', {
      schoolYearId: filters.schoolYearId,
      studentId: filters.studentId,
      result: filters.result,
      isOverride: filters.isOverride,
    }],
    queryFn: async () => {
      const params = new URLSearchParams({ schoolYearId: filters.schoolYearId });
      if (filters.studentId)   params.set('studentId', filters.studentId);
      if (filters.result)      params.set('result', filters.result);
      if (filters.isOverride !== undefined) params.set('isOverride', String(filters.isOverride));
      const res = await api.get<PromotionResult[]>(`/promotion/results?${params.toString()}`);
      return res.data;
    },
    enabled: !!filters.schoolYearId,
  });
}

export function usePromotionStatistics(schoolYearId: string) {
  return useQuery({
    queryKey: ['promotion-statistics', schoolYearId],
    queryFn: async () => {
      const res = await api.get<PromotionStatisticsResponse>(
        `/promotion/statistics/${schoolYearId}`,
      );
      return res.data;
    },
    enabled: !!schoolYearId,
  });
}

export function useStudentPromotionHistory(studentId: string) {
  return useQuery({
    queryKey: ['promotion-history', studentId],
    queryFn: async () => {
      const res = await api.get<StudentPromotionHistoryResponse>(
        `/promotion/student-history/${studentId}`,
      );
      return res.data;
    },
    enabled: !!studentId,
  });
}

// ── Mutations ──────────────────────────────────

export function useExecutePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schoolYearId: string) => {
      const res = await api.post<ExecutePromotionResponse>(
        `/promotion/execute/${schoolYearId}`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-years'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-preview'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-results'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-statistics'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-history'] });
      toast.success('Promoción ejecutada exitosamente');
    },
    onError: () => toast.error('Error al ejecutar la promoción'),
  });
}

export function useCreatePromotionOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePromotionOverrideDto) => {
      const res = await api.post<OverrideResponse>('/promotion/override', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-years'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-results'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-statistics'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-history'] });
      toast.success('Resultado manual cargado exitosamente');
    },
    onError: () => toast.error('Error al cargar el resultado manual'),
  });
}
