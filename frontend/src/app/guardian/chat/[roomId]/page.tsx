'use client';

import { useParams } from 'next/navigation';
import { ChatLayout } from '@/components/chat/chat-layout';

export default function GuardianChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  return <ChatLayout activeRoomId={roomId} basePath="/guardian/chat" />;
}
