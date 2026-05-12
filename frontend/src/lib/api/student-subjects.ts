// src/lib/api/student-subjects.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudentSubjectAssignment {
  id:             string;
  type:           'RECURSE' | 'EXEMPT';
  courseSubjectId: string;
  schoolYearId:   string;
  courseSubject: {
    id:      string;
    subject: { id: string; name: string; code: string };
    teacher: { id: string; firstName: string; lastName: string };
    course:  { id: string; name: string; grade: number; division: string };
  };
  schoolYear: { id: string; year: number };
  createdBy:  { id: string; firstName: string; lastName: string } | null;
  createdAt:  string | null;
}

export interface RegularSubject {
  id:              string;
  type:            'REGULAR';
  courseSubjectId: string;
  schoolYearId:    string | undefined;
  courseSubject: {
    id:      string;
    subject: { id: string; name: string; code: string };
    teacher: { id: string; firstName: string; lastName: string };
    course:  { id: string; name: string; grade: number; division: string };
  };
  schoolYear: { id: string; year: number } | null;
}

export interface StudentSubjectsResponse {
  regular: RegularSubject[];
  recurse: StudentSubjectAssignment[];
  exempt:  StudentSubjectAssignment[];
}

export interface AssignSubjectDto {
  courseSubjectId: string;
  schoolYearId:    string;
  type:            'RECURSE' | 'EXEMPT';
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useStudentSubjects(studentId: string, schoolYearId?: string) {
  return useQuery<StudentSubjectsResponse>({
    queryKey: ['student-subjects', studentId, schoolYearId],
    queryFn:  async () => {
      const params = new URLSearchParams();
      if (schoolYearId) params.set('schoolYearId', schoolYearId);
      const res = await api.get(`/students/${studentId}/subjects?${params.toString()}`);
      return res.data;
    },
    enabled: !!studentId,
  });
}

export function useAssignSubject(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: AssignSubjectDto) => {
      const res = await api.post(`/students/${studentId}/subjects`, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-subjects', studentId] });
      toast.success('Materia asignada exitosamente');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Error al asignar la materia';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });
}

export function useRemoveSubjectAssignment(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/students/${studentId}/subjects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-subjects', studentId] });
      toast.success('Asignación eliminada');
    },
    onError: () => toast.error('Error al eliminar la asignación'),
  });
}