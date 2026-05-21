# EduSystem Chat Frontend Architecture

> **Version:** 1.0 | **Platform:** EduSystem SaaS Educational Management Platform | **Last updated:** 2026-05-21
> **Status:** Planning — Frontend chat UI not yet implemented
> **Audience:** Frontend engineers, AI coding agents, code reviewers

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Architecture Philosophy](#2-architecture-philosophy)
3. [Architecture Overview](#3-architecture-overview)
4. [Route Architecture](#4-route-architecture)
5. [WebSocket Mount Strategy](#5-websocket-mount-strategy)
6. [Shared Infrastructure Layer](#6-shared-infrastructure-layer)
7. [Component Tree & Responsibilities](#7-component-tree--responsibilities)
8. [State Ownership Matrix](#8-state-ownership-matrix)
9. [Single Source of Truth](#9-single-source-of-truth)
10. [Cache Architecture](#10-cache-architecture)
11. [Message Ordering & Reconciliation](#11-message-ordering--reconciliation)
12. [Failure Modes & Recovery](#12-failure-modes--recovery)
13. [Scroll Restoration Strategy](#13-scroll-restoration-strategy)
14. [Optimistic Update Strategy](#14-optimistic-update-strategy)
15. [Rendering Strategy](#15-rendering-strategy)
16. [Realtime Performance Notes](#16-realtime-performance-notes)
17. [Security Invariants](#17-security-invariants)
18. [Multi-Tenancy Considerations](#18-multi-tenancy-considerations)
19. [Role-Based Capability Mapping](#19-role-based-capability-mapping)
20. [Guardian-Specific UX Considerations](#20-guardian-specific-ux-considerations)
21. [Future Considerations](#21-future-considerations)
22. [Glossary](#22-glossary)

---

## 1. Purpose & Scope

### 1.1 What This Document Is

This document is the **authoritative frontend systems architecture** reference for the EduSystem chat/messaging UI. It defines:

- How the frontend chat layer connects to the existing backend chat module (Socket.IO + REST)
- How data flows between WebSocket, React Query, and UI components
- How state ownership is distributed across the frontend stack
- How realtime synchronization, caching, and optimistic updates work
- How multi-tenant isolation, security invariants, and role-based capabilities are enforced
- How the architecture supports three distinct role groups (admin/preceptor, teacher, guardian) from a shared infrastructure

### 1.2 What This Document Is NOT

- **Not a UI design document** — pixel-level layout, color tokens, and animation specs are not included
- **Not a backend architecture document** — the backend chat architecture is documented in `docs/CHAT.md`
- **Not a tutorial** — it assumes familiarity with Next.js App Router, React Query, Socket.IO, and the EduSystem codebase conventions defined in `docs/engineering/frontend-patterns.md`

### 1.3 Required Reading

Before implementing any chat frontend code, the following documents MUST be read:

| Document | Covers |
|----------|--------|
| `docs/CHAT.md` | Backend chat: data model, REST API, WebSocket events, presence, rate limits, CASL, BullMQ |
| `docs/engineering/frontend-patterns.md` | React Query conventions, component patterns, state ownership rules |
| `docs/engineering/security-practices.md` | Frontend security rules, session handling |
| `docs/engineering/code-review-checklist.md` | Frontend review checklist alignment |
| `docs/AUTH.md` | JWT flow, session → WS auth bridge |
| `docs/MULTITENANCY.md` | Tenant-safe rendering, institutionId derivation |
| `docs/INFRASTRUCTURE.md` | Redis pub/sub adapter, WS scaling, container topology |
| `docs/ARCHITECTURE.md` | High-level system design, dual-mode runtime |
| `AGENTS.md` sections 6.x | Frontend development rules, React Query patterns, form handling |

---

## 2. Architecture Philosophy

EduSystem chat is an **institutional communication workspace**, not a consumer messaging application. This distinction drives every architectural decision in this document.

### 2.1 Design Priorities

| Priority | Rationale |
|----------|-----------|
| **Predictable state ownership** | Every piece of state has exactly one owner (React Query, useState, or WS ref). No duplicated state. |
| **Minimal duplicated state** | Server state lives in React Query. WS-only state (typing, presence) is ephemeral. No zustand for chat. |
| **Realtime resilience over perceived immediacy** | A message that arrives 300ms late with correct ordering is preferred over instant display with wrong ordering. Backend commit order is authoritative. |
| **Backend-authoritative synchronization** | The REST API + database are the single source of truth. WebSocket events are synchronization hints. |
| **Maintainable component boundaries** | Capability-aware rendering via context, not `role === 'GUARDIAN'` conditionals scattered across components. |
| **Progressive scalability** | v1 prioritizes correctness and realtime consistency. Virtualization, offline support, and high-throughput optimizations are deferred. |
| **Institutional workflow support** | Audit trails, ON_LEAVE enforcement, role-to-role policy compliance, and multi-tenant isolation are non-negotiable. |

### 2.2 What This Means For Implementation

- Frontend capabilities are **rendering hints**, not authorization. The backend `InstitutionChatPolicy` + CASL remain authoritative.
- The chat UI must work correctly even with degraded or no WebSocket connectivity (fallback to REST polling).
- Role-specific UI is composed from a shared component library via capability flags, not by duplicating components per role.
- Guardian experience is a distinct UX domain but shares the same realtime infrastructure.

---

## 3. Architecture Overview

### 3.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Route Groups                                │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐              │
│  │ /admin/chat  │  │ /teacher/chat │  │ /guardian/chat│              │
│  │ /admin/chat/ │  │ /teacher/chat/│  │ /guardian/chat/              │
│  │  [roomId]    │  │  [roomId]     │  │  [roomId]    │              │
│  └──────┬───────┘  └──────┬────────┘  └──────┬───────┘              │
│         │                 │                  │                       │
│         └─────────────────┼──────────────────┘                       │
│                           ▼                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     ChatLayout (shared)                        │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │              ChatSocketProvider                          │  │ │
│  │  │  (Socket.IO lifecycle, scoped to chat routes)            │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────┐    ┌──────────────────┐    ┌─────────────┐  │ │
│  │  │   RoomList    │    │   MessageList     │    │ MessageInput │  │ │
│  │  │  (sidebar)    │    │   (main panel)    │    │  (compose)   │  │ │
│  │  └──────────────┘    └──────────────────┘    └─────────────┘  │ │
│  │                           ┌──────────────────┐                 │ │
│  │                           │ AttachmentUploader│                 │ │
│  │                           └──────────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                           │                    │
               ┌───────────┘                    └───────────┐
               ▼                                              ▼
┌───────────────────────────┐              ┌───────────────────────────────┐
│     REST (Axios + RQ)     │              │  WebSocket (Socket.IO)        │
│  GET/POST /chat/rooms     │              │  /chat namespace              │
│  GET/POST /chat/messages  │              │  JWT auth on handshake        │
│  POST /chat/upload        │              │  Events: newMessage,          │
│  POST /chat/messages/read │              │  messagesRead, userOnline,    │
│  GET /chat/search         │              │  userOffline, userTyping      │
└───────────────────────────┘              └───────────────────────────────┘
                           │                    │
                           └────────┬───────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │     Backend (see docs/CHAT.md)  │
                    │  ChatService + ChatGateway     │
                    └───────────────────────────────┘
```

### 3.2 Data Flow Summary

```
User action → optimistic cache update → REST mutation → DB persist → WS broadcast
→ WS event received by sender + recipients → React Query cache patch → UI re-render
```

1. User sends a message via `MessageInput`
2. Optimistic message appears immediately in the UI (client-generated `tempId`)
3. REST `POST /chat/messages` commits to database
4. Backend broadcasts `newMessage` via Socket.IO to all room members (including sender)
5. Sender receives WS echo → replaces optimistic message with server-authoritative version
6. Recipients receive WS event → message appended to their `MessageList` cache
7. BullMQ dispatches push notifications to offline recipients

---

## 4. Route Architecture

### 4.1 Route Map

| Route | Roles | Layout | Description |
|-------|-------|--------|-------------|
| `/admin/chat` | ADMIN, DIRECTOR, SECRETARY, PRECEPTOR | `admin/layout.tsx` → `ChatLayout` | Full chat UX |
| `/admin/chat/[roomId]` | same | — | Active conversation |
| `/teacher/chat` | TEACHER | `teacher/layout.tsx` → `ChatLayout` | Teacher-scoped UX |
| `/teacher/chat/[roomId]` | same | — | Active conversation |
| `/guardian/chat` | GUARDIAN | `guardian/layout.tsx` → `ChatLayout` | Minimal guardian UX |
| `/guardian/chat/[roomId]` | same | — | Active conversation |

### 4.2 Route Group Structure

```
src/app/
├── admin/
│   ├── layout.tsx                ← Admin layout (AppLayout)
│   └── chat/
│       ├── page.tsx              ← Room list (redirect to first room or empty state)
│       └── [roomId]/
│           └── page.tsx          ← Active conversation
├── teacher/
│   ├── layout.tsx                ← Teacher layout (AppLayout)
│   └── chat/                     ← Same structure as admin/chat
│       ├── page.tsx
│       └── [roomId]/
│           └── page.tsx
└── guardian/                     ← NEW route group
    ├── layout.tsx                ← Guardian layout (AppLayout, distinct nav)
    └── chat/
        ├── page.tsx              ← Room list
        └── [roomId]/
            └── page.tsx          ← Active conversation
```

### 4.3 Layout Composition

All three route groups use the same `ChatLayout` component internally:

```typescript
// admin/chat/layout.tsx
'use client';
import { ChatLayout } from '@/components/chat/chat-layout';

export default function AdminChatLayout({ children }: { children: React.ReactNode }) {
  return <ChatLayout roleGroup="admin">{children}</ChatLayout>;
}
```

```typescript
// guardian/layout.tsx
'use client';
import { AppLayout } from '@/components/layouts/app-layout';

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
```

```typescript
// guardian/chat/layout.tsx
'use client';
import { ChatLayout } from '@/components/chat/chat-layout';

export default function GuardianChatLayout({ children }: { children: React.ReactNode }) {
  return <ChatLayout roleGroup="guardian">{children}</ChatLayout>;
}
```

### 4.4 Navigation Integration

Add chat entries to the existing navigation arrays in `src/components/layouts/navigation.ts`:

| Nav Array | Entry | Position |
|-----------|-------|----------|
| `adminNav` | `{ name: 'Chat', href: '/admin/chat', icon: MessageCircle }` | After Comunicados |
| `preceptorNav` | `{ name: 'Chat', href: '/admin/chat', icon: MessageCircle }` | After Comunicados |
| `teacherNav` | `{ name: 'Chat', href: '/teacher/chat', icon: MessageCircle }` | After Pendientes |

Guardians require a new `guardianNav` array and a `GUARDIAN` entry in `navigationByRole`:

| Nav Array | Roles |
|-----------|-------|
| `guardianNav` | GUARDIAN |

```typescript
// src/app/guardian/layout.tsx — new layout for guardian routes
'use client';
import { AppLayout } from '@/components/layouts/app-layout';

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
```

### 4.5 File Locations

```
src/
├── app/
│   ├── admin/chat/
│   │   ├── page.tsx
│   │   └── [roomId]/
│   │       └── page.tsx
│   ├── teacher/chat/
│   │   ├── page.tsx
│   │   └── [roomId]/
│   │       └── page.tsx
│   └── guardian/               ← NEW guardian route group
│       ├── layout.tsx
│       └── chat/
│           ├── page.tsx
│           └── [roomId]/
│               └── page.tsx
└── components/chat/            ← NEW shared chat components
    ├── chat-layout.tsx         ← Shared layout (mounts ChatSocketProvider)
    ├── chat-socket-provider.tsx← WS lifecycle provider
    ├── room-list.tsx
    ├── message-list.tsx
    ├── message-input.tsx
    ├── new-message-dialog.tsx
    ├── attachment-uploader.tsx
    └── chat.types.ts           ← Shared interfaces, capability types
```

---

## 5. WebSocket Mount Strategy

### 5.1 Scope Decision

The Socket.IO connection MUST exist **only inside chat routes**. The `ChatSocketProvider` mounts inside `ChatLayout`, not globally in `AppLayout`.

### 5.2 Rationale

| Concern | Impact of Global Socket | Improvement with Scoped Socket |
|---------|------------------------|--------------------------------|
| **Persistent connections** | Every platform user has an always-open WS connection | WS exists only when actively using chat |
| **Heartbeat/presence traffic** | All users generate heartbeat traffic regardless of activity | Heartbeat traffic proportional to active chat users |
| **Reconnect storms** | Navigating unrelated modules triggers reconnects | No reconnect penalty when browsing non-chat pages |
| **Listener accumulation** | Global socket accumulates handlers across module boundaries | Listeners mount/unmount with chat route lifecycle |
| **Memory/runtime isolation** | Socket state bleeds across the entire app | Socket lifecycle contained within chat module |

### 5.3 Socket Lifecycle

```typescript
// ChatSocketProvider — mounted inside ChatLayout
function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useAppSession();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;

    const socket = io(`${WS_URL}/chat`, {
      auth: { token: session.accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      console.error('WS connect error:', err.message);
      setConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [session?.accessToken]);

  return (
    <ChatSocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </ChatSocketContext.Provider>
  );
}
```

### 5.4 Connect / Disconnect Behavior

| Event | Behavior |
|-------|----------|
| User navigates to `/admin/chat` | `ChatLayout` mounts → `ChatSocketProvider` mounts → Socket connects with JWT auth → joins rooms |
| User navigates from `/admin/chat` to `/admin/dashboard` | `ChatLayout` unmounts → `ChatSocketProvider` cleanup → socket disconnects |
| User re-enters `/admin/chat` | New mount → new connection → rooms re-joined |
| User signs out while on chat page | Socket disconnect triggered by cleanup + `signOut()` |
| JWT expires during active session | `connect_error` with 401 → refresh token via NextAuth → reconnect |
| Network loss | Socket.IO client-side reconnection with exponential backoff (1s → 2s → 4s → 8s → 16s max) |

### 5.5 `useChatSocket` Hook

```typescript
function useChatSocket() {
  const ctx = useContext(ChatSocketContext);
  if (!ctx) throw new Error('useChatSocket must be used within ChatSocketProvider');
  return ctx;
}
```

Consumers can access `socket.emit(...)` for client-to-server events and `socket.on(...)` for server-to-client events. All `on` listeners should be registered inside `useEffect` with cleanup.

---

## 6. Shared Infrastructure Layer

### 6.1 Layer Composition

```
ChatLayout (shared across all role groups)
├── ChatSocketProvider           ← WS lifecycle
├── ChatCapabilitiesProvider     ← Capability flags from policy + role
├── SplitLayout                  ← Sidebar + Main panel (responsive)
│   ├── RoomList (sidebar)       ← Shared, capability-aware
│   │   ├── RoomSearch           ← Shared
│   │   └── NewMessageButton     ← Conditionally rendered per capability
│   └── Main Panel
│       ├── ChatHeader           ← Shared, capability-aware
│       ├── MessageList          ← Shared
│       │   ├── MessageBubble    ← Shared
│       │   ├── TypingIndicator  ← Shared
│       │   └── ReadReceipts     ← Shared (admin/teacher only)
│       ├── AttachmentPreview    ← Shared
│       └── MessageInput         ← Shared, capability-aware
```

### 6.2 Capability-Aware Rendering

Components read capabilities from a React context, not from `role === 'GUARDIAN'` conditionals:

```typescript
// chat.types.ts
export interface ChatCapabilities {
  canSendMessages: boolean;
  canSendAttachments: boolean;
  canCreateDirectRooms: boolean;
  canCreateGroupRooms: boolean;
  canAddParticipants: boolean;
  canRemoveParticipants: boolean;
  canSearchMessages: boolean;
  canExportConversation: boolean;
  canViewReadReceipts: boolean;
  canViewPresence: boolean;
  canViewRoomManagement: boolean;
  canFinalizeConversation: boolean;
}

// Derived from InstitutionChatPolicy (via REST) + role
// Default to the most restrictive set, then expand based on policy
```

**Performance Note:** `ChatCapabilities` should be fetched once on chat mount and cached for the session duration. Capabilities rarely change mid-session. Stale time: 5 minutes.

### 6.3 Shared Infrastructure Invariants

1. All three route groups use the exact same `ChatLayout` component
2. All three route groups share the same React Query cache keys (no duplication per role)
3. All three route groups share the same WebSocket namespace and event handlers
4. Role-specific rendering is controlled by `ChatCapabilities` context, not component duplication
5. The `ChatSocketProvider` is instantiated once per `ChatLayout` mount, regardless of role

---

## 7. Component Tree & Responsibilities

### 7.1 Component Map

| Component | Responsibility | Shared? | Capability-Aware? |
|-----------|---------------|---------|-------------------|
| `ChatLayout` | Orchestrates sidebar + main panel, mounts providers | ✓ | — |
| `ChatSocketProvider` | WS lifecycle, auth handshake, reconnection | ✓ | — |
| `ChatCapabilitiesProvider` | Derives capability flags from policy + role | ✓ | — |
| `RoomList` | Paginated room list, unread badges, search filter | ✓ | ✓ (hides admin actions for guardian) |
| `RoomSearch` | Filter rooms by name/member | ✓ | — |
| `NewMessageDialog` | Create direct/group room | ✓ | Hidden for GUARDIAN |
| `MessageList` | Cursor-paginated messages, auto-scroll, read receipts | ✓ | — |
| `MessageBubble` | Single message rendering (text/file/image) | ✓ | — |
| `TypingIndicator` | Shows "X is typing..." | ✓ | — |
| `MessageInput` | Text compose, send, attachment trigger | ✓ | ✓ (disabled for ON_LEAVE) |
| `AttachmentUploader` | File picker → MinIO upload via REST | ✓ | ✓ (basic attachment only for guardian) |
| `AttachmentPreview` | Preview uploaded file before send | ✓ | — |
| `ChatHeader` | Room name, member count, actions | ✓ | ✓ (admin actions hidden for guardian/teacher) |
| `ChatSearch` | Cross-room message search | ✓ | — |
| `UnreadBadge` | Total unread count in navigation | ✓ | — |

### 7.2 Component Boundaries

```
ChatLayout
├── providers
│   ├── ChatSocketProvider        [state: socket, connected]
│   └── ChatCapabilitiesProvider  [state: capabilities object]
│
├── RoomList (sidebar)
│   ├── RoomSearchBar             [local state: query string]
│   ├── RoomListItem[]            [props: room, active, unread]
│   │   ├── Avatar                [props: name, image]
│   │   ├── RoomName              [props: name, isGroup]
│   │   ├── LastMessagePreview    [props: content, timestamp]
│   │   └── UnreadBadge           [props: count]
│   └── NewMessageButton          [capability: canCreateDirectRooms]
│
└── Main Panel
    ├── ChatHeader                [props: room]
    │   ├── RoomInfo              [name, member count]
    │   ├── OnlineStatus          [props: onlineCount]
    │   └── RoomActions           [capability: canViewRoomManagement]
    │
    ├── MessageList (scroll container)
    │   ├── LoadMoreTrigger       [intersection observer]
    │   ├── DateSeparator          [props: date]
    │   ├── MessageBubble[]        [props: message, isOwn, capabilities]
    │   │   ├── SenderName         [for group chats]
    │   │   ├── MessageContent     [text rendering / file link / image]
    │   │   ├── MessageTimestamp   [props: sentAt]
    │   │   └── ReadReceipt         [capability: canViewReadReceipts]
    │   └── TypingIndicator        [props: users[]]
    │
    ├── NewMessagesPill           [shown when scrolled up + new messages]
    │
    └── MessageInput
        ├── AttachmentButton      [capability: canSendAttachments]
        ├── TextArea              [local state: composeText]
        ├── EmojiPicker           [future]
        └── SendButton            [disabled: empty / ON_LEAVE / sending]
```

### 7.3 Thin Page Orchestrator Pattern

Following the existing frontend convention (`frontend-patterns.md` §22), each page file is a thin orchestrator:

```typescript
// admin/chat/[roomId]/page.tsx
'use client';
import { MessageList } from '@/components/chat/message-list';
import { ChatHeader } from '@/components/chat/chat-header';
import { MessageInput } from '@/components/chat/message-input';

export default function ChatRoomPage({ params }: { params: { roomId: string } }) {
  return (
    <div className="flex flex-col h-full">
      <ChatHeader roomId={params.roomId} />
      <MessageList roomId={params.roomId} />
      <MessageInput roomId={params.roomId} />
    </div>
  );
}
```

```typescript
// admin/chat/page.tsx
'use client';
import { useChatRooms } from '@/lib/api/chat';
import { useRouter } from 'next/navigation';

export default function ChatIndexPage() {
  const { data } = useChatRooms({ limit: 1 });
  const router = useRouter();

  useEffect(() => {
    if (data?.rooms?.[0]) {
      router.replace(`/admin/chat/${data.rooms[0].id}`);
    }
  }, [data]);

  return <ChatEmptyState />;
}
```

---

## 8. State Ownership Matrix

### 8.1 State Categories

| State Category | Owner | Persistence | Scope | Examples |
|---------------|-------|-------------|-------|----------|
| **Server state** | React Query | Cache with staleTime | Global (shared across roles) | rooms list, messages, unread counts |
| **Ephemeral WS state** | React ref + context | Not persisted | ChatLayout scope | socket instance, connection status |
| **Local UI state** | `useState` | Not persisted | Component scope | activeRoom, composeText, dialog open |
| **Capability flags** | React context | Derived from RQ data | ChatLayout scope | canCreateRooms, canSendAttachments |
| **Scroll position** | React ref | Per-room map in state | ChatLayout scope | scrollTop per roomId |

### 8.2 State Ownership Table

| Data | Owner | Accessed By | Updates Via |
|------|-------|-------------|-------------|
| `ChatRoom[]` | React Query key `['chat','rooms']` | RoomList, ChatHeader, UnreadBadge | `useChatRooms()`, WS `newMessage` → cache patch |
| `ChatRoom` single | React Query key `['chat','rooms',id]` | ChatHeader, RoomActions | `useChatRoom(id)` |
| `ChatMessage[]` | React Query key `['chat','messages',roomId]` | MessageList | `useChatMessages()`, WS `newMessage` → cache patch |
| Unread counts | React Query key `['chat','unread']` | RoomList, UnreadBadge | `useChatUnreadCount()`, WS `messagesRead` → cache patch |
| Search results | React Query key `['chat','search',query]` | ChatSearch | `useChatSearch(query)` |
| `activeRoomId` | `useState` in ChatLayout | RoomList, MessageList, MessageInput | User clicks room |
| `composeText` | `useState` in MessageInput | MessageInput only | User types |
| Dialog open state | `useState` in NewMessageDialog | NewMessageDialog | User opens/closes |
| Socket instance | `useRef` in ChatSocketProvider | `useChatSocket()` hook | WS lifecycle |
| Connection status | `useState` in ChatSocketProvider | `useChatSocket()` hook | WS events |
| Typing state (received) | `useState` in MessageList | TypingIndicator | WS `userTyping` events |
| Typing state (sending) | `useRef` + throttle in MessageInput | MessageInput | Debounced WS `typing` emit |
| Room scroll positions | `useRef` Map in ChatLayout | MessageList | Room switch + scroll events |
| Online presence | `useState` Map in MessageList | ChatHeader (online count) | WS `userOnline`/`userOffline` |

### 8.3 Ownership Rules

1. **No server data in `useState`** — all API data lives in React Query cache
2. **No server data in zustand** — zustand is not used for chat state (per AGENTS.md §6.2)
3. **Ephemeral WS data** (typing, presence) lives in `useState` scoped to the component that renders it
4. **Socket instance** lives in `useRef` to avoid re-renders on socket changes
5. **Scroll positions** are maintained in a `useRef<Map<string, number>>` to survive room switches without affecting renders

---

## 9. Single Source of Truth

### 9.1 Architectural Invariant

> **The REST API + persisted database state are the single source of truth.**
> **WebSocket events are synchronization hints, NOT authoritative persisted state.**
> **React Query cache is the frontend server-state layer.**

### 9.2 What This Means

| Layer | Role | Authority |
|-------|------|-----------|
| **PostgreSQL (via REST API)** | Canonical data store | Authoritative |
| **React Query cache** | Client-side projection of server state | Derived from REST |
| **WebSocket events** | Real-time patch notifications for the cache | Hints — may arrive out of order |
| **WS-only state** | Ephemeral — typing indicators, presence | Never persisted, not authoritative |

### 9.3 Why This Invariant Exists

| Reason | Explanation |
|--------|-------------|
| **Avoids state divergence** | WS events can arrive late, out of order, or not at all. REST reconciliation prevents drift. |
| **Simplifies recovery** | On reconnect, the entire chat state can be recovered from REST without replaying WS events. |
| **Improves resilience** | If Redis pub/sub fails, the chat still works via REST. Only realtime UX degrades temporarily. |
| **Avoids duplicated stores** | No need for a separate "WS state" store — React Query is the single cache. |

### 9.4 Cache Patch vs. Refetch

- WS events **patch** the React Query cache directly (using `queryClient.setQueryData`) for low-latency updates
- Periodic **refetches** via `staleTime` or manual invalidation ensure the cache stays reconciled with the backend
- On reconnect, a full refetch of rooms and unread counts reconciles any missed events

---

## 10. Cache Architecture

### 10.1 Query Key Map

| Query Key | Type | StaleTime | CacheTime | Purpose |
|-----------|------|-----------|-----------|---------|
| `['chat','rooms']` | Query (list) | 30s | 5 min | Room list with last message previews |
| `['chat','rooms',roomId]` | Query (single) | 30s | 5 min | Single room details |
| `['chat','messages',roomId]` | Query (list) | 10s | 5 min | Messages for a room | 
| `['chat','messages',roomId,{before}]` | Query (list, page) | 10s | 5 min | Older message pages (cursor) |
| `['chat','unread']` | Query | 20s | 5 min | Total unread + per-room breakdown |
| `['chat','search',query]` | Query | 30s | 2 min | Cross-room message search results |

### 10.2 WS → Cache Bridge

When a WS event arrives, the handler patches the React Query cache directly without triggering a refetch:

```typescript
// WS event: newMessage
function handleNewMessage(message: ChatMessage) {
  queryClient.setQueryData<MessagesResponse>(
    ['chat', 'messages', message.roomId],
    (old) => {
      if (!old) return { messages: [message], nextCursor: undefined, hasMore: false };
      // Avoid duplicate (WS echo may arrive for own optimistic send)
      if (old.messages.some(m => m.id === message.id)) return old;
      return { ...old, messages: [...old.messages, message] };
    }
  );
  // Update lastMessageAt in room list
  queryClient.setQueryData<RoomsResponse>(
    ['chat', 'rooms'],
    (old) => {
      if (!old) return old;
      return {
        ...old,
        rooms: old.rooms.map(r =>
          r.id === message.roomId
            ? { ...r, lastMessageAt: message.sentAt }
            : r
        ),
      };
    }
  );
}
```

```typescript
// WS event: messagesRead
function handleMessagesRead({ roomId, userId, messageIds }: MessagesReadPayload) {
  queryClient.setQueryData<MessagesResponse>(
    ['chat', 'messages', roomId],
    (old) => {
      if (!old) return old;
      return {
        ...old,
        messages: old.messages.map(m =>
          messageIds.includes(m.id)
            ? { ...m, readBy: [...(m.readBy || []), userId] }
            : m
        ),
      };
    }
  );
  // Invalidate unread count
  queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
}
```

**Performance Note:** Cache patches should avoid full array scans where possible. For high-throughput rooms, consider maintaining a `Map<roomId, Map<messageId, ChatMessage>>` structure in the cache instead of flat arrays. This is a future optimization, not v1 requirement.

### 10.3 Cache Invalidation Rules

| Trigger | Keys Invalidated | Reason |
|---------|-----------------|--------|
| After `useSendChatMessage` success | `['chat','messages',roomId]`, `['chat','rooms']` | New message appended |
| After `useMarkChatMessagesRead` success | `['chat','messages',roomId]`, `['chat','unread']` | Read status changed |
| After `useCreateChatRoom` success | `['chat','rooms']` | New room created |
| After WS reconnect | `['chat','rooms']`, `['chat','unread']` | May have missed events |
| Periodic (via staleTime) | All chat keys | Backend reconciliation |

### 10.4 Guiding Principles

- Prefer cache **patches** over invalidations for WS events (lower latency)
- Prefer cache **invalidations** over patches for REST mutations (data integrity)
- On WS reconnect, invalidate rooms + unread (lightweight), but NOT messages per room (expensive)

---

## 11. Message Ordering & Reconciliation

### 11.1 Authoritative Ordering

> **The database commit order is authoritative. WebSocket event arrival order is NOT authoritative.**

### 11.2 Why This Distinction Matters

- A message sent at `T1` may arrive at the recipient's browser at `T3` due to network latency
- A message sent at `T2` (after `T1` in real time) may arrive at the recipient's browser at `T2` (before `T1`)
- The recipient must see messages in the order `[T1, T2]`, not `[T2, T1]`

### 11.3 Reconciliation Strategy

```typescript
// Message reconciliation rules

// 1. Optimistic messages use client-generated tempId
interface OptimisticMessage {
  id: string;            // tempId like 'optm-{uuid}'
  roomId: string;
  content: string;
  type: 'TEXT';
  senderId: string;
  sentAt: string;        // client-generated timestamp (for display only)
  sender: User;
  optimistic: true;      // flag for UI styling
}

// 2. Server response provides canonical message
interface ServerMessage {
  id: string;            // server-generated UUID
  roomId: string;
  content: string;
  type: 'TEXT';
  senderId: string;
  sentAt: string;        // server-generated timestamp (authoritative)
  sender: User;
}

// 3. Reconciliation on WS echo or REST response:
//    - Replace optimistic message by matching tempId → server id
//    - Sort messages by server `sentAt` (NOT by arrival order)
//    - Deduplicate by `id` (ignore WS echo if already present)
```

### 11.4 Message Sorting

```
Sort key: message.sentAt (ascending)
Tiebreaker: message.id (ascending, for sub-millisecond ordering)
```

Messages are sorted by `sentAt` on every cache update. The sort is stable and deterministic.

### 11.5 Duplicate Reconciliation

| Scenario | Detection | Action |
|----------|-----------|--------|
| WS echo of own message | `message.id` already in cache | Ignore (idempotent) |
| REST response after WS echo | `message.id` already in cache | Ignore |
| Same message from two WS instances | Redundant broadcast (same `id`) | Ignore (second arrival no-ops) |
| Optimistic timeout | No server response after 10s | Mark message as failed, show retry UI |

### 11.6 Accepted Trade-offs

| Trade-off | Impact | Rationale |
|-----------|--------|-----------|
| **Brief double-render** | Optimistic message appears, then replaced by server version, causing a brief flash | Ensures server-authoritative ordering; WS echo is fast enough to be imperceptible in most cases |
| **Eventual consistency** | On reconnect, unread counts may be stale until REST reconciliation | Avoids complex WS event replay; REST reconciliation is simple and reliable |
| **Out-of-order messages** | Messages from different senders may appear out of WS arrival order | Sorted by `sentAt` → correct chronological order is always displayed |

---

## 12. Failure Modes & Recovery

### 12.1 Scenario Matrix

| Failure Scenario | Detection | Frontend Behavior | Recovery |
|-----------------|-----------|-------------------|----------|
| **WS disconnect during active conversation** | `socket.on('disconnect')` → `connected = false` | UI shows "Reconnecting..." indicator. Messages still sent via REST. Optimistic renders proceed. | Exponential backoff reconnect. On reconnect: refetch rooms + unread, room re-join via `joinRoom`. |
| **WS connect error (auth failed)** | `connect_error` with 401 | Show "Session expired, reconnecting..." | Axios interceptor triggers token refresh via NextAuth. WS reconnects with fresh JWT. |
| **Optimistic send fails** | REST `POST /chat/messages` returns error | Remove optimistic message from cache. Show error toast. | User retries via UI. Optimistic send re-executed with correct server ID. |
| **Duplicate WS event** | `message.id` already in cache | Ignore (no-op handler) | — |
| **Stale unread counters** | Periodic `useChatUnreadCount` refetch finds discrepancy | Cache update via REST (authoritative) | WS `messagesRead` events patch cache incrementally. REST refetch reconciles at `staleTime` interval. |
| **Out-of-order WS delivery** | Message `sentAt: T1` arrives after `sentAt: T2` | Sort by `sentAt` on every cache update | Always correct ordering after sort. |
| **Lost typing indicators** | Typing state times out after 5s | Remove typing user from indicator | Ephemeral — no recovery needed. Next typing event triggers normally. |
| **Temporary Redis/pubsub interruption** | Some room members don't receive WS events | Affected members rely on REST polling (staleTime fallback) | Normal WS event flow resumes when Redis recovers. No data loss (messages persisted in DB). |
| **Reconnect after token refresh** | Old JWT expires → WS disconnect → new JWT → reconnect | New socket instance, re-join rooms, refetch rooms + unread | Full state recovery via REST. Ongoing optimistic sends re-attached to new socket. |
| **Component unmount during WS event processing** | React strict mode / fast navigation | Event listener cleanup in `useEffect` return prevents stale state updates | Next mount creates fresh socket + listeners. |

### 12.2 Retry Expectations

| Operation | Retry Strategy | Max Attempts |
|-----------|---------------|--------------|
| WS connection | Exponential backoff: 1s → 2s → 4s → 8s → 16s (cap) | 10 attempts, then manual refresh |
| REST mutation (send message) | React Query default retry: 3 attempts, exponential | 3 |
| REST mutation (mark read) | No retry — idempotent, loss acceptable | 0 |
| MinIO upload | Axios retry: 2 attempts | 2 |
| WS `heartbeat` | No retry — next heartbeat interval handles it | — |

### 12.3 Degraded UX Behavior

| Degradation | UI State | User-Visible Effect |
|-------------|----------|---------------------|
| WS disconnected | `connected = false` | Small "Reconnecting..." badge in chat header. Messages send via REST with slight delay. |
| WS disconnected + REST working | Full functionality via REST | Slightly higher latency for new messages (polling interval). No typing indicators. No presence. |
| Full offline | Axios requests fail | "No connection" banner. Optimistic messages remain in "sending..." state. |
| Partial (some WS events lost) | Cache reconciled via REST at staleTime | Minor delay in read receipt updates. Eventually consistent. |

### 12.4 Eventual Consistency Recovery

On any cache inconsistency, the system relies on REST reconciliation:

```
WS event path (low latency, eventually consistent):
  Server → WS → Cache patch → UI update

REST reconciliation path (higher latency, fully consistent):
  Server → REST → Cache refill → UI update
```

The REST path always wins on conflict. WS patches apply optimistically but are overwritten by the next REST refetch if incorrect.

---

## 13. Scroll Restoration Strategy

### 13.1 Core Rules

| Scenario | Scroll Behavior |
|----------|----------------|
| User opens a room | Scroll to bottom (latest messages) |
| User sends a message | Scroll to bottom |
| User is at bottom of message list (< 100px from bottom) | Auto-scroll on new incoming messages |
| User is scrolled upward (reading history) | **Do NOT auto-scroll** |
| User clicks "New messages" pill | Scroll to bottom |
| User loads older messages (pagination) | Preserve scroll anchor (prepend content above viewport) |
| User switches rooms | Restore saved scroll position for that room, or bottom if first visit |
| User returns to a room after leaving | Restore saved scroll position |

### 13.2 Implementation Approach

```typescript
// ScrollContainer with position tracking
function MessageList({ roomId }: { roomId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);

  // Save scroll position on room switch
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        scrollPositions.current.set(roomId, containerRef.current.scrollTop);
      }
    };
  }, [roomId]);

  // Restore scroll position on room enter
  useEffect(() => {
    const saved = scrollPositions.current.get(roomId);
    if (containerRef.current) {
      containerRef.current.scrollTop = saved ?? containerRef.current.scrollHeight;
    }
  }, [roomId]);

  // Track if user is at bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setIsAtBottom(atBottom);
  }, []);

  // Auto-scroll only when at bottom
  useEffect(() => {
    if (isAtBottom && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length, isAtBottom]);

  // Show "New messages" pill when scrolled up + new message arrives
  // ... 
}
```

### 13.3 "New Messages" Pill

When new messages arrive while the user is scrolled upward:

- A floating pill appears at the bottom: "N messages nuevos ▼"
- Clicking the pill scrolls to bottom and marks messages as read
- The pill disappears on scroll-to-bottom

### 13.4 Pagination Prepending

When loading older messages (cursor-based pagination):

- Previous scroll height is captured before prepending
- After prepending, `scrollTop` is adjusted by the height difference to maintain visual position
- No abrupt jump when older messages load

### 13.5 When NOT to Auto-Scroll

1. User is scrolled upward reading history
2. User has explicitly scrolled away from bottom within the last 2 seconds
3. User is searching within the message list
4. User is selecting multiple messages (future feature)

---

## 14. Optimistic Update Strategy

### 14.1 Send Message Flow

```
1. User presses Send
   │
2. Create optimistic message with tempId
   │  { id: 'optm-<uuid>', roomId, content, type: 'TEXT',
   │    senderId, sentAt: now(), optimistic: true }
   │
3. Append to React Query cache
   │  queryClient.setQueryData(['chat', 'messages', roomId], ...)
   │
4. UI renders optimistic message immediately
   │  (shown with subtle opacity or "sending..." indicator)
   │
5. REST POST /chat/messages { roomId, content }
   │
   ├── Success (201) ─► Backend broadcasts `newMessage` via WS
   │                   │  WS echo arrives → replace optimistic by matching senderId + content
   │                   │  (if WS arrives before REST response, REST response is deduped)
   │                   │  Remove optimistic flag → final UI state
   │
   └── Error ────────► Remove optimistic message from cache
                       Show error toast
                       Offer "Retry" button on the failed message
```

### 14.2 Optimistic Message Lifecycle

```typescript
interface OptimisticMessage extends ChatMessage {
  optimistic: true;
  tempId: string;
}
```

| Phase | State | Visual |
|-------|-------|--------|
| Just sent | `optimistic: true` | Slightly dimmed, no timestamp (shows "Enviando...") |
| WS echo received (match by roomId + content + senderId) | `optimistic` removed | Full opacity, server timestamp shown |
| REST success before WS echo | Same as above, but deduped | Full opacity |
| Server error | Removed from cache | Toast error |
| Timeout (10s, no response) | `status: 'failed'` | Red "No se pudo enviar" with retry button |

### 14.3 Deduplication on WS Echo

```typescript
// When WS 'newMessage' event arrives:
function reconcileOptimistic(optimisticMsg: OptimisticMessage, serverMsg: ChatMessage) {
  // Remove optimistic, add server message
  queryClient.setQueryData<MessagesResponse>(
    ['chat', 'messages', serverMsg.roomId],
    (old) => {
      if (!old) return { messages: [serverMsg], nextCursor: undefined, hasMore: false };
      const filtered = old.messages.filter(m => 
        !(m as OptimisticMessage).optimistic 
        || (m as OptimisticMessage).tempId !== optimisticMsg.tempId
      );
      // Avoid duplicate if REST response already added the server message
      if (filtered.some(m => m.id === serverMsg.id)) return old;
      return { ...old, messages: [...filtered, serverMsg].sort(bySentAt) };
    }
  );
}
```

### 14.4 Accepted Trade-off

Optimistic messages use `sentAt: clientTimestamp` for ordering until the server response arrives. If the client clock is significantly skewed, the message may appear slightly out of position until reconciled. This is acceptable because:

1. Reconciliation happens within seconds (WS echo or REST response)
2. The sort order is corrected with server-authoritative `sentAt` after reconciliation
3. Clock skew within institutional devices is typically < 1 second

---

## 15. Rendering Strategy

### 15.1 No Virtualization in v1

Virtualization (windowed rendering via `react-virtuoso` or `@tanstack/virtual`) is explicitly deferred to a future optimization. v1 uses a **simple scroll container with cursor-based pagination**.

**Rationale for deferral:**

| Concern | Why Virtualization Complicates It |
|---------|-----------------------------------|
| **Dynamic message heights** | Messages contain variable-length text, images, file links — virtualization requires accurate height measurement or estimated sizes with re-measure |
| **Attachment rendering** | Images loaded asynchronously change the message container height unpredictably |
| **Optimistic updates** | Inserting/removing optimistic messages shifts item positions, requiring virtualizer index recalculation |
| **Typing indicators** | The typing indicator is a live item that appears/disappears — hard to fit into a fixed-index virtual list |
| **Scroll restoration** | Restoring scroll position in a virtualized list requires mapping scroll offset → item index, which shifts with dynamic heights |
| **Pagination prepend** | Adding items at the top of a virtual list requires offset recalculation — a known complexity with virtualized lists |

**v1 limit:** 50 messages per page (cursor-based). "Load more" at top of scroll container.

### 15.2 Memo Strategy

```typescript
// MessageList — memoized to prevent re-render on typing/presence changes
export const MessageList = React.memo(function MessageList({
  roomId,
}: {
  roomId: string;
}) {
  // ...
});

// MessageBubble — memoized to prevent re-render of read/unread messages
export const MessageBubble = React.memo(function MessageBubble({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  // ...
});
```

**Performance Note:** `React.memo` on `MessageBubble` uses a shallow comparison of `message.id` + `message.readBy.length`. Avoid passing inline objects or functions as props — extract stable references.

### 15.3 Loading States

| State | UI |
|-------|-----|
| Initial room list load | Skeleton: 6 placeholder room items (h-16 each, animate-pulse) |
| Initial message load | Skeleton: 5 placeholder message bubbles |
| Pagination loading | Small spinner at top of message list |
| Message send in progress | Optimistic message (dimmed) + spinner icon |
| WS reconnecting | Small badge in header: "Reconectando..." |
| Empty rooms list | Illustration + "No hay conversaciones" |
| Empty messages | Illustration + "No hay mensajes. Enviá el primero." |

### 15.4 Client Component Boundaries

Minimize `'use client'` scope:

```
'use client' boundary
└── ChatLayout (client)
    ├── ChatSocketProvider (client, needs useEffect)
    ├── ChatCapabilitiesProvider (client, needs React Query context)
    ├── RoomList (client, needs useQuery)
    ├── MessageList (client, needs useQuery + WS)
    └── MessageInput (client, needs useState)
```

`ChatLayout` is the single `'use client'` boundary for the chat module. All children inherit client rendering. No intermediate server components within the chat layout.

---

## 16. Realtime Performance Notes

### 16.1 Message Rendering

| Concern | Strategy |
|---------|----------|
| Rerender on every WS event | **Prevent with `React.memo`.** Only messages whose id or readBy changed re-render. |
| Incoming message causes full list sort | Sort is O(n log n) on ~50 items — negligible. For 1000+ items, switch to insertion-sorted structure (future). |
| Batch incoming WS messages | Currently processed one-by-one. Future: buffer WS events for 100ms, then batch-update cache. |

### 16.2 Presence Updates

| Concern | Strategy |
|---------|----------|
| `userOnline`/`userOffline` per connection | **Debounce display updates to 500ms.** Presence changes are not time-critical. |
| Many users joining/leaving | For rooms with 30+ members, batch presence changes into a single state update. |
| Heartbeat events (incoming) | Heartbeats are sent by the server, not rebroadcast. The frontend never receives individual heartbeats — only `userOnline` on actual status changes. |

**Security Note:** Presence exposes online status. Respect `InstitutionChatPolicy` flags that may restrict presence visibility (e.g., guardians seeing teacher presence). Only display presence if `canViewPresence` capability is true.

### 16.3 Typing Indicators

| Concern | Strategy |
|---------|----------|
| WS `userTyping` events per keystroke | **Throttle display updates to 1 visual update per 500ms.** The backend enforces 1 event/500ms, but visual updates should be even more conservative. |
| Multiple users typing simultaneously | Aggregated display: "María y Juan están escribiendo..." (2 users) or "Varias personas están escribiendo..." (3+). |
| Stale typing indicator | Auto-remove after 4 seconds without a new `isTyping: true` event. |
| Own typing | Do not render own typing indicator. |

### 16.4 WebSocket Synchronization

| Concern | Strategy |
|---------|----------|
| Cache invalidation on every WS event | **Only invalidate lightweight keys** (unread count). Messages use cache patches, not invalidation. |
| Full room list refetch on WS event | Never happens. Only specific room's `lastMessageAt` is patched. |
| Excessive refetches on reconnect | On reconnect: refetch rooms + unread (2 queries). Do NOT refetch all room messages. |
| Event listener accumulation | All `socket.on(...)` registrations are paired with `socket.off(...)` in the same `useEffect` cleanup. |

### 16.5 Future Optimizations

- **Event batching**: Buffer WS events for 50-100ms, apply as a single React state update
- **Message window**: Limit rendered messages to last 200 per room; older messages loaded on demand
- **Presence debounce on server**: Aggregate presence changes server-side before broadcasting

---

## 17. Security Invariants

### 17.1 Frontend Is Not Authorization

> **Frontend capability-aware rendering is a UX optimization, NOT a security boundary.**
> **Every mutation and read is authorized by the backend via CASL + InstitutionChatPolicy.**

### 17.2 Security Rules Applied to Chat

| Rule | Enforcement Layer | What Happens If Violated |
|------|-------------------|--------------------------|
| ON_LEAVE users cannot send messages | Client: `useIsOnLeave()` disables send button. Axios: interceptor aborts POST requests. Backend: `checkUserStatus()` in WS handlers. | Backend rejects with 403/WS error event. |
| Users can only see rooms they are members of | Client: `useChatRooms()` only returns joined rooms. Backend: all queries filter by userId. | Backend returns empty list (no error needed — user shouldn't know room exists). |
| Users cannot send messages to rooms they don't belong to | Client: room selection restricted to joined rooms. Backend: `verifyRoomAccess()` in every WS handler + REST endpoint. | Backend rejects with 404. |
| Cross-tenant data leak prevention | Client: `institutionId` derived from session, never from client input. Backend: `institutionId` filter on every query. | Backend returns empty results for queries from wrong tenant. |
| Guardians cannot create rooms | Client: `canCreateDirectRooms` capability flag is false. "New message" button hidden. Backend: CASL denies `ChatRoom` creation for GUARDIAN role. | Backend returns 403 Forbidden. |
| File upload validation | Client: accept JPEG/PNG/GIF/PDF only, max 10MB. Backend: MIME type validation + size limit enforced before MinIO storage. | Backend rejects with 400. |

### 17.3 JWT Handling for WebSocket

The Socket.IO connection authenticates via JWT in the `auth` handshake:

```typescript
const socket = io(`${WS_URL}/chat`, {
  auth: { token: session.accessToken },
  transports: ['websocket'],
});
```

The backend verifies the JWT signature in `ChatGateway.handleConnection`. If invalid or expired, the connection is rejected with a `connect_error`.

**Token refresh flow:**

1. WS detects `connect_error` with 401 status
2. Frontend triggers NextAuth session refresh (`getSession()` forces a new session if refresh token is valid)
3. New socket connection with fresh JWT
4. Re-join rooms, refetch rooms + unread

### 17.4 Data Exposure Prevention

| What NOT to do | Why |
|----------------|-----|
| Log WS event payloads in production | May contain PII (message content, names) |
| Store JWTs in localStorage | NextAuth manages tokens via HttpOnly cookies |
| Render `dangerouslySetInnerHTML` for message content | Message content is plain text — no HTML rendering needed |
| Pass `institutionId` from URL params | Must always come from `session.user.institutionId` |

---

## 18. Multi-Tenancy Considerations

### 18.1 Tenant Context Derivation

All tenant context is derived from the session, never from client input:

```typescript
const { data: session } = useAppSession();
const institutionId = session?.user.institutionId;
```

### 18.2 Room Scoping

- Every `ChatRoom` belongs to exactly one institution (`ChatRoom.institutionId`)
- `useChatRooms()` automatically returns only rooms where the user is a member (membership implies same-institution)
- No cross-institution room listing possible
- `SUPER_ADMIN` sees rooms across institutions (membership-only filter, no institutionId filter)

### 18.3 Course Room Isolation

Course rooms (`ChatRoom.courseId != null`) are only accessible to:

- Teachers assigned to the course
- Students enrolled in the course
- Institution ADMIN/DIRECTOR/SECRETARY
- Guardians of enrolled students (via `InstitutionChatPolicy`)

### 18.4 SUPER_ADMIN Frontend Behavior

`SUPER_ADMIN` users have `institutionId: null`. The chat frontend should:

- Still load `ChatLayout` normally (no special SUPER_ADMIN chat interface)
- `useChatRooms()` returns all rooms where the user is a member (across institutions)
- Room display should include institution identification (name/abbreviation)
- No special chat creation capabilities beyond those of normal roles

### 18.5 File Storage Tenant Isolation

Attachment URLs returned by the backend already include institution-scoped MinIO paths:

```
chat/{institutionId}/{uuid}-filename.pdf
```

The frontend treats attachment URLs as opaque strings — no path manipulation or tenant extraction.

---

## 19. Role-Based Capability Mapping

### 19.1 Capability Table

| Capability | ADMIN | DIRECTOR | SECRETARY | PRECEPTOR | TEACHER | GUARDIAN |
|---|---|---|---|---|---|---|
| Send messages | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read messages | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Send attachments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (basic) |
| Create direct rooms | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create group rooms | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Add participants | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Remove participants | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Cross-room search | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Export conversation | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| View read receipts | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| View presence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Room management | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Finalize conversation | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

### 19.2 How Capabilities Are Derived

```typescript
function deriveCapabilities(role: string, policy: InstitutionChatPolicy): ChatCapabilities {
  // Start from most restrictive
  const caps: ChatCapabilities = {
    canSendMessages: true,
    canSendAttachments: true,
    canCreateDirectRooms: true,
    canCreateGroupRooms: true,
    canAddParticipants: true,
    canRemoveParticipants: false,
    canSearchMessages: true,
    canExportConversation: false,
    canViewReadReceipts: true,
    canViewPresence: true,
    canViewRoomManagement: false,
    canFinalizeConversation: false,
  };

  // Role-based restrictions
  if (role === 'GUARDIAN') {
    caps.canCreateDirectRooms = false;
    caps.canCreateGroupRooms = false;
    caps.canAddParticipants = false;
    caps.canExportConversation = false;
    caps.canViewReadReceipts = false;
    caps.canViewRoomManagement = false;
    caps.canFinalizeConversation = false;
  }

  if (role === 'PRECEPTOR') {
    caps.canCreateGroupRooms = false;
    caps.canRemoveParticipants = true;
    caps.canExportConversation = false;
    caps.canViewRoomManagement = true;
  }

  if (role === 'TEACHER') {
    caps.canRemoveParticipants = false;
    caps.canExportConversation = false;
    caps.canViewRoomManagement = false;
    caps.canFinalizeConversation = false;
  }

  // Policy overrides (backend remains authoritative)
  // Guardians can message teachers only if policy.guardiansCanMessageTeachers
  // This is enforced server-side; the frontend merely reflects the expected UX

  return caps;
}
```

### 19.3 Capability Context Usage

```typescript
// In shared components — NO role === 'GUARDIAN' conditionals
function NewMessageButton() {
  const { capabilities } = useChatCapabilities();
  if (!capabilities.canCreateDirectRooms) return null;
  return <Button onClick={...}>Nuevo mensaje</Button>;
}
```

### 19.4 Important Caveat

> Capabilities control what UI is rendered. They are NOT authorization.
> A determined user could bypass client-side capability checks (e.g., send a raw API request).
> The backend `InstitutionChatPolicy` + CASL rules prevent unauthorized actions regardless of frontend state.

---

## 20. Guardian-Specific UX Considerations

### 20.1 Design Intent

The guardian chat experience is a **distinct UX domain** with reduced interface complexity. Guardians interact with the institution through chat, not as system administrators.

### 20.2 What Guardians Can Do

| Action | Implementation |
|--------|---------------|
| View conversations | Full shared `RoomList` + `MessageList` |
| Send/receive messages | Full shared `MessageInput` (text only, basic attachments) |
| Unread indicators | Full shared `UnreadBadge` + room-level unread count |
| Realtime updates | Full shared WebSocket pipeline (new messages, typing, presence) |
| Basic attachment support | `AttachmentUploader` with file type/size limits (images only, < 5MB) |
| Conversation search | Full shared `ChatSearch` |

### 20.3 What Guardians Cannot Do

| Action | Why |
|--------|-----|
| Create conversations | Rooms are created by teachers/admin. Guardian can only reply to existing conversations. |
| Add participants | Room management is admin/teacher-only |
| Group room creation | Guardians only participate in existing group rooms (e.g., course parent groups) |
| Export/PDF | Export is an administrative action |
| Finalize conversations | Moderation is admin-only |
| View read receipts | Privacy consideration — guardians see sent/delivered status only |

### 20.4 Guardian Room Visibility

Guardians see only:

1. Direct conversations with teachers/admin they've been added to
2. Course group rooms where their children are enrolled (if enabled by `InstitutionChatPolicy`)

### 20.5 Route Group Independence

The guardian chat lives under `/guardian/chat/*` with its own layout:

```
/guardian/chat            → simplified room list
/guardian/chat/[roomId]   → standard message view with reduced capabilities
```

The guardian layout (`guardian/layout.tsx`) wraps `AppLayout` with a **guardian-specific navigation** that does not include admin features (users, courses, grades, etc.). Only chat, profile, and notifications.

### 20.6 Future Mobile Considerations

The guardian chat UX is designed with future mobile adaptation in mind:

- Minimal interface complexity maps naturally to mobile
- No admin actions to port
- Shared WS infrastructure works identically on mobile React Native
- Attachment restrictions align with mobile camera/gallery picker

---

## 21. Future Considerations

### 21.1 Virtualization

When message count per room consistently exceeds 200, implement virtualization:

- Library candidate: `@tanstack/react-virtual` (already in dependency tree via shadcn/ui)
- Required: stable message height measurement, scroll anchor preservation, optimistic update integration
- Migration path: swap the simple scroll container in `MessageList` for a virtualized container. The `MessageBubble` component API stays identical.

### 21.2 Offline Support

Future: register a Service Worker that intercepts REST mutations and queues them when offline:

```typescript
// Conceptual — not for v1
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/chat/messages') && !navigator.onLine) {
    event.respondWith(new Response(null, { status: 202 }));
    // Queue for retry when online
    queueMessage(event.request.clone());
  }
});
```

Offline support requires:

- IndexedDB-backed message cache for display without network
- Queued mutation replay on reconnect
- Conflict resolution for messages sent while offline

### 21.3 Message Threading

Future: allow replies to specific messages, creating thread branches. This would require:

- `ChatMessage.parentId` field in Prisma schema
- Thread view component (toggleable inline view vs. side panel)
- WS event for thread updates
- Sort consideration: threaded messages appear inline after parent or in a separate view

### 21.4 Emoji Reactions

Future: allow emoji reactions on messages:

- Requires new `ChatMessageReaction` model (`messageId, userId, emoji`)
- WS event `messageReaction` broadcast
- UI: inline emoji picker on message hover, reaction bar below message

### 21.5 Read Receipt Detail

Current: `readBy: string[]` (list of user IDs who read).
Future: expand to `readBy: User[]` with `readAt` timestamp for detailed receipt UX (admin/teacher only).

### 21.6 Delete Messages

Future: message deletion (soft delete, content nullification):

- WS event `messageDeleted`
- UI: "Message deleted" placeholder
- Delete for self vs. delete for everyone

### 21.7 Group Room Management

Future: edit group rooms after creation:

- Add/remove members
- Rename group
- Leave group

### 21.8 Moderation Queue

The `requireModerationForNewRooms` policy flag exists but is not enforced. Future:

- Rooms created with `moderation: 'pending'` status
- ADMIN/DIRECTOR review queue
- WS event `roomApproved` / `roomRejected`

### 21.9 Mobile React Native

Future parent-facing mobile app:

- Reuse same REST API endpoints
- Same WebSocket namespace (`/chat`) and event contract
- Same authentication flow (JWT from login)
- Same optimistic update strategy
- Different rendering layer (React Native instead of React DOM)

The shared infrastructure design makes this migration path straightforward: `ChatSocketProvider`, `useChatSocket`, and the cache architecture are all platform-agnostic.

---

## 22. Glossary

| Term | Definition |
|------|-----------|
| **Capability-aware rendering** | UI components that read capability flags from context to decide what to render, avoiding `role === 'X'` conditionals |
| **ChatCapabilities** | A set of boolean flags derived from user role + `InstitutionChatPolicy` that controls UI rendering |
| **ChatSocketProvider** | React context provider managing Socket.IO lifecycle, scoped to chat routes |
| **Cache patch** | Direct mutation of React Query cache data via `setQueryData`, triggered by a WS event |
| **Optimistic message** | A message rendered immediately after the user presses Send, before server confirmation |
| **tempId** | Client-generated UUID prefixed with `optm-` used to identify optimistic messages before server assignment |
| **WS echo** | A WebSocket event sent back to the message sender confirming the message was persisted |
| **Event deduplication** | Ignoring a WS event if the message `id` already exists in the cache |
| **SSOT** | Single Source of Truth — the REST API + database are authoritative |
| **Reconciliation** | The process of correcting optimistic renders with server-authoritative data |
| **Presence** | Online/offline status tracked via Redis SETs with 5-minute TTL |
| **Heartbeat** | WS event sent every 30-60 seconds by the client to maintain presence TTL |
| **InstitutionChatPolicy** | Per-institution configuration controlling role-to-role messaging permissions |
| **Cursor pagination** | Offset-less pagination using a `cursor` (message `sentAt` or `id`) to fetch older/newer pages |
| **Guardian route group** | The `/guardian/*` route group providing a distinct UX domain for parent users |

---

## Appendix: Key File References

| File | Relevance |
|------|-----------|
| `frontend/src/lib/api/chat.ts` | Existing REST hooks to extend with WS bridge |
| `frontend/src/lib/api.ts` | Axios client — JWT injection, ON_LEAVE blocking |
| `frontend/src/lib/auth.ts` | NextAuth config — session includes `accessToken` for WS auth |
| `frontend/src/lib/hooks/use-app-session.ts` | Session access hook (5-min cache) |
| `frontend/src/lib/hooks/use-is-on-leave.ts` | ON_LEAVE check for mutation gating |
| `frontend/src/components/layouts/app-layout.tsx` | Shared layout wrapping all authenticated routes |
| `frontend/src/components/layouts/navigation.ts` | Nav arrays — add chat entries |
| `frontend/src/components/notification-bell.tsx` | Notification bell — already handles `CHAT` type |
| `frontend/src/components/providers.tsx` | Root providers — React Query, Session |
| `docs/CHAT.md` | Backend chat architecture (WS events, REST endpoints, presence, rate limits) |
| `docs/engineering/frontend-patterns.md` | Frontend conventions (React Query, state ownership, component patterns) |
| `docs/engineering/security-practices.md` | Frontend security rules |
| `docs/AUTH.md` | JWT flow, token refresh |
| `docs/MULTITENANCY.md` | Tenant-safe rendering |
| `docs/INFRASTRUCTURE.md` | Redis pub/sub adapter, WS scaling, container topology |
| `backend/src/modules/chat/chat.gateway.ts` | WS event contract (server → client, client → server) |
| `backend/src/modules/chat/chat.service.ts` | Business logic reference |
| `backend/src/modules/chat/chat-presence.service.ts` | Redis presence operations |
| `backend/src/modules/chat/dto/chat.dto.ts` | Zod DTOs matching frontend interfaces |
