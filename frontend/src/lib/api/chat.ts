import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ChatRoomMember {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
  };
  joinedAt: string;
}

export interface ChatRoom {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name: string | null;
  courseId: string | null;
  lastMessageAt: string | null;
  members: ChatRoomMember[];
  course?: {
    id: string;
    name: string;
    grade: string;
    division: string;
  };
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string | null;
  type: 'TEXT' | 'FILE' | 'IMAGE';
  attachmentUrl: string | null;
  readBy: string[];
  sentAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
  };
}

export interface CreateRoomDto {
  name?: string;
  type: 'DIRECT' | 'GROUP';
  participantIds?: string[];
  courseId?: string;
}

export interface SendMessageDto {
  content: string;
  type?: 'TEXT' | 'FILE' | 'IMAGE';
  attachmentUrl?: string;
  roomId: string;
}

interface RoomsResponse {
  rooms: ChatRoom[];
  nextCursor?: string;
  hasMore: boolean;
}

interface MessagesResponse {
  messages: ChatMessage[];
  nextCursor?: string;
  hasMore: boolean;
}

interface UnreadResponse {
  total: number;
  rooms: { roomId: string; unreadCount: number }[];
}

// ── Listar salas de chat ─────────────────────
export function useChatRooms(params?: { type?: string; courseId?: string; limit?: number; cursor?: string }) {
  return useQuery<RoomsResponse>({
    queryKey:        ['chat', 'rooms', params],
    queryFn:         async () => {
      const searchParams = new URLSearchParams();
      if (params?.type) searchParams.set('type', params.type);
      if (params?.courseId) searchParams.set('courseId', params.courseId);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      const res = await api.get(`/chat/rooms${searchParams.toString() ? `?${searchParams}` : ''}`);
      return res.data;
    },
    staleTime:       30_000,
  });
}

// ── Obtener detalles de una sala ─────────────────────
export function useChatRoom(roomId: string) {
  return useQuery<ChatRoom>({
    queryKey:        ['chat', 'rooms', roomId],
    queryFn:         async () => {
      const res = await api.get(`/chat/rooms/${roomId}`);
      return res.data;
    },
    enabled:         !!roomId,
    staleTime:       30_000,
  });
}

// ── Listar mensajes de una sala ─────────────────────
export function useChatMessages(roomId: string, params?: { limit?: number; before?: string }) {
  return useQuery<MessagesResponse>({
    queryKey:        ['chat', 'messages', roomId, params],
    queryFn:         async () => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.before) searchParams.set('before', params.before);
      const res = await api.get(`/chat/rooms/${roomId}/messages?${searchParams}`);
      return res.data;
    },
    enabled:         !!roomId,
    staleTime:       10_000,
  });
}

// ── Crear sala de chat ─────────────────────
export function useCreateChatRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateRoomDto) => {
      const res = await api.post('/chat/rooms', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    },
  });
}

// ── Enviar mensaje ─────────────────────
export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SendMessageDto) => {
      const res = await api.post('/chat/messages', data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', variables.roomId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    },
  });
}

// ── Marcar mensajes como leídos ─────────────────────
export function useMarkChatMessagesRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { roomId: string; messageId?: string }) => {
      await api.post('/chat/messages/read', data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', variables.roomId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms', 'unread'] });
    },
  });
}

// ── Contador de no leídos ─────────────────────
export function useChatUnreadCount() {
  return useQuery<UnreadResponse>({
    queryKey:        ['chat', 'rooms', 'unread'],
    queryFn:         async () => {
      const res = await api.get('/chat/rooms/unread');
      return res.data;
    },
    staleTime:       20_000,
  });
}