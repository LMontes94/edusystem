// src/lib/api/grades.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Grade {
  id:              string;
  score:           string;
  type:            string;
  description:     string | null;
  date:            string;
  student:         { id: string; firstName: string; lastName: string; documentNumber: string };
  period:          { id: string; name: string; type: string };
  courseSubject:   {
    id:      string;
    subject: { id: string; name: string; code: string };
    teacher: { id: string; firstName: string; lastName: string };
  };
}

export interface Period {
  id:        string;
  name:      string;
  type:      string;
  order:     number;
  startDate: string;
  endDate:   string;
}

export interface CreateGradeDto {
  studentId:       string;
  courseSubjectId: string;
  periodId:        string;
  score:           number;
  type:            string;
  description?:    string;
  date:            string;
}

export function useGrades(filters?: { studentId?: string; courseSubjectId?: string; periodId?: string }) {
  return useQuery({
    queryKey: ['grades', filters],
    queryFn:  async () => {
      const params = new URLSearchParams();
      if (filters?.studentId)       params.set('studentId',       filters.studentId);
      if (filters?.courseSubjectId) params.set('courseSubjectId', filters.courseSubjectId);
      if (filters?.periodId)        params.set('periodId',        filters.periodId);
      const res = await api.get<Grade[]>(`/grades?${params.toString()}`);
      return res.data;
    },
  });
}

export function usePeriods(schoolYearId?: string) {
  return useQuery({
    queryKey: ['periods', schoolYearId],
    queryFn:  async () => {
      const res = await api.get<Period[]>(`/courses/school-years/${schoolYearId}/periods`);
      return res.data;
    },
    enabled: !!schoolYearId,
  });
}

export function useCreateGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateGradeDto) => {
      const res = await api.post<Grade>('/grades', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast.success('Nota cargada exitosamente');
    },
    onError: () => toast.error('Error al cargar la nota'),
  });
}

export function useDeleteGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/grades/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast.success('Nota eliminada');
    },
    onError: () => toast.error('Error al eliminar la nota'),
  });
}