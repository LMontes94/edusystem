import { useQuery } from '@tanstack/react-query';
import { fetchUnreadCount, UnreadResponse } from '@/lib/api/chat';

export function useChatUnreadCount() {
  return useQuery<UnreadResponse>({
    queryKey: ['chat', 'rooms', 'unread'],
    queryFn: fetchUnreadCount,
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
