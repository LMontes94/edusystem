import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRoom, CreateRoomDto, ChatRoom } from '@/lib/api/chat';
import { toast } from 'sonner';

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation<ChatRoom, Error, CreateRoomDto>({
    mutationFn: createRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    },
    onError: () => toast.error('Error al crear la conversación'),
  });
}
