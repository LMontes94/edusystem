// src/lib/api/announcements.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Announcement {
  id:          string;
  title:       string;
  content:     string;
  scope:       'INSTITUTION' | 'COURSE';
  publishedAt: string | null;
  createdAt:   string;
  author:      { id: string; firstName: string; lastName: string; role: string };
  course?:     { id: string; name: string; grade: number; division: string };
}

export interface CreateAnnouncementDto {
  title:    string;
  content:  string;
  scope:    'INSTITUTION' | 'COURSE';
  courseId?: string;
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn:  async () => {
      const res = await api.get<Announcement[]>('/announcements');
      return res.data;
    },
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAnnouncementDto) => {
      const res = await api.post<Announcement>('/announcements', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Comunicado creado');
    },
    onError: () => toast.error('Error al crear el comunicado'),
  });
}

export function usePublishAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/announcements/${id}/publish`);
      return res.data;
    },
    onSettled: () => {
      // onSettled corre tanto en éxito como en error
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onSuccess: () => {
      toast.success('Comunicado publicado');
    },
    onError: (error: any) => {
      // Si el error es 403 "ya fue publicado", igual refrescamos sin mostrar error
      if (error?.response?.status === 403) {
        toast.info('El comunicado ya estaba publicado');
      } else {
        toast.error('Error al publicar el comunicado');
      }
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Comunicado eliminado');
    },
    onError: () => toast.error('Error al eliminar el comunicado'),
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateAnnouncementDto> }) => {
      const res = await api.patch<Announcement>(`/announcements/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Comunicado actualizado');
    },
    onError: () => toast.error('Error al actualizar el comunicado'),
  });
}