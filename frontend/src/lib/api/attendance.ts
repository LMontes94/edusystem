// src/lib/api/attendance.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface AttendanceRecord {
  id:           string;
  date:         string;
  status:       'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';
  justification?: string;
  student:      { id: string; firstName: string; lastName: string; documentNumber: string };
  course:       { id: string; name: string; grade: number; division: string };
  recordedBy:   { id: string; firstName: string; lastName: string };
}

export interface BulkAttendanceRecord {
  studentId:     string;
  status:        'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';
  justification?: string;
}

export function useAttendance(filters?: { courseId?: string; date?: string }) {
  return useQuery({
    queryKey: ['attendance', filters],
    queryFn:  async () => {
      const params = new URLSearchParams();
      if (filters?.courseId) params.set('courseId', filters.courseId);
      if (filters?.date)     params.set('date',     filters.date);
      const res = await api.get<AttendanceRecord[]>(`/attendance?${params.toString()}`);
      return res.data;
    },
  });
}

export function useBulkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      courseId: string;
      date:     string;
      records:  BulkAttendanceRecord[];
    }) => {
      const res = await api.post('/attendance/bulk', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Asistencia registrada exitosamente');
    },
    onError: () => toast.error('Error al registrar la asistencia'),
  });
}