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
}

export interface MessagesResponse {
  messages: ChatMessage[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface RoomsResponse {
  rooms: ChatRoom[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface UnreadResponse {
  total: number;
  rooms: { roomId: string; unreadCount: number }[];
}

export interface MembersResponse {
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  level: string | null;
  participants: (ChatRoomMember & {
    role: string;
    addedBy?: { firstName: string; lastName: string } | null;
  })[];
}

// ── Pure API functions ─────────────────────────

export async function fetchRooms(params?: { type?: string; courseId?: string; limit?: number; cursor?: string }): Promise<RoomsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.courseId) searchParams.set('courseId', params.courseId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  const qs = searchParams.toString();
  const res = await api.get(`/chat/rooms${qs ? `?${qs}` : ''}`);
  return res.data;
}

export async function fetchRoom(roomId: string): Promise<ChatRoom> {
  const res = await api.get(`/chat/rooms/${roomId}`);
  return res.data;
}

export async function fetchMessages(roomId: string, params?: { limit?: number; before?: string }): Promise<MessagesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.before) searchParams.set('before', params.before);
  const res = await api.get(`/chat/rooms/${roomId}/messages?${searchParams}`);
  return res.data;
}

export async function createRoom(data: CreateRoomDto): Promise<ChatRoom> {
  const res = await api.post('/chat/rooms', data);
  return res.data;
}

export async function sendMessage(roomId: string, data: SendMessageDto): Promise<ChatMessage> {
  const res = await api.post('/chat/messages', { ...data, roomId });
  return res.data;
}

export async function markMessagesRead(data: { roomId: string; messageId?: string }): Promise<void> {
  await api.post('/chat/messages/read', data);
}

export async function fetchUnreadCount(): Promise<UnreadResponse> {
  const res = await api.get('/chat/rooms/unread');
  return res.data;
}

export async function addParticipants(roomId: string, userIds: string[]): Promise<void> {
  await api.post(`/chat/rooms/${roomId}/members`, { userIds });
}

export async function fetchParticipants(roomId: string): Promise<MembersResponse> {
  const res = await api.get(`/chat/rooms/${roomId}/members`);
  return res.data;
}

export async function exportConversationPdf(roomId: string): Promise<void> {
  const res = await api.get(`/chat/rooms/${roomId}/export/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url; a.download = 'conversacion.pdf'; a.click();
  URL.revokeObjectURL(url);
}

// ── Shared dedup utility ───────────────────────
// Used by REST polling and future WS bridge. Dedups by message.id, sorts only by sentAt.

export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const existingIds = new Set(existing.map(m => m.id));
  const newMessages = incoming.filter(m => !existingIds.has(m.id));
  return [...existing, ...newMessages].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}
