# EduSystem Chat Frontend — Implementation Plan

> **Version:** 1.0 | **Platform:** EduSystem SaaS Educational Management Platform | **Last updated:** 2026-05-22
> **Status:** Planning — Execution reference for frontend chat implementation
> **Audience:** Frontend engineers, AI coding agents, code reviewers, future maintainers

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Implementation Philosophy](#2-implementation-philosophy)
3. [Delivery Strategy](#3-delivery-strategy)
4. [High-Level Phase Roadmap](#4-high-level-phase-roadmap)
5. [Phase 1 — Chat Foundation](#5-phase-1--chat-foundation)
6. [Phase 2 — Realtime Core](#6-phase-2--realtime-core)
7. [Phase 3 — Presence & Typing](#7-phase-3--presence--typing)
8. [Phase 4 — Attachments](#8-phase-4--attachments)
9. [Phase 5 — Advanced UX](#9-phase-5--advanced-ux)
10. [Phase 6 — Guardian Experience](#10-phase-6--guardian-experience)
11. [Phase 7 — Hardening & Optimization](#11-phase-7--hardening--optimization)
12. [Testing Strategy](#12-testing-strategy)
13. [Failure Recovery Strategy](#13-failure-recovery-strategy)
14. [Observability & Debugging](#14-observability--debugging)
15. [Definition of Done](#15-definition-of-done)
16. [Future Expansion Boundaries](#16-future-expansion-boundaries)
17. [Reference Alignment](#17-reference-alignment)

---

## 1. Purpose

### 1.1 Why Phased Implementation Is Required

The chat frontend touches every architectural layer: routing, layout, component composition, REST API integration, React Query caching, WebSocket lifecycle, presence management, file uploads, and role-specific rendering. Shipping all of this in a single pass produces an unmergeable PR with high regression risk across multiple unrelated modules.

Seven phases decompose the work into independently verifiable increments. Each phase adds one architectural capability while keeping the system deployable and testable at every step.

### 1.2 Why Realtime Is Introduced Progressively

WebSocket introduces the hardest failure modes in this frontend:
- Out-of-order event delivery
- Stale cache patches
- Reconnect storms under flaky networks
- Race conditions between WS events and REST responses
- Listener accumulation across component mounts

These failure modes cannot be debugged reliably when mixed with initial component scaffolding, pagination logic, and cache configuration. Phase 1 validates every REST path, every cache invalidation, and every UI state (loading, empty, error, populated) before a single socket handler is written.

### 1.3 Institutional-System vs Consumer-Chat Priorities

| Priority | Institutional (EduSystem) | Consumer Chat |
|----------|--------------------------|---------------|
| Correctness | Message order matches DB commit order | Instant delivery perceived as correct |
| Resilience | Works correctly without WS | Requires WS for core function |
| State ownership | Single authoritative cache (React Query) | Multiple stores (Redux, local, WS) |
| Tenant safety | Zero cross-tenant data exposure | No tenant concept |
| Maintainability | Predictable patterns across 3 role groups | Single UX paradigm |
| Feature velocity | Phased, verifiable increments | Ship-fast, iterate |

**This distinction drives every decision in this plan.**

---

## 2. Implementation Philosophy

### 2.1 REST-First Validation

All UI flows must work correctly via REST before any WebSocket synchronization is added. A user can send messages, receive them (via polling), see rooms, and manage conversations using only HTTP. WebSocket is a progressive enhancement that reduces latency, not a requirement for core functionality.

### 2.2 React Query as Single Server-State Layer

There is exactly one cache for server data: React Query. WebSocket events never populate a separate store — they patch the React Query cache directly. This means:
- No Zustand for chat server state (per `frontend-patterns.md` §9)
- No `useState` for messages, rooms, or unread counts
- No local storage cache
- WS → RQ bridge is a thin patching layer, not a state-management system

### 2.3 Backend-Authoritative Synchronization

The REST API + PostgreSQL are the single source of truth. WebSocket events are synchronization hints. The database commit order is the authoritative sort order for messages. WS arrival order is never trusted for ordering decisions.

### 2.4 No Duplicated Ownership

| State Category | Owner | Justification |
|---------------|-------|---------------|
| Server state (rooms, messages, unread) | React Query cache | Single source of truth, cache dedup, invalidation |
| Ephemeral WS state (typing, presence) | `useState` in consuming component | Lost on navigation — no persistence needed |
| Socket instance | `useRef` in ChatSocketProvider | Never causes re-render on reference change |
| UI state (compose text, dialog open) | `useState` in component | Scoped, short-lived |
| Capability flags | React context (ChatCapabilitiesProvider) | Derived from role + policy, cached for session |

### 2.5 Progressive Enhancement Strategy

| Layer | Phase | Behavior Without Layer |
|-------|-------|----------------------|
| REST API | 1 | Nothing works — core dependency |
| React Query cache | 1 | Nothing works — core dependency |
| WebSocket | 2 | Messages arrive via REST polling (staleTime fallback) |
| Presence | 3 | No online indicators — no data loss |
| Typing | 3 | No typing indicators — no data loss |
| Attachments | 4 | Text-only messaging |

### 2.6 Isolated Failure Domains

| Failure | Affects | Does NOT Affect |
|---------|---------|----------------|
| WS disconnect | Typing, presence, realtime latency | Message sending (REST), message receipt (REST polling) |
| File upload failure | Single attachment | Current text message, other messages |
| Presence service down | Online indicators | Any persisted state |
| React Query cache corruption | Single query key | Other cache keys, WS connection |

---

## 3. Delivery Strategy

### 3.1 Vertical Slices

Each phase delivers a complete feature increment:
```
Route file → Layout/Provider → Components → React Query hooks → Cache keys → Tests
```

No phase leaves dangling code, incomplete handlers, or placeholder routes.

### 3.2 Independent Milestones

| Boundary | Phase | What Makes It Independent |
|----------|-------|--------------------------|
| REST-only UI | 1 | No socket imports, no WS deps |
| WS sync | 2 | ChatSocketProvider is additive — removing it returns to Phase 1 |
| Presence | 3 | Fully ephemeral — zero DB impact |
| Attachments | 4 | New Mutation hook for upload — no existing code modified |
| Guardian | 6 | New route group — existing routes untouched |

### 3.3 Rollback-Safe Implementation

Every phase is designed for single-file or single-component rollback:
- Phase 1 files are all additive (new routes under `/admin/chat`, `/teacher/chat`)
- Phase 2 wraps in `ChatSocketProvider` — removing the provider from `ChatLayout` restores Phase 1
- Phase 3 `TypingIndicator` is a single component import — remove it from `MessageList`
- Phase 4 `AttachmentUploader` is a single component — remove it from `MessageInput`
- Phase 6 guardian routes are a new group under `/guardian/` — no existing routes touched

### 3.4 Validation Gates Between Phases

Before moving to Phase N+1:

1. All acceptance criteria for Phase N are met
2. No known regressions in Phase N behavior
3. Test suite passes (unit + integration)
4. Code review completed against `docs/engineering/code-review-checklist.md`
5. `npm run lint` and `npm run typecheck` pass with zero new warnings

---

## 4. High-Level Phase Roadmap

| Phase | Objective | Core Deliverables | Dependencies | Risk | Acceptance Criteria |
|-------|-----------|-------------------|--------------|------|-------------------|
| **1** | Chat Foundation | Routes, ChatLayout, RoomList, MessageList, MessageInput, NewMessageDialog, React Query hooks (rooms, messages, unread), pagination, loading/error/empty states, responsive layout | Backend `/chat/*` REST endpoints operational | Low | All REST flows work; zero socket imports; zero optimistic code |
| **2** | Realtime Core | ChatSocketProvider, Socket.IO lifecycle, WS→RQ cache bridge (newMessage, messagesRead), reconnect logic, connection status UI | Phase 1 + Backend Socket.IO `/chat` gateway | Medium | Messages sync < 2s across tabs; reconnect recovers state; no duplicate events |
| **3** | Presence & Typing | TypingIndicator component, debounced typing emit (300ms), typing timeout (5s), userOnline/userOffline WS handlers, presence dots in RoomList, heartbeat emit (30s) | Phase 2 + Backend presence events + heartbeat handler | Low-Med | Typing shows/hides within debounce bounds; presence updates within 5s |
| **4** | Attachments | AttachmentUploader, AttachmentPreview, file validation (MIME + size), MinIO upload via REST, attachment rendering in MessageBubble, upload failure retry | Phase 2 + Backend `POST /chat/attachments/upload` + MinIO bucket | Medium | Files upload and render; invalid files rejected; retry works |
| **5** | Advanced UX | ChatSearch dialog, finalized conversation styling, PDF export, room type filtering, unread "99+" cap, scroll restoration refinement | Phase 2 + Backend `GET /chat/messages/search` | Low | Search returns results; export produces valid PDF; scroll survives room switch |
| **6** | Guardian Experience | `/guardian/chat` routes, guardian layout + navigation, ChatCapabilitiesProvider, capability-gated rendering, mobile-first guardian layout | Phase 2 + Backend `GET /chat/policy` | Low | Guardian sees only allowed actions; mobile layout functional |
| **7** | Hardening & Optimization | Rerender audit with React.memo boundaries, WS listener cleanup verification, memory leak review, stale cache audit, reconnect stress testing, duplicate event audit | All previous phases | Medium | No memory leaks over 30min; no duplicate handlers after 10 reconnects; 500 messages at 60fps |

---

## 5. Phase 1 — Chat Foundation

### 5.1 Objective

Deliver a fully functional REST-based chat UI with pagination, loading/error/empty states, and responsive layout. No WebSocket, no optimistic updates, no typing indicators, no presence.

### 5.2 Scope

#### 5.2.1 Routes

| Route | File | Description |
|-------|------|-------------|
| `/admin/chat` | `src/app/admin/chat/page.tsx` | Room list with redirect to first room or empty state |
| `/admin/chat/[roomId]` | `src/app/admin/chat/[roomId]/page.tsx` | Active conversation |
| `/teacher/chat` | `src/app/teacher/chat/page.tsx` | Room list (teacher-scoped) |
| `/teacher/chat/[roomId]` | `src/app/teacher/chat/[roomId]/page.tsx` | Active conversation (teacher) |

#### 5.2.2 Components

| Component | File | Responsibility |
|-----------|------|---------------|
| `ChatLayout` | `components/chat/chat-layout.tsx` | Sidebar + main panel layout, responsive split, mounts providers (Phase 2+), single `'use client'` boundary |
| `RoomList` | `components/chat/room-list.tsx` | Paginated room list, unread badges, active room highlight, search filter |
| `MessageList` | `components/chat/message-list.tsx` | Cursor-paginated messages, auto-scroll to bottom, "Load older" at top, date separators |
| `MessageInput` | `components/chat/message-input.tsx` | Text area + send button, disabled when empty or ON_LEAVE |
| `ChatHeader` | `components/chat/chat-header.tsx` | Room name, member count (static placeholder for online count) |
| `ChatEmptyState` | `components/chat/chat-empty-state.tsx` | Illustration + "No hay conversaciones" / "No hay mensajes" |
| `NewMessageDialog` | `components/chat/new-message-dialog.tsx` | Create DIRECT or GROUP room with user search |
| `UnreadBadge` | `components/chat/chat.types.ts` | Shared type, rendered inline in nav and RoomList |
| `chat.types.ts` | `components/chat/chat.types.ts` | All shared interfaces, types, capability flags |

#### 5.2.3 React Query Hooks

| Hook | File | Query Key | staleTime | refetchInterval | refetchIntervalInBackground | refetchOnWindowFocus |
|------|------|-----------|-----------|----------------|----------------------------|---------------------|
| `useChatRooms` | `hooks/chat/use-chat-rooms.ts` | `['chat', 'rooms']` | 0 | 10s | false | true |
| `useChatRoom` | `hooks/chat/use-chat-room.ts` | `['chat', 'rooms', roomId]` | 0 | 10s | false | true |
| `useChatMessages` | `hooks/chat/use-chat-messages.ts` | `['chat', 'messages', roomId]` | 0 | 5s | false | true |
| `useChatUnreadCount` | `hooks/chat/use-chat-unread.ts` | `['chat', 'rooms', 'unread']` | 0 | 10s | false | true |
| `useCreateChatRoom` | `hooks/chat/use-create-room.ts` | Mutation — invalidates `['chat', 'rooms']` | — | — | — | — |
| `useSendChatMessage` | `hooks/chat/use-send-message.ts` | Mutation — invalidates `['chat', 'messages', roomId]` + `['chat', 'rooms']` | — | — | — | — |
| `useMarkChatMessagesRead` | `hooks/chat/use-mark-read.ts` | Mutation — invalidates `['chat', 'messages', roomId]` + `['chat', 'unread']` | — | — | — | — |

**Migration to `useInfiniteQuery`:** `useChatMessages` uses `useInfiniteQuery` instead of `useQuery`. The backend cursor maps to `getNextPageParam`, and the `MessageList` component flattens + sorts pages:

```typescript
// use-chat-messages.ts — useInfiniteQuery approach
export function useChatMessages(roomId: string, limit = 50) {
  return useInfiniteQuery({
    queryKey: ['chat', 'messages', roomId],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (pageParam) params.set('before', pageParam);
      const res = await api.get(`/chat/rooms/${roomId}/messages?${params}`);
      return res.data as MessagesResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: !!roomId,
    staleTime: 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
```

**No UUID lexical tiebreaker:** Message sorting trusts backend order exclusively — sort comparator never falls back to `a.id.localeCompare(b.id)`:

```typescript
// CORRECT — sort only by sentAt
.sort((a, b) => a.sentAt.localeCompare(b.sentAt))
```

#### 5.2.4 Navigation Entries

Add chat entries to `src/components/layouts/navigation.ts`:

| Nav Array | Entry | Position |
|-----------|-------|----------|
| `adminNav` | `{ name: 'Chat', href: '/admin/chat', icon: MessageCircle }` | After Comunicados |
| `preceptorNav` | `{ name: 'Chat', href: '/admin/chat', icon: MessageCircle }` | After Comunicados |
| `teacherNav` | `{ name: 'Chat', href: '/teacher/chat', icon: MessageCircle }` | After Pendientes |

### 5.3 Non-Goals

The following are **intentionally excluded** from Phase 1. Each exclusion includes rationale.

| Excluded | Rationale |
|----------|-----------|
| **WebSocket** | Foundation correctness must be validated before synchronization complexity. Socket code = 0 lines. |
| **Optimistic updates** | `tempId` lifecycle (generation → display → replacement → dedup) adds cognitive load without REST validation first. Messages appear after REST response — acceptable in Phase 1. |
| **ChatSocketProvider** | No socket lifecycle, no reconnect handling, no WS→RQ bridge. |
| **Typing indicators** | Ephemeral state with debounce, timeout, and cleanup — a separate concern from core message rendering. |
| **Presence / online status** | Requires Redis presence service and WS heartbeat — not available in Phase 1. |
| **Attachments** | Requires MinIO integration, upload endpoint, presigned URL flow. |
| **Virtualization** | Deferred to Phase 7 or later — simple scroll container with cursor pagination (50-message page limit). See §16.1 for evaluation criteria and migration path. |
| **UUID lexical tiebreaker** | Message sort uses `sentAt` only. UUID v4 is not temporally ordered — `a.id.localeCompare(b.id)` has no correlation with creation order. Backend `ORDER BY sentAt` + stable sort (ES2019+) is authoritative. |
| **Guardian routes** | Guardian route group deferred to Phase 6. |
| **Search** | Cross-room search deferred to Phase 5. |
| **Export** | PDF export deferred to Phase 5. |

### 5.4 Dependencies

| Dependency | Details |
|-----------|---------|
| Backend REST endpoints | `GET /chat/rooms`, `GET /chat/rooms/:id`, `GET /chat/rooms/:roomId/messages`, `POST /chat/rooms`, `POST /chat/messages`, `POST /chat/messages/read`, `GET /chat/rooms/unread` |
| Frontend infrastructure | `AppLayout`, `useAppSession`, `useIsOnLeave`, singleton `api` Axios instance |
| React Query | Already configured in `QueryClientProvider` |
| shadcn/ui primitives | `Button`, `Input`, `Dialog`, `Sheet`, `Skeleton`, `Avatar`, `Badge`, `ScrollArea` |

### 5.5 Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Backend endpoint contract mismatch | Medium | Define typed interfaces before implementation; validate against `docs/CHAT.md` §3 endpoint reference |
| Pagination cursor format unclear | Low | Backend returns `nextCursor` as room ID (rooms) or ISO datetime (messages) |
| Responsive layout breaks on mobile (< 768px) | Medium | Test at 320px, 768px, 1024px, 1440px; sidebar uses `Sheet` (drawer) below 768px |
| Missing empty states in edge cases | Low | Cover: no rooms, no messages, no search results, API error |

### 5.6 Acceptance Criteria

- [ ] User sees list of their chat rooms on navigating to `/admin/chat`
- [ ] Room list shows last message preview, timestamp, unread badge per room
- [ ] Clicking a room loads messages with cursor-based pagination ("Ver mensajes anteriores" at top)
- [ ] User can send a text message via `MessageInput` → message appears after REST 201 response
- [ ] User can create a DIRECT room with another user via `NewMessageDialog`
- [ ] User can create a GROUP room with multiple participants
- [ ] Unread badges show per-room in RoomList and total in navigation sidebar
- [ ] Loading skeleton shown during initial fetch (6 placeholder room items, 5 placeholder messages)
- [ ] Error state with "Reintentar" button on API failure
- [ ] Empty state with "No hay conversaciones" when no rooms exist
- [ ] ON_LEAVE user sees disabled send button with tooltip
- [ ] Responsive: sidebar collapses to drawer on < 768px
- [ ] Room search filter filters by room name / participant name
- [ ] Zero WebSocket code — no `socket.io-client` imports
- [ ] Zero optimistic update code — no `tempId` logic
- [ ] All cache invalidations fire correctly on mutations
- [ ] `npm run lint` and `npm run typecheck` pass with zero new warnings

### 5.7 Testing Requirements

| Test Type | Target | Verification |
|-----------|--------|-------------|
| Unit | `useChatRooms` | Query key `['chat', 'rooms']`, enabled condition, staleTime 30s |
| Unit | `useSendChatMessage` | Mutation invalidates `['chat', 'messages', roomId]` and `['chat', 'rooms']` on success |
| Unit | `useMarkChatMessagesRead` | Mutation invalidates `['chat', 'messages', roomId]` and `['chat', 'unread']` on success |
| Unit | `MessageList` | Pagination prepend (verify scroll anchor), auto-scroll to bottom on new message, "Load older" trigger |
| Unit | `RoomList` | Unread badge display, room ordering by `lastMessageAt`, search filter |
| Unit | `MessageInput` | Button disabled when text empty; button disabled when ON_LEAVE |
| Integration | Route navigation | `/admin/chat` loads ChatLayout → RoomList renders; clicking room → MessageList renders |
| Integration | Mutation → invalidation chain | `useSendChatMessage` success → `['chat', 'messages', roomId]` refetches |

### 5.8 Rollback Strategy

All Phase 1 files are additive:
- Routes under `/admin/chat/` and `/teacher/chat/` — 4 new route files
- Components under `components/chat/` — 10 new component files
- Hooks under `hooks/chat/` — 7 new hook files
- API layer in `lib/api/chat.ts` — refactored (pure API functions, no hooks)
- Navigation entries in `navigation.ts` — 3 additive array entries
- Plan document — `docs/chat-frontend-implementation-plan.md` (documentation only)

**Total: 23 new files** (22 source files + 1 plan document), **2 modified** (navigation.ts, chat.ts).

To roll back: remove navigation entries → chat routes become unreachable. Remove component/hook/chat directories → no orphaned code.

### 5.9 Known Phase 1 Limitations

The following limitations are **intentionally deferred** to later phases. They are not bugs — they are architectural boundaries scoped out of Phase 1 to maintain mergeability and testability.

| Limitation | Deferred To | Rationale |
|-----------|-------------|-----------|
| **No realtime transport** | Phase 2 | REST polling provides eventual consistency (rooms 10s, messages 5s). WebSocket adds reconnect, listener lifecycle, WS→RQ bridge complexity. |
| **No virtualization** | Phase 7 | Message volumes are low (< 200 messages per conversation). Virtualization adds dynamic height measurement, scroll offset remapping complexity. |
| **No optimistic updates** | Phase 2 | `tempId` lifecycle (generation → display → replacement → dedup) requires WS echo for reliable replacement. Without WS, optimistically inserted messages duplicate on refetch. |
| **No incoming-message auto-scroll** | Phase 2 | Without WS, polling-based auto-scroll fights user scroll position. Phase 2 WS handler patches cache + triggers conditional scroll. |
| **Full-query invalidation after send** | Phase 2 | `invalidateQueries` on `['chat', 'messages', roomId]` refetches all infinite query pages. Phase 2 WS echo patches the first page directly, making re-fetch unnecessary. |
| **Backend-authoritative room ordering** | N/A (by design) | Rooms are ordered by backend `ORDER BY lastMessageAt DESC`. Frontend never re-sorts client-side to avoid divergence from backend state. |
| **No client-side room type filtering** | Phase 5 | Room type filter ("Todos", "Directo", "Grupal") adds UI complexity without backend sorting support in Phase 1. |
| **`ChatHeader` lacks error/404 state** | Phase 5 | 403/404 on individual room is an edge case that doesn't crash the app. Error is surfaced via `MessageList` error state. |

---

## 6. Phase 2 — Realtime Core

### 6.1 Objective

Add WebSocket connectivity for real-time message synchronization and unread count updates. The socket lifecycle is scoped to chat routes only (mount = connect, unmount = disconnect).

### 6.2 Scope

#### 6.2.1 Components

| Component | File | Responsibility |
|-----------|------|---------------|
| `ChatSocketProvider` | `components/chat/chat-socket-provider.tsx` | Socket.IO lifecycle: JWT auth handshake, connect, disconnect, reconnect (10 attempts, exp backoff 1s→16s), connection state |
| `useChatSocket` hook | `components/chat/chat-socket-provider.tsx` | Context consumer returning `{ socket, connected }` |
| ChatSocketContext | `components/chat/chat-socket-provider.tsx` | React context with socket instance + connection status |

#### 6.2.2 WS → RQ Cache Bridge

Located in `ChatSocketProvider` — registers event listeners on socket connect:

```typescript
// newMessage handler
function handleNewMessage(message: ChatMessage) {
  queryClient.setQueryData(['chat', 'messages', message.roomId], (old) => {
    if (!old) return { messages: [message], nextCursor: undefined, hasMore: false };
    if (old.messages.some(m => m.id === message.id)) return old; // dedup
    return { ...old, messages: [...old.messages, message].sort(bySentAt) };
  });
  queryClient.setQueryData(['chat', 'rooms'], (old) => {
    if (!old) return old;
    return { ...old, rooms: old.rooms.map(r =>
      r.id === message.roomId ? { ...r, lastMessageAt: message.sentAt } : r
    )};
  });
}

// messagesRead handler
function handleMessagesRead({ roomId, userId, messageIds }: MessagesReadPayload) {
  queryClient.setQueryData(['chat', 'messages', roomId], (old) => {
    if (!old) return old;
    return { ...old, messages: old.messages.map(m =>
      messageIds.includes(m.id) ? { ...m, readBy: [...(m.readBy || []), userId] } : m
    )};
  });
  queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
}
```

#### 6.2.3 Reconnect Handler

```typescript
socket.on('connect', () => {
  setConnected(true);
  // Refetch rooms + unread to reconcile missed events
  queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
  queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
  // Re-join active room
  if (activeRoomId) socket.emit('joinRoom', { roomId: activeRoomId });
});
```

#### 6.2.4 Connection Status UI

Small badge in `ChatHeader`:

| Status | UI |
|--------|-----|
| `connected === true` | No badge (or subtle green dot) |
| `connected === false` | Badge: "Reconectando..." with animated pulse |

### 6.3 Non-Goals

| Excluded | Rationale |
|----------|-----------|
| Typing indicators | Ephemeral state with debounce — separate concern in Phase 3 |
| Online presence | Requires Redis presence backend — Phase 3 |
| Heartbeat | Presence-only feature — Phase 3 |
| Optimistic reconciliation | Simple replace-by-id on WS echo; full reconciliation with tempId is a Phase 2+ enhancement |
| Out-of-order message handling | Sort by `sentAt` on every cache update — correct ordering always |

### 6.4 Dependencies

| Dependency | Details |
|-----------|---------|
| Backend Socket.IO gateway | `/chat` namespace with JWT auth handshake, events: `newMessage`, `messagesRead`, `invitedToRoom` |
| Backend Redis IoAdapter | Redis pub/sub for horizontal WS scaling |
| Frontend `socket.io-client` package | Must be in `package.json` — verify before implementation |
| Phase 1 | REST integration verified, all cache invalidations correct |

### 6.5 Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Socket connects before JWT available | Medium | Gate connection on `session.accessToken` being defined; useEffect dependency on `session?.accessToken` |
| Duplicate WS events (echo + REST) | Medium | Idempotent cache patch — check `message.id` before insert |
| Reconnect storms on network flapping | Low | Exponential backoff 1s→2s→4s→8s→16s; max 10 attempts |
| Token expiry during session | Medium | WS `connect_error` with 401 → Axios interceptor refreshes NextAuth session → socket reconnects with fresh JWT |
| Listener accumulation on reconnect | Medium | Remove old listeners before adding new ones in `useEffect` cleanup |

### 6.6 Acceptance Criteria

- [ ] Socket connects when entering `/admin/chat` and disconnects on navigating away
- [ ] New message from another user appears in real-time (no manual refresh needed)
- [ ] Own message sent from another browser tab appears in real-time
- [ ] Read receipts update in real-time when other user marks messages as read
- [ ] Connection status shows "Reconectando..." badge during disconnect
- [ ] After reconnect, rooms and unread counts are refreshed from REST
- [ ] Active room is re-joined (messages continue flowing after reconnect)
- [ ] No duplicate messages on WS echo + REST response
- [ ] No duplicate WS event handlers after multiple reconnect cycles
- [ ] Socket listener cleanup on `ChatLayout` unmount — no memory leaks
- [ ] `joinRoom` event emitted on room change

### 6.7 Testing Requirements

| Test Type | Target | Verification |
|-----------|--------|-------------|
| Unit | ChatSocketProvider | Connect/disconnect lifecycle; cleanup on unmount; reconnect exponential backoff |
| Unit | newMessage handler | Cache patch inserts message; dedup by `message.id`; room `lastMessageAt` updated |
| Unit | messagesRead handler | Cache patch updates `readBy` array; unread count invalidated |
| Integration | Two-tab sync | Tab A sends message → Tab B receives via WS within 2s |
| Integration | Reconnect recovery | Disconnect network → reconnection indicator → reconnect → rooms + unread refetched |
| Integration | Token expiry | Expire token → WS disconnect → new token issued → WS reconnects |

### 6.8 Rollback Strategy

Remove `ChatSocketProvider` from `ChatLayout`:
- `ChatLayout.tsx` wraps children in `<ChatSocketProvider>` — remove the wrapper
- Phase 1 REST-only behavior is fully restored
- All WS code lives in `chat-socket-provider.tsx` — single file to revert

---

## 7. Phase 3 — Presence & Typing

### 7.1 Objective

Add typing indicators and online presence using ephemeral WebSocket state. No data persistence — all state is lost on navigation or disconnect.

### 7.2 Ephemeral-State Philosophy

Typing indicators and presence are **never persisted to any cache or database**. They live in `useState` within the component that renders them and are cleaned up on unmount or timeout. This means:

- Loss of typing/presence state is **acceptable** — no data integrity impact
- Recovery from lost state is **automatic** — next WS event restores it
- No stale data concern — 5s timeout clears orphaned typing state

### 7.3 Scope

#### 7.3.1 Typing Indicator

| Component | File | Responsibility |
|-----------|------|---------------|
| `TypingIndicator` | `components/chat/typing-indicator.tsx` | Shows "X está escribiendo..." below MessageList |

**Debounce behavior:**

| Action | Timing | Detail |
|--------|--------|--------|
| Emit `typing` on keystroke | 300ms debounce | `setTimeout` resets on each keystroke; emits only after 300ms of inactivity |
| Emit `typing` with `isTyping: false` | 2s after last keystroke | Signals "stopped typing" |
| Clear typing state from received event | 5s timeout | Safety net: if `typing: false` event is lost, indicator clears after 5s |

```typescript
// Debounced typing emit in MessageInput
const typingTimeoutRef = useRef<NodeJS.Timeout>();
const handleTyping = useCallback(() => {
  clearTimeout(typingTimeoutRef.current);
  if (!typingEmitted.current) {
    socket.emit('typing', { roomId, isTyping: true });
    typingEmitted.current = true;
  }
  typingTimeoutRef.current = setTimeout(() => {
    socket.emit('typing', { roomId, isTyping: false });
    typingEmitted.current = false;
  }, 2000);
}, [roomId, socket]);
```

#### 7.3.2 Online Presence

| Component | Feature | Description |
|-----------|---------|-------------|
| `RoomList` | Presence dot | Green dot on `RoomListItem` avatar for online members |
| `ChatHeader` | Online count | "3 en línea" next to room name |

**Presence state management:**

```typescript
// Local state in MessageList / ChatLayout
const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

// WS handlers (registered in ChatSocketProvider or consumed via context)
socket.on('userOnline', ({ userId }) => {
  setOnlineUsers(prev => new Set(prev).add(userId));
});
socket.on('userOffline', ({ userId }) => {
  setOnlineUsers(prev => { const next = new Set(prev); next.delete(userId); return next; });
});
```

#### 7.3.3 Heartbeat

```typescript
// In ChatSocketProvider — emit heartbeat every 30s
useEffect(() => {
  if (!socket) return;
  const interval = setInterval(() => {
    socket.emit('heartbeat');
  }, 30000);
  return () => clearInterval(interval);
}, [socket]);
```

### 7.4 Non-Goals

| Excluded | Rationale |
|----------|-----------|
| Typing state in React Query | Ephemeral — never pollutes server cache |
| "X others are typing" aggregation | Single-user indication only in v1 |
| Read receipt counts | Deferred to Phase 5 |
| Presence across rooms (global online list) | Presence is per-room-member only |

### 7.5 Dependencies

| Dependency | Details |
|-----------|---------|
| Phase 2 | Socket lifecycle operational |
| Backend `userTyping` event | Server broadcasts `userTyping` to room members |
| Backend `userOnline` / `userOffline` events | Server broadcasts on connect/disconnect of last socket |
| Backend `heartbeat` handler | Refreshes Redis presence TTL |

### 7.6 Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Typing indicator never clears | Low | 5s safety timeout — if `isTyping: false` is lost, indicator auto-clears |
| Typing events flood network | Low | 300ms debounce + backend 1/500ms rate limit |
| Presence state leaks across rooms | Low | `onlineUsers` set is scoped to current room (reset on room change) |
| Heartbeat interval survives unmount | Medium | `clearInterval` in `useEffect` cleanup |

### 7.7 Acceptance Criteria

- [ ] "X está escribiendo..." shows when another user is typing in the same room
- [ ] Own typing is not displayed (filter by `senderId !== currentUserId`)
- [ ] Typing indicator clears within 5s of last keystroke from remote user
- [ ] Green dot appears in RoomList for online room members
- [ ] ChatHeader shows "N en línea" count
- [ ] Presence updates within 5s of user connecting/disconnecting
- [ ] Typing state is cleared on room switch
- [ ] Presence state is cleared on room switch
- [ ] No re-render of full MessageList on typing events (React.memo holds)

### 7.8 Testing Requirements

| Test Type | Target | Verification |
|-----------|--------|-------------|
| Unit | Debounce logic | `typing` emit fires at most once per 300ms window; cleanup on unmount |
| Unit | Typing timeout | Auto-clears after 5s without `isTyping: false` event |
| Unit | Presence dedup | `userOnline` for already-online user is no-op (Set dedup) |
| Integration | Two-tab different users | Type in Tab A → "X escribiendo" in Tab B |
| Integration | Presence lifecycle | Open chat → user shows online → close tab → user shows offline within 5s |

### 7.9 Rollback Strategy

- Remove `TypingIndicator` from `MessageList` → typing UX removed, Phase 2 behavior restored
- Remove presence dot from `RoomListItem` → presence UX removed
- No cache keys affected — all state is local `useState`

---

## 8. Phase 4 — Attachments

### 8.1 Objective

Enable file attachment sending in chat messages with MinIO storage, client-side validation, preview, and failure recovery.

### 8.2 Scope

#### 8.2.1 Components

| Component | File | Responsibility |
|-----------|------|---------------|
| `AttachmentUploader` | `components/chat/attachment-uploader.tsx` | File picker → MIME validation → REST `POST /chat/attachments/upload` → returns presigned URL |
| `AttachmentPreview` | `components/chat/attachment-preview.tsx` | Shows selected file thumbnail before send (image preview, PDF name) |
| Attachment button | `components/chat/message-input.tsx` | Paperclip icon button that triggers file picker |

#### 8.2.2 Upload Flow

```
1. User clicks attachment button → file picker opens
2. Client validates: MIME type (JPEG/PNG/GIF/PDF), size (< 10MB)
3. On valid: show AttachmentPreview with thumbnail
4. On invalid: toast error ("Tipo de archivo no permitido" / "El archivo excede 10MB")
5. User clicks Send:
   a. Upload file via POST /chat/attachments/upload (multipart)
   b. Backend returns { attachmentUrl: presigned URL }
   c. Send message with attachmentUrl via POST /chat/messages
6. On upload failure: show retry button on failed preview
```

#### 8.2.3 Validation

| Check | Client | Server |
|-------|--------|--------|
| MIME type whitelist | JPEG, PNG, GIF, PDF | Same list (redundant) |
| File size | < 10MB | < 10MB |
| Filename traversal | N/A (handled by backend UUID) | UUID prefix prevents traversal |

#### 8.2.4 MessageBubble Rendering

| Message Type | Rendering |
|-------------|-----------|
| `TEXT` | Text content (existing) |
| `IMAGE` | Inline image from presigned URL (< 800px width) |
| `FILE` | Download link with filename + icon |

### 8.3 Non-Goals

| Excluded | Rationale |
|----------|-----------|
| Optimistic upload | Upload must complete before message send — no tempId for files |
| Image lightbox | Full-screen image preview deferred |
| Drag-and-drop file upload | Additional UX complexity for Phase 4 |
| Multiple file selection | Single file per message in v1 |
| Voice notes | Future feature — separate infrastructure |
| Attachment download progress | File opens in new tab / downloads directly |

### 8.4 Dependencies

| Dependency | Details |
|-----------|---------|
| Backend `POST /chat/attachments/upload` | Returns presigned URL for attachment |
| MinIO bucket | `chat/` bucket with `{institutionId}/{uuid}-{filename}` path |
| Phase 2 | WS sync for attachment messages |

### 8.5 Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Large file blocks UI | Low | Async upload with loading spinner; 10MB limit limits impact |
| MIME type mismatch (client says JPEG, server rejects) | Low | Client whitelist matches server whitelist — synchronize on implementation |
| MinIO connectivity failure | Low | Error toast + retry button; message can still be sent as text-only |
| Upload succeeds but message send fails | Low | Uploaded file is orphaned — acceptable (no user-facing impact) |

### 8.6 Acceptance Criteria

- [ ] User can select a JPEG/PNG/GIF/PDF file → thumbnail preview shown
- [ ] User sends file → appears as inline image (IMAGE) or download link (FILE)
- [ ] Invalid MIME type shows error toast immediately
- [ ] File > 10MB shows size error toast immediately
- [ ] Upload failure shows retry button on the failed preview
- [ ] Attachment renders from presigned URL (not direct MinIO URL)
- [ ] Attachment stored at `chat/{institutionId}/{uuid}-{originalName}`
- [ ] Attachment URL is included in message content via REST

### 8.7 Testing Requirements

| Test Type | Target | Verification |
|-----------|--------|-------------|
| Unit | MIME validation | Whitelist accepts JPEG/PNG/GIF/PDF; rejects DOCX, EXE, HTML |
| Unit | Size validation | Accepts < 10MB; rejects >= 10MB |
| Integration | Upload → send | Upload file → receive presigned URL → send message with URL → message renders |
| Integration | Upload failure | Force upload error → retry button shown → retry succeeds |

### 8.8 Rollback Strategy

- Remove `AttachmentUploader` and `AttachmentPreview` from `MessageInput` → Phase 2 behavior restored
- Attachment rendering in `MessageBubble` is conditional on `message.type !== 'TEXT'`
- Upload hook in `lib/api/chat.ts` is a new export — no existing hooks modified

---

## 9. Phase 5 — Advanced UX

### 9.1 Objective

Add cross-room message search, conversation finalization, PDF export, improved filtering, and scroll restoration refinement.

### 9.2 Scope

| Feature | Component | Description |
|---------|-----------|-------------|
| Search | `ChatSearch` (dialog) | Search bar → `GET /chat/messages/search?q=` → results list with highlight |
| Finalized conversations | Visual treatment | Distinct icon/badge for conversations marked "finalized" |
| PDF Export | Button in ChatHeader | `GET /chat/rooms/:roomId/export?format=pdf` → download |
| Room type filtering | RoomList filter | Tabs/pills: "Todos", "Directo", "Grupal" |
| Unread cap | RoomList | Counts > 99 display "99+" |
| Scroll restoration | MessageList | Per-room scroll position saved in `useRef<Map<string, number>>`; restored on room switch |

### 9.3 Non-Goals

| Excluded | Rationale |
|----------|-----------|
| Full-text search index | Backend uses Prisma `contains` with `mode: 'insensitive'` — no Elasticsearch |
| Bulk export (multiple conversations) | Single conversation export only |
| Message deletion | Not implemented in backend |
| Read receipt detail (counts per message) | Deferred — Phase 2 provides basic readBy array |

### 9.4 Dependencies

| Dependency | Details |
|-----------|---------|
| Backend `GET /chat/messages/search` | Query param `q`, scoped to user's rooms |
| Backend `GET /chat/rooms/:roomId/export` | Returns PDF binary |
| Phase 2 | WS sync for realtime search updates (not critical — REST is fine) |

### 9.5 Acceptance Criteria

- [ ] Search finds messages across all rooms user is member of
- [ ] Search results show room name, sender, snippet with query highlighted
- [ ] Finalized conversations show distinct styling (badge, muted color)
- [ ] Export produces valid PDF with all messages in chronological order
- [ ] Room type filter shows only DIRECT or GROUP rooms
- [ ] Unread counts display "99+" when > 99
- [ ] Scroll position is preserved when switching rooms and returning

---

## 10. Phase 6 — Guardian Experience

### 10.1 Objective

Roll out a simplified guardian chat interface under `/guardian/chat` using the same shared infrastructure but capability-aware rendering.

### 10.2 Architecture Decision

Guardian uses the **exact same**:
- WebSocket namespace (`/chat`)
- React Query cache keys (`['chat', 'rooms']`, `['chat', 'messages', ...]`)
- `ChatLayout` component
- `ChatSocketProvider`
- All shared chat components

The difference is:
- Fewer UI actions rendered (capability flags from `ChatCapabilitiesProvider`)
- Different navigation context (`guardianNav`)
- Mobile-first layout as default

### 10.3 Scope

#### 10.3.1 Route Group

| Route | File |
|-------|------|
| `/guardian/chat` | `src/app/guardian/chat/page.tsx` |
| `/guardian/chat/[roomId]` | `src/app/guardian/chat/[roomId]/page.tsx` |
| Guardian layout | `src/app/guardian/layout.tsx` |
| Guardian chat layout | `src/app/guardian/chat/layout.tsx` |

#### 10.3.2 Navigation

```typescript
// In navigation.ts
export const guardianNav: NavItem[] = [
  // ... existing guardian nav items
  { name: 'Chat', href: '/guardian/chat', icon: MessageCircle },
];
```

#### 10.3.3 ChatCapabilitiesProvider

Derives capability flags from `GET /chat/policy` response + user role:

```typescript
interface ChatCapabilities {
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
```

Guardian defaults (subject to `InstitutionChatPolicy`):
```typescript
const guardianCapabilities: ChatCapabilities = {
  canSendMessages: true,
  canSendAttachments: false,          // Deferred
  canCreateDirectRooms: true,         // Via policy
  canCreateGroupRooms: false,
  canAddParticipants: false,
  canRemoveParticipants: false,
  canSearchMessages: false,
  canExportConversation: false,
  canViewReadReceipts: false,
  canViewPresence: true,
  canViewRoomManagement: false,
  canFinalizeConversation: false,
};
```

### 10.4 Non-Goals

| Excluded | Rationale |
|----------|-----------|
| Separate WS namespace | `/chat` namespace shared — simpler infra, fewer connections |
| Separate React Query cache | Same keys — cache dedup across roles if same browser |
| Separate ChatLayout | Guardian uses same `ChatLayout` with `roleGroup="guardian"` prop |
| Guardian-specific components | Capability flags control rendering; no component duplication |

### 10.5 Dependencies

| Dependency | Details |
|-----------|---------|
| Backend `GET /chat/policy` | Returns `InstitutionChatPolicy` for the user's institution |
| Frontend guardian layout | `src/app/guardian/layout.tsx` (AppLayout-based) |
| Phase 2 | Realtime infrastructure verified |
| `ChatCapabilitiesProvider` | New context provider in `components/chat/` |

### 10.6 Acceptance Criteria

- [ ] Guardian can navigate to `/guardian/chat` and see their conversations
- [ ] Guardian can send messages to allowed roles per institution policy
- [ ] Guardian cannot create new rooms (button hidden when `canCreateDirectRooms: false`)
- [ ] Guardian cannot view read receipts (indicator hidden)
- [ ] Guardian cannot export conversations (button hidden)
- [ ] Guardian layout is mobile-first (single column, full-width messages)
- [ ] Guardian navigation includes Chat link
- [ ] All capability checks use context, not `role === 'GUARDIAN'` conditionals

---

## 11. Phase 7 — Hardening & Optimization

### 11.1 Objective

Audit the entire chat frontend for performance issues, memory leaks, WebSocket resilience, and stale cache entries. No new features.

### 11.2 Scope

| Area | Focus | Verification Method |
|------|-------|-------------------|
| **Rerender analysis** | Audit React.memo boundaries — ensure typing/presence changes don't re-render MessageBubble | React DevTools profiler |
| **WebSocket listener cleanup** | Verify no duplicate handlers after reconnect cycles | Count listeners per event |
| **Duplicate event handling** | Audit all WS handlers for idempotency; verify no duplicate message inserts | Code review + integration test |
| **Reconciliation hardening** | Ensure `sentAt` sort is stable; handle edge case of identical `sentAt` + `id` tiebreaker | Unit test |
| **Memory leak review** | Check useEffect cleanup in all WS handlers; verify Map/Set refs garbage-collected | Chrome Memory tab |
| **Stale cache review** | Verify staleTime values appropriate; ensure no unbounded `['chat','messages',roomId]` growth | Query cache inspection |
| **Virtualization evaluation** | Measure MessageList performance at 200, 500, 1000 messages; document viability | FPS counter + memory |
| **Reconnect stress testing** | 10+ disconnect/reconnect cycles; verify no state corruption | Integration test |

### 11.3 Non-Goals

| Excluded | Rationale |
|----------|-----------|
| Virtualization implementation | Evaluation only — implementation deferred if needed |
| Migration to different WS library | Socket.IO stays — too costly to change |
| Adding virtualization libraries | No new dependencies in this phase |

### 11.4 Dependencies

All previous phases must be complete and stable.

### 11.5 Acceptance Criteria

- [ ] No memory leak detected over 30-minute continuous session with WS activity
- [ ] React Query cache bounded — message pages evicted when `cacheTime` expires
- [ ] No duplicate WS event handlers registered after 10+ reconnect cycles
- [ ] Message list renders 500 messages at 60fps without frame drops
- [ ] All `useEffect` cleanup functions properly remove WS listeners
- [ ] No console warnings for stale closures or missing deps
- [ ] `React.memo` shallow comparison prevents unnecessary MessageBubble re-renders

---

## 12. Testing Strategy

### 12.1 Unit Testing

| Target | Focus |
|--------|-------|
| React Query hooks | Query key structure, `enabled` conditions, `staleTime`, success/error invalidation |
| WS → RQ bridge | Cache patch correctness, dedup by `message.id`, no-op on duplicate |
| Debounce/throttle | Typing emit frequency, cleanup on unmount |
| Capability derivation | `ChatCapabilities` from role + policy response |
| Validation (Phase 4) | MIME whitelist, size limits |
| Scroll restoration | Scroll position save/restore per room |

### 12.2 Integration Testing

| Target | Focus |
|--------|-------|
| Route access | Each role group can access their chat routes (admin, teacher, guardian) |
| REST CRUD | Create room, send message, mark read — verify via actual API calls |
| Cache invalidation | Mutation success triggers correct `invalidateQueries` calls |
| WS synchronization | Two-tab message sync; read receipt sync |

### 12.3 WebSocket Testing

| Scenario | Verification |
|----------|-------------|
| Disconnect mid-conversation | Messages still send via REST; "Reconectando" shown |
| Reconnect after long disconnect | Rooms + unread refetched; active room messages preserved |
| Token expiry → refresh | WS reconnects with fresh token automatically |
| Multiple tabs | Each tab maintains independent socket; both receive events |

### 12.4 Reconnect Testing

| Scenario | Expected Behavior |
|----------|------------------|
| 1s network blip | Socket reconnects, rooms refetched, no duplicate events |
| 30s network outage | 10 reconnect attempts with exponential backoff; "Reconectando" persists |
| Token expires during outage | After reconnect, 401 → token refresh → socket auto-reconnects |
| Rapid toggle (connect → disconnect → connect) | No listener accumulation |

### 12.5 Race Condition Testing

| Scenario | Approach |
|----------|----------|
| WS event arrives before REST response | Ensure WS handler is idempotent (check `message.id`) |
| Rapid sends (multiple clicks) | Disable send button during pending mutation |
| Room switch during pending send | Let ongoing send complete; ignore response if room changed |
| WS reconnect during send | REST mutation completes independently; new socket re-joins rooms |

### 12.6 Multi-Tab Testing

| Scenario | Expected |
|----------|----------|
| Send in Tab A → appears in Tab B | WS `newMessage` sync |
| Mark read in Tab A → unread decrements in Tab B | WS `messagesRead` sync |
| Tab A reconnects → no duplicate events | Idempotent cache patch |
| Tab B navigates away → socket disconnects (no memory leak) | Cleanup on unmount |

### 12.7 Multi-Role Testing

| Scenario | Expected |
|----------|----------|
| Teacher sees teacher capabilities | No admin/room-management actions visible |
| Guardian sees guardian capabilities | No room creation, no export, no read receipts |
| ADMIN sees full capabilities | All actions visible |
| SUPER_ADMIN sees all (bypasses institution filter) | Full access |

### 12.8 Tenant Isolation Validation

| Scenario | Verification |
|----------|-------------|
| Institution A user → only A rooms visible | Query filter by institutionId from session |
| Institution B user → cannot see A rooms | 404 or empty result |
| Cross-institution room creation | Backend rejects |

---

## 13. Failure Recovery Strategy

### 13.1 WebSocket Outage Behavior

| Phase | Connection State | User-Visible Effect | Data Recovery |
|-------|-----------------|---------------------|---------------|
| WS disconnect | `connected = false` | "Reconectando..." badge in ChatHeader | Messages sent via REST (no loss); typing/presence unavailable |
| WS reconnecting | Exponential backoff (1s→16s) | Badge persists; no manual action needed | On reconnect: refetch rooms + unread, re-join room |
| WS permanently down (10 attempts) | `connected = false` permanently | Persistent "Reconectando..." badge; manual refresh may help | REST polling via staleTime provides eventual consistency |
| WS + REST both down | N/A | "No se puede conectar" error state | Nothing — user must restore connectivity |

### 13.2 Degraded Mode Behavior

| Degradation | What Works | What Degrades |
|-------------|-----------|---------------|
| WS disconnected | REST send, receive via staleTime polling, all UI states | No typing indicators, no presence, ~10-30s latency |
| WS disconnected + REST working | Full functionality via REST | Higher latency for new messages (polling interval) |
| Full offline | Nothing — error state | All features unavailable |
| Partial (some WS events lost) | Cache reconciled via REST at staleTime | Minor delay in read receipt updates |

### 13.3 Stale Unread Recovery

```
Normal path:  Server → WS 'messagesRead' → cache patch → UI
Recovery path: Server → REST GET /chat/rooms/unread → cache invalidate → UI (at staleTime: 20s)
```

The REST path is authoritative. If a WS `messagesRead` event is lost, the unread count self-heals within 20s via `staleTime` refetch.

### 13.4 Attachment Retry Behavior

| Failure Point | UX | Recovery |
|--------------|-----|----------|
| Client-side validation (MIME/size) | Immediate toast error | User selects different file |
| Upload HTTP error (network, 500) | Retry button on failed preview | User clicks retry → re-upload |
| Upload succeeds but message send fails | Uploaded file is orphaned (no user impact) | User can re-send message without re-uploading |

---

## 14. Observability & Debugging

### 14.1 WS Logging Strategy

Development-only logging via console.debug. Production logs are removed (or gated behind `NODE_ENV`):

```typescript
if (process.env.NODE_ENV === 'development') {
  socket.on('connect', () => console.debug('[chat:ws] connected', socket.id));
  socket.on('disconnect', (reason) => console.debug('[chat:ws] disconnected', reason));
  socket.on('connect_error', (err) => console.debug('[chat:ws] connect_error', err.message));
}
```

Log format: `[chat:ws:<event>] <detail>` — grep-able prefix.

### 14.2 Reconnect Metrics

| Metric | Implementation |
|--------|---------------|
| Reconnect attempts | `useRef<number>` counter in ChatSocketProvider (reset on successful connect) |
| Reconnect success/failure | Logged on each connect/connect_error |
| Time since last reconnect | Derived from `connected` state transitions |

### 14.3 Event Tracing

- All WS events logged in development: `[chat:ws:newMessage]`, `[chat:ws:messagesRead]`, etc.
- React Query DevTools enabled in development for direct cache inspection
- `queryClient.getQueryData(['chat', 'rooms'])` accessible in console

### 14.4 Error Boundaries

| Boundary | Scope | Behavior on Error |
|----------|-------|-------------------|
| `ChatLayout` | Entire chat module | Error page with "Reintentar" button; does not crash rest of app |
| `MessageList` | Message rendering | Toast error + retry; other panels remain functional |
| `RoomList` | Room rendering | Toast error + retry; message panel remains functional |

### 14.5 React Query Debugging

```typescript
// Accessible in dev console
window.__QUERY_CLIENT = queryClient;
// Then: queryClient.getQueryData(['chat', 'rooms'])
// Then: queryClient.invalidateQueries({ queryKey: ['chat'] })
```

Query key naming convention enables targeted invalidation in development.

---

## 15. Definition of Done

### 15.1 Final Checklist

Before any phase is considered complete, verify:

#### Architectural Compliance

- [ ] Code follows `chat-frontend-architecture.md` component tree and state ownership matrix
- [ ] Code follows `frontend-patterns.md` React Query, component, and file organization rules
- [ ] No deviation from established patterns without documented justification

#### No Duplicated State Ownership

- [ ] Server state only in React Query cache (rooms, messages, unread)
- [ ] Ephemeral WS state only in `useState` (typing, presence)
- [ ] Socket instance only in `useRef`
- [ ] UI state only in `useState` (compose text, dialog open)
- [ ] No Zustand for chat state
- [ ] No localStorage for chat data

#### Backend-Authoritative Synchronization

- [ ] REST API is sole source of truth for all persisted data
- [ ] WS events are synchronization hints, not authoritative state
- [ ] Message sort order uses `sentAt` from DB, not WS arrival order
- [ ] On reconnect, REST refetch reconciles any missed WS events

#### No Role Conditionals in Shared Components

- [ ] All role-specific rendering via `ChatCapabilities` context
- [ ] No `role === 'GUARDIAN'` conditionals in shared components
- [ ] Guardian uses same component tree with different capability flags

#### Tenant Isolation

- [ ] All `institutionId` derivations from `session.user.institutionId`
- [ ] No client-provided institutionId in API calls
- [ ] SUPER_ADMIN case handled (null institutionId)

#### Cleanup Guarantees

- [ ] All `useEffect` functions return cleanup
- [ ] Socket listeners removed on unmount (`socket.off(...)` or `useEffect` cleanup)
- [ ] No setState calls after unmount (abortRef pattern)
- [ ] Debounce/timeout refs cleaned on unmount

#### Rollback Safety

- [ ] Phase is rollable by removing additive files or toggling feature gate
- [ ] No existing routes modified (only new routes added)
- [ ] No existing hooks modified (only new hooks added)

#### Responsive & Mobile Validation

- [ ] Tested at 320px width (guardian mobile-first)
- [ ] Tested at 768px width (sidebar collapses to drawer)
- [ ] Tested at 1024px and 1440px (full sidebar + message panel)

#### Accessibility

- [ ] All interactive elements keyboard-accessible
- [ ] Dialogs manage focus (trap + return)
- [ ] Form inputs have associated labels
- [ ] Loading states announced via aria-live
- [ ] Error states announced via aria-live

#### Type Safety

- [ ] No `any` types introduced
- [ ] All function parameters and return types explicit
- [ ] `z.infer<>` used for DTO types from Zod schemas
- [ ] `useChatSocket` returns typed `{ socket: Socket | null, connected: boolean }`

#### Build & Lint

- [ ] `npm run lint` passes with zero new warnings
- [ ] `npm run typecheck` passes with zero new errors

---

## 16. Future Expansion Boundaries

The following features are documented as future possibilities. They **must not** influence current implementation complexity, component architecture, or cache design.

| Feature | Backend Impact | Frontend Impact | Complexity |
|---------|---------------|----------------|------------|
| **Message reactions** | New model `ChatMessageReaction`, WS events `messageReacted` | Emoji picker, reaction bubbles, optimistic toggle | Medium |
| **Message threading** | `parentId` on `ChatMessage`, tree query | Thread view, reply indicator, nested rendering | High |
| **Offline mode** | No change (REST cache) | Service Worker, IndexedDB sync queue, offline banner | Very High |
| **Mobile app reuse** | No change | React Native shared chat components, push notification handlers | High |
| **Voice notes** | MinIO for audio, new message type `VOICE` | Audio recorder, waveform visualization, playback | Medium |
| **Virtualization** | No change | `react-virtuoso` or `@tanstack/virtual` for 1000+ message lists | Medium |
| **AI moderation** | Backend content analysis pipeline, flag model | Flag UI, moderation queue in admin panel | High |
| **Translation** | Backend ML translation service | Translation toggle on message bubble | Medium |
| **Archived conversations** | Archive flag on ChatRoom, separate query | Archive tab, unarchive action | Medium |

> These are future expansion points. They must not influence current implementation complexity, data structures, or state ownership decisions. If a current implementation choice accidentally makes any of these harder, that is acceptable — correctness and maintainability of the current scope take priority.

### 16.1 Virtualization — Deferred Evaluation

Virtualization is **explicitly deferred** from Phase 1. Current approach: simple scroll container with 50-message cursor pagination.

| Aspect | Decision |
|--------|----------|
| Deferred to | Phase 7 (Hardening & Optimization) or later |
| Likely library | `@tanstack/react-virtual` |
| Trigger threshold | MessageList consistently exceeds 200 rendered DOM nodes |
| Migration approach | `react-virtuoso` alternative considered if dynamic height measurement required |

**Why not now:** Message volumes are low at current scale (50 messages per page, most conversations < 200 messages). Dynamic heights complicate virtualization — images (Phase 4), file links, and variable text require estimated sizes with re-measure. Optimistic updates (Phase 2+) shift positions requiring virtualizer index recalculation.

**Migration path (Phase 7):**
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function MessageList({ roomId }: { roomId: string }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { data, fetchNextPage, hasNextPage } = useChatMessages(roomId);
  const messages = flattenMessages(data);

  const virtualizer = useVirtualizer({
    count: messages.length + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="overflow-auto h-full">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = messages[virtualItem.index];
          if (!message) return <LoadMoreTrigger key="loader" />;
          return <MessageItem key={message.id} message={message} />;
        })}
      </div>
    </div>
  );
}
```

---

## 17. Reference Alignment

This implementation plan is designed to align with the following architectural documents:

| Document | Key Alignment Points |
|----------|---------------------|
| `docs/chat-frontend-architecture.md` | Component tree (§7), state ownership matrix (§8), cache architecture (§10), WS mount strategy (§5), scroll restoration (§13), optimistic updates (§14) |
| `docs/CHAT.md` | REST API endpoints (§3), WS events (§6), file attachments (§11), CASL authorization (§9), multi-tenancy (§14) |
| `docs/AUTH.md` | JWT flow, session → WS auth bridge, refresh token rotation, NextAuth integration |
| `docs/MULTITENANCY.md` | `institutionId` derivation from session, tenant-aware queries, SUPER_ADMIN handling, tenant-safe file paths |
| `docs/INFRASTRUCTURE.md` | Redis pub/sub adapter for Socket.IO, container topology, WS scaling, MinIO bucket configuration |
| `docs/engineering/frontend-patterns.md` | React Query rules (§8), component organization (§22), form handling (§15), state management (§16), error/loading states (§17) |
| `docs/engineering/security-practices.md` | Frontend security rules (§11), session handling, tenant isolation, XSS prevention, ON_LEAVE enforcement |
| `docs/engineering/code-review-checklist.md` | Frontend review checklist (§8), multi-tenancy review (§11), merge readiness criteria (§33) |
| `AGENTS.md` sections 5.x–6.x | Backend development rules, frontend development rules, React Query patterns, file naming conventions, forbidden/preferred patterns |

---

*This document is the authoritative implementation sequencing reference for the EduSystem chat frontend. It is maintained alongside the codebase and updated when phases are completed or architectural decisions change.*
