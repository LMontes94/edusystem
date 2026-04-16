// src/lib/api/notifications.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Notification {
  id:     string;
  type:   'GRADE' | 'ATTENDANCE' | 'CHAT' | 'ANNOUNCEMENT' | 'SYSTEM';
  title:  string;
  body:   string;
  data:   Record<string, string> | null;
  isRead: boolean;
  sentAt: string;
}

// ── Listar notificaciones ─────────────────────
export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey:        ['notifications'],
    queryFn:         async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
    refetchInterval: 30_000,   // polling cada 30s
    staleTime:       20_000,
  });
}

// ── Contador de no leídas ─────────────────────
export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey:        ['notifications', 'unread-count'],
    queryFn:         async () => {
      const res = await api.get('/notifications/unread-count');
      return res.data;
    },
    refetchInterval: 30_000,
    staleTime:       20_000,
  });
}

// ── Marcar una como leída ─────────────────────
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ── Marcar todas como leídas ──────────────────
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}