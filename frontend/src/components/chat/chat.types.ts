import type { ChatRoom, ChatMessage } from '@/lib/api/chat';

export interface RoomListProps {
  rooms?: ChatRoom[];
  activeRoomId?: string;
  unreadByRoom?: Record<string, number>;
  isLoading: boolean;
  isError?: boolean;
  onRoomClick: (roomId: string) => void;
}

export interface MessageListProps {
  roomId: string;
}

export interface MessageGroupProps {
  date: string;
  messages: ChatMessage[];
  currentUserId: string;
}

export interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
}

export interface MessageInputProps {
  roomId: string;
  disabled?: boolean;
}

export interface ChatHeaderProps {
  room: ChatRoom | undefined;
  isLoading: boolean;
  onViewParticipants?: () => void;
  onAddParticipants?: () => void;
  onExportPdf?: () => void;
  currentUserRole?: string;
}

export interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoomCreated?: (roomId: string) => void;
}

export interface AddParticipantsDialogProps {
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ViewParticipantsDialogProps {
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
