import { useQuery } from '@tanstack/react-query';
import { fetchRoom, ChatRoom } from '@/lib/api/chat';

export function useChatRoom(roomId: string) {
  return useQuery<ChatRoom>({
    queryKey: ['chat', 'rooms', roomId],
    queryFn: () => fetchRoom(roomId),
    enabled: !!roomId,
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
