// src/lib/api/courses.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Course {
  id:           string;
  name:         string;
  grade:        number;
  division:     string;
  level:        string;
  schoolYearId: string;
  schoolYear:   { year: number; isActive: boolean };
  _count?:      { courseStudents: number; courseSubjects: number };
}

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn:  async () => {
      const res = await api.get<Course[]>('/courses');
      return res.data;
    },
  });
}

export function useEnrollStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, courseId }: { studentId: string; courseId: string }) => {
      const res = await api.post(`/students/${studentId}/enroll`, { courseId });
      return res.data;
    },
    onSuccess: (_data, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: ['students', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Alumno matriculado exitosamente');
    },
    onError: () => toast.error('Error al matricular el alumno'),
  });
}