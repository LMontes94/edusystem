import { useQuery } from '@tanstack/react-query';
import { fetchRooms, RoomsResponse } from '@/lib/api/chat';

export function useChatRooms(params?: { type?: string; courseId?: string; limit?: number; cursor?: string }) {
  return useQuery<RoomsResponse>({
    queryKey: ['chat', 'rooms', params],
    queryFn: () => fetchRooms(params),
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
