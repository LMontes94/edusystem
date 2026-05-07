// src/lib/api/sports.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Sport {
  id:        string;
  name:      string;
  _count:    { groups: number };
}

export interface SportGroupTeacher {
  userId: string;
  user:   { id: string; firstName: string; lastName: string; email: string };
}

export interface SportGroupStudent {
  studentId: string;
  student:   { id: string; firstName: string; lastName: string; documentNumber: string };
}

export interface SportGroup {
  id:           string;
  name:         string;
  sportId:      string;
  schoolYearId: string;
  sport:        { id: string; name: string };
  schoolYear:   { id: string; name: string };
  teachers:     SportGroupTeacher[];
  students:     SportGroupStudent[];
  _count:       { students: number; attendances: number };
}

export interface CreateSportDto   { name: string }
export interface UpdateSportDto   { name?: string }

export interface CreateSportGroupDto {
  sportId:      string;
  schoolYearId: string;
  name:         string;
  teacherIds:   string[];
  studentIds?:  string[];
}

export interface UpdateSportGroupDto {
  name?:       string;
  teacherIds?: string[];
  studentIds?: string[];
}

export interface SportGroupFilters {
  sportId?:      string;
  schoolYearId?: string;
}

export interface BulkSportAttendanceRecord {
  studentId:   string;
  status:      'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';
  arrivalTime?: string;
}

export interface BulkSportAttendanceDto {
  sportGroupId: string;
  courseId:     string;
  date:         string;
  records:      BulkSportAttendanceRecord[];
}

// ─── Sports ───────────────────────────────────────────────────────────────────

export function useSports() {
  return useQuery({
    queryKey: ['sports'],
    queryFn:  async () => {
      const res = await api.get<Sport[]>('/sports');
      return res.data;
    },
  });
}

export function useCreateSport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSportDto) => {
      const res = await api.post<Sport>('/sports', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports'] });
      toast.success('Deporte creado');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Error al crear el deporte';
      toast.error(msg);
    },
  });
}

export function useUpdateSport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSportDto }) => {
      const res = await api.patch<Sport>(`/sports/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports'] });
      toast.success('Deporte actualizado');
    },
    onError: () => toast.error('Error al actualizar el deporte'),
  });
}

export function useDeleteSport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/sports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports'] });
      toast.success('Deporte eliminado');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Error al eliminar el deporte';
      toast.error(msg);
    },
  });
}

// ─── Sport Groups ─────────────────────────────────────────────────────────────

export function useSportGroups(filters?: SportGroupFilters) {
  return useQuery({
    queryKey: ['sport-groups', filters],
    queryFn:  async () => {
      const params = new URLSearchParams();
      if (filters?.sportId)      params.set('sportId',      filters.sportId);
      if (filters?.schoolYearId) params.set('schoolYearId', filters.schoolYearId);
      const res = await api.get<SportGroup[]>(`/sport-groups?${params.toString()}`);
      return res.data;
    },
  });
}

export function useSportGroup(id: string) {
  return useQuery({
    queryKey: ['sport-groups', id],
    queryFn:  async () => {
      const res = await api.get<SportGroup>(`/sport-groups/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateSportGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSportGroupDto) => {
      const res = await api.post<SportGroup>('/sport-groups', {
        ...data,
        studentIds: data.studentIds ?? [],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-groups'] });
      toast.success('Grupo creado exitosamente');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Error al crear el grupo';
      console.error('[createSportGroup] error:', error?.response?.data);
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });
}

export function useUpdateSportGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSportGroupDto }) => {
      const res = await api.patch<SportGroup>(`/sport-groups/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-groups'] });
      toast.success('Grupo actualizado');
    },
    onError: () => toast.error('Error al actualizar el grupo'),
  });
}

export function useDeleteSportGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/sport-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-groups'] });
      toast.success('Grupo eliminado');
    },
    onError: () => toast.error('Error al eliminar el grupo'),
  });
}

export function useAddStudentsToGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, studentIds }: { id: string; studentIds: string[] }) => {
      const res = await api.post<SportGroup>(`/sport-groups/${id}/students`, { studentIds });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['sport-groups', id] });
      toast.success('Alumnos agregados');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Error al agregar alumnos';
      toast.error(msg);
    },
  });
}

export function useRemoveStudentFromGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, studentId }: { id: string; studentId: string }) => {
      await api.delete(`/sport-groups/${id}/students/${studentId}`);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['sport-groups', id] });
      toast.success('Alumno removido del grupo');
    },
    onError: () => toast.error('Error al remover el alumno'),
  });
}

export function useBulkSportAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BulkSportAttendanceDto) => {
      const res = await api.post('/sport-groups/attendance/bulk', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-attendance'] });
      toast.success('Asistencia registrada exitosamente');
    },
    onError: () => toast.error('Error al registrar la asistencia'),
  });
}