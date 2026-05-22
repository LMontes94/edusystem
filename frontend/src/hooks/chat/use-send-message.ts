import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage, SendMessageDto, ChatMessage } from '@/lib/api/chat';
import { toast } from 'sonner';

export function useSendMessage(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, SendMessageDto>({
    mutationFn: (data) => sendMessage(roomId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', roomId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    },
    onError: () => toast.error('Error al enviar el mensaje'),
  });
}
