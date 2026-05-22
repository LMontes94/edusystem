'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useChatRooms } from '@/hooks/chat/use-chat-rooms';
import { useChatUnreadCount } from '@/hooks/chat/use-chat-unread';
import { useChatRoom } from '@/hooks/chat/use-chat-room';
import { useIsOnLeave } from '@/lib/hooks/use-is-on-leave';
import { RoomList } from './room-list';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';
import { ChatHeader } from './chat-header';
import { ChatEmptyState } from './chat-empty-state';
import { NewMessageDialog } from './new-message-dialog';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MessageSquarePlus, Menu } from 'lucide-react';

interface ChatLayoutProps {
  activeRoomId?: string;
  basePath: string;
}

export function ChatLayout({ activeRoomId, basePath }: ChatLayoutProps) {
  const router = useRouter();
  const isOnLeave = useIsOnLeave();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: roomsData, isLoading: roomsLoading, isError: roomsError } = useChatRooms();
  const { data: unreadData } = useChatUnreadCount();
  const { data: activeRoom, isLoading: roomLoading } = useChatRoom(activeRoomId ?? '');

  const rooms = roomsData?.rooms;
  const unreadByRoom = Object.fromEntries(
    unreadData?.rooms?.map((r) => [r.roomId, r.unreadCount]) ?? []
  );

  const handleRoomClick = useCallback(
    (roomId: string) => {
      router.push(`${basePath}/${roomId}`);
      setSidebarOpen(false);
    },
    [router, basePath]
  );

  const handleRoomCreated = useCallback(
    (roomId: string) => {
      router.push(`${basePath}/${roomId}`);
    },
    [router, basePath]
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] border rounded-lg overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:w-80 lg:w-96 flex-col border-r bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h1 className="text-sm font-semibold">Chat</h1>
          {!isOnLeave && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setDialogOpen(true)}
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <RoomList
          rooms={rooms}
          activeRoomId={activeRoomId}
          unreadByRoom={unreadByRoom}
          isLoading={roomsLoading}
          isError={roomsError}
          onRoomClick={handleRoomClick}
        />
      </aside>

      {/* Sidebar — mobile drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden absolute top-3 left-3 z-10 h-8 w-8"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h1 className="text-sm font-semibold">Chat</h1>
            {!isOnLeave && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => { setDialogOpen(true); setSidebarOpen(false); }}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
            )}
          </div>
          <RoomList
            rooms={rooms}
            activeRoomId={activeRoomId}
            unreadByRoom={unreadByRoom}
            isLoading={roomsLoading}
            isError={roomsError}
            onRoomClick={handleRoomClick}
          />
        </SheetContent>
      </Sheet>

      {/* Main panel */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeRoomId ? (
          <>
            <ChatHeader room={activeRoom} isLoading={roomLoading} />
            <MessageList roomId={activeRoomId} />
            <MessageInput
              roomId={activeRoomId}
              disabled={isOnLeave}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <ChatEmptyState
              title="Seleccioná una conversación"
              description="Elegí un chat de la lista o iniciá uno nuevo"
            />
          </div>
        )}
      </main>

      {/* New message dialog */}
      <NewMessageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onRoomCreated={handleRoomCreated}
      />
    </div>
  );
}
