'use client';

import { useState, useCallback } from 'react';
import { useSendMessage } from '@/hooks/chat/use-send-message';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import type { MessageInputProps } from './chat.types';

export function MessageInput({ roomId, disabled }: MessageInputProps) {
  const [text, setText] = useState('');
  const sendMessage = useSendMessage(roomId);

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || sendMessage.isPending) return;

    try {
      await sendMessage.mutateAsync({ content });
      setText('');
    } catch {
      // Error toast handled by hook
    }
  }, [text, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = text.trim().length > 0 && !sendMessage.isPending && !disabled;

  return (
    <div className="border-t p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'No podés enviar mensajes mientras estás en licencia' : 'Escribí un mensaje...'}
          disabled={disabled}
          rows={1}
          className="flex-1 min-h-[40px] max-h-[120px] resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <Button
          size="icon"
          disabled={!canSend}
          onClick={handleSend}
          className="shrink-0 h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
