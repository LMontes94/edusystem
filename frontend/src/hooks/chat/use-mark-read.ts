import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markMessagesRead } from '@/lib/api/chat';

export function useMarkRead(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { messageId?: string }>({
    mutationFn: (data) => markMessagesRead({ roomId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', roomId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms', 'unread'] });
    },
  });
}
