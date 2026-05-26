import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface GuardianLink {
  id: string;
  userId: string;
  studentId: string;
  relationship: string;
  isPrimary: boolean;
  canPickup: boolean;
  createdAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    courseStudents: {
      course: {
        id: string;
        name: string;
        grade: number;
        division: string;
      };
    }[];
  };
}

export interface StudentSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  courseStudents: {
    course: {
      id: string;
      name: string;
      grade: number;
      division: string;
    };
  }[];
}

export function useGuardianStudents(guardianId: string) {
  return useQuery<GuardianLink[]>({
    queryKey: ['guardians', guardianId, 'students'],
    queryFn: async () => {
      const res = await api.get<GuardianLink[]>(`/guardians/${guardianId}/students`);
      return res.data;
    },
    enabled: !!guardianId,
  });
}

export function useLinkStudent(guardianId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { studentId: string }) => {
      const res = await api.post(`/guardians/${guardianId}/students`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardians', guardianId, 'students'] });
      toast.success('Alumno vinculado exitosamente');
    },
    onError: () => toast.error('Error al vincular el alumno'),
  });
}

export function useUnlinkStudent(guardianId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (studentId: string) => {
      await api.delete(`/guardians/${guardianId}/students/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardians', guardianId, 'students'] });
      toast.success('Alumno desvinculado exitosamente');
    },
    onError: () => toast.error('Error al desvincular el alumno'),
  });
}

export function useSearchStudents(query: string) {
  return useQuery<StudentSearchResult[]>({
    queryKey: ['students', 'search', query],
    queryFn: async () => {
      const res = await api.get<StudentSearchResult[]>('/students', {
        params: { search: query },
      });
      return res.data;
    },
    enabled: query.length >= 2,
  });
}
