'use client';

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useChatMessages } from '@/hooks/chat/use-chat-messages';
import { useAppSession } from '@/lib/hooks/use-app-session';
import { MessageGroup } from './message-group';
import { ChatEmptyState } from './chat-empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronUp } from 'lucide-react';
import type { MessageListProps } from './chat.types';
import type { ChatMessage, MessagesResponse } from '@/lib/api/chat';

function flattenMessages(data: { pages: MessagesResponse[] } | undefined): ChatMessage[] {
  if (!data?.pages) return [];
  const all = data.pages.flatMap((p) => p.messages ?? []);
  return all.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

function groupByDate(messages: ChatMessage[]): Map<string, ChatMessage[]> {
  const groups = new Map<string, ChatMessage[]>();
  for (const msg of messages) {
    const dateKey = msg.sentAt.split('T')[0];
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(msg);
  }
  return groups;
}

export function MessageList({ roomId }: MessageListProps) {
  const { data: session } = useAppSession();
  const currentUserId = session?.user?.id ?? '';

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useChatMessages(roomId);

  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const isInitialLoad = useRef(true);

  const messages = useMemo(() => flattenMessages(data), [data]);
  const groups = useMemo(() => groupByDate(messages), [messages]);

  // Auto-scroll to bottom on initial load and new messages
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
      isInitialLoad.current = false;
    }
  }, [messages.length]);

  // Preserve scroll position after prepending older messages
  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      const diff = newScrollHeight - prevScrollHeightRef.current;
      scrollContainerRef.current.scrollTop += diff;
      prevScrollHeightRef.current = 0;
    }
  }, [data?.pages?.length]);

  // IntersectionObserver for "load older" trigger
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          prevScrollHeightRef.current = scrollContainerRef.current?.scrollHeight ?? 0;
          fetchNextPage();
        }
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleLoadMore = useCallback(() => {
    prevScrollHeightRef.current = scrollContainerRef.current?.scrollHeight ?? 0;
    fetchNextPage();
  }, [fetchNextPage]);

  if (isLoading) {
    return (
      <div className="flex-1 p-5 space-y-4 overflow-y-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <p className="text-sm">Error al cargar los mensajes</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>Reintentar</Button>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <ChatEmptyState
          title="No hay mensajes"
          description="Enviá un mensaje para empezar la conversación"
        />
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 space-y-1">
      {/* Load older trigger */}
      {hasNextPage && (
        <div className="flex justify-center py-2">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Skeleton className="h-3 w-3 rounded-full animate-pulse" />
              Cargando mensajes anteriores...
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs gap-1"
              onClick={handleLoadMore}
            >
              <ChevronUp className="h-3 w-3" />
              Ver mensajes anteriores
            </Button>
          )}
        </div>
      )}

      <div ref={topSentinelRef} />

      {/* Message groups by date */}
      {Array.from(groups.entries()).map(([dateKey, msgs]) => (
        <MessageGroup
          key={dateKey}
          date={dateKey}
          messages={msgs}
          currentUserId={currentUserId}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
