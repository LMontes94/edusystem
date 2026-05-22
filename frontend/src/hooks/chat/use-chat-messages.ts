import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchMessages, MessagesResponse } from '@/lib/api/chat';

export function useChatMessages(roomId: string, limit: number = 50) {
  return useInfiniteQuery<MessagesResponse>({
    queryKey: ['chat', 'messages', roomId],
    queryFn: ({ pageParam }) => fetchMessages(roomId, { limit, before: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: !!roomId,
    staleTime: 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
