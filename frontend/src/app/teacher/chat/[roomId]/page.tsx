'use client';

import { useParams } from 'next/navigation';
import { ChatLayout } from '@/components/chat/chat-layout';

export default function TeacherChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  return <ChatLayout activeRoomId={roomId} basePath="/teacher/chat" />;
}
