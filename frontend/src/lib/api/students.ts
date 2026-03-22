// src/lib/api/students.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Student {
  id:             string;
  firstName:      string;
  lastName:       string;
  documentNumber: string;
  birthDate:      string;
  bloodType?:     string;
  medicalNotes?:  string;
  isActive:       boolean;
  institutionId:  string;
  createdAt:      string;
  courseStudents?: {
    status: string;
    course: { id: string; name: string; grade: number; division: string };
  }[];
  guardians?: {
    relationship: string;
    isPrimary:    boolean;
    user: { id: string; firstName: string; lastName: string; email: string };
  }[];
}

export interface CreateStudentDto {
  firstName:      string;
  lastName:       string;
  documentNumber: string;
  birthDate:      string;
  bloodType?:     string;
  medicalNotes?:  string;
}

// ── Hooks ─────────────────────────────────────

export function useStudents() {
  return useQuery({
    queryKey: ['students'],
    queryFn:  async () => {
      const res = await api.get<Student[]>('/students');
      return res.data;
    },
  });
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: ['students', id],
    queryFn:  async () => {
      const res = await api.get<Student>(`/students/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateStudentDto) => {
      const res = await api.post<Student>('/students', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Alumno creado exitosamente');
    },
    onError: () => toast.error('Error al crear el alumno'),
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/students/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Alumno eliminado');
    },
    onError: () => toast.error('Error al eliminar el alumno'),
  });
}
