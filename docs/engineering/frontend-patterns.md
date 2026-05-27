# EduSystem Frontend Engineering Patterns

> **Version:** 1.0
> **Last Updated:** 2026-05-18
> **Classification:** Internal — Frontend Engineering Standards
> **Purpose:** Authoritative frontend engineering handbook for AI-assisted development within EduSystem

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Non-Goals](#3-non-goals)
4. [Required Context](#4-required-context)
5. [Core Frontend Architectural Principles](#5-core-frontend-architectural-principles)
6. [Next.js App Router Rules](#6-nextjs-app-router-rules)
7. [Server vs Client Component Rules](#7-server-vs-client-component-rules)
8. [React Query Rules](#8-react-query-rules)
9. [Zustand Rules](#9-zustand-rules)
10. [Authentication \& Session Rules](#10-authentication--session-rules)
11. [Multi-Tenancy Frontend Rules](#11-multi-tenancy-frontend-rules)
12. [API Integration Rules](#12-api-integration-rules)
13. [UI Component Architecture Rules](#13-ui-component-architecture-rules)
14. [shadcn/ui \& Radix Rules](#14-shadcnui--radix-rules)
15. [Form Handling Rules](#15-form-handling-rules)
16. [State Management Rules](#16-state-management-rules)
17. [Error \& Loading State Rules](#17-error--loading-state-rules)
18. [Accessibility Rules](#18-accessibility-rules)
19. [Performance Rules](#19-performance-rules)
20. [Security Rules](#20-security-rules)
21. [Styling \& Tailwind Rules](#21-styling--tailwind-rules)
22. [File Organization Rules](#22-file-organization-rules)
23. [TypeScript Standards](#23-typescript-standards)
24. [Maintainability Standards](#24-maintainability-standards)
25. [Preferred Patterns](#25-preferred-patterns)
26. [Forbidden Patterns](#26-forbidden-patterns)
27. [Good Examples](#27-good-examples)
28. [Bad Examples](#28-bad-examples)
29. [Review Heuristics](#29-review-heuristics)
30. [Refactoring Guidelines](#30-refactoring-guidelines)
31. [Development Workflow Expectations](#31-development-workflow-expectations)
32. [Validation Checklist](#32-validation-checklist)
33. [Expected Quality Standards](#33-expected-quality-standards)

---

## 1. Purpose

This document establishes the authoritative engineering standards for EduSystem frontend development. It provides prescriptive pattern guidance for building scalable, maintainable, and accessible Next.js frontend interfaces within a multi-tenant SaaS educational management platform.

The document serves three primary objectives:

1. **Consistency** — Ensure all frontend code follows uniform patterns regardless of author
2. **Maintainability** — Establish clear boundaries that prevent architectural drift over time
3. **Scalability** — Define patterns that support large component trees and complex interactions

Every engineer and AI coding agent working on EduSystem frontend code MUST internalize these patterns. Deviation from these standards requires explicit architectural justification and review.

---

## 2. Scope

This document governs all frontend code within the `frontend/src/` directory of the EduSystem repository, including:

- **Next.js App Router** — Pages, layouts, route groups, middleware
- **React Components** — Server components, client components, shared UI
- **React Query** — Server-state management, query hooks, mutations
- **Zustand** — Client-state management, global UI state
- **NextAuth** — Session management, authentication flow
- **Forms** — React Hook Form integration, validation, submission
- **API Integration** — Axios client, typed API hooks, error handling
- **UI Components** — shadcn/ui primitives, composable components
- **Styling** — Tailwind CSS, responsive design, accessibility

This document does NOT govern:
- Backend code (NestJS, Prisma, BullMQ)
- DevOps/infrastructure provisioning
- Design system tokens (managed via Tailwind config)
- CI/CD pipeline configuration

This document also does NOT serve as a tutorial for Next.js or React. It assumes familiarity with the framework and library ecosystem.

---

## 3. Non-Goals

This document deliberately excludes:

- **Backend patterns** — Covered by `backend-patterns.md` and `docs/ARCHITECTURE.md`
- **Design tokens** — Typography, colors, spacing defined in Tailwind config
- **Testing frameworks** — Unit/E2E testing patterns not covered
- **Code formatting (linting)** — Enforced via ESLint/Prettier configuration
- **Version control workflows** — Defined in AGENTS.md
- **Component library development** — shadcn/ui primitives are shared, not modified

This document also does NOT serve as a tutorial. It assumes familiarity with Next.js App Router, React Query, and TypeScript.

---

## 4. Required Context

Before implementing any frontend code in EduSystem, engineers and AI agents MUST read and understand the following documents:

| Document | Covers |
|----------|--------|
| `docs/ARCHITECTURE.md` | High-level system design, frontend architecture overview |
| `docs/AUTH.md` | Authentication flow, JWT handling, session management |
| `docs/MULTITENANCY.md` | Tenant context, institution-aware frontend behavior |
| `docs/INFRASTRUCTURE.md` | Environment variables, deployment configuration |
| `AGENTS.md` sections 6.x | Frontend development rules, React Query patterns, form handling |

These documents are the authoritative sources for architectural decisions. This patterns document complements them with code-level guidance.

---

## 5. Core Frontend Architectural Principles

EduSystem frontend follows a strict layered architecture with clear separation between server state and client state. These principles are non-negotiable.

### 5.1 Server Components by Default

All components in EduSystem MUST be server components unless interactivity requires client-side rendering. Server components provide:

- Zero client-side JavaScript for data fetching
- Automatic optimization by Next.js
- SEO-friendly rendering
- Reduced client bundle size

Use `'use client'` ONLY when:
- Component uses React hooks (`useState`, `useEffect`, `useRef`)
- Component uses event handlers (`onClick`, `onChange`)
- Component uses browser-only APIs
- Component uses third-party client-side libraries

### 5.2 React Query for Server State

ALL API data MUST flow through React Query. React Query provides:

- Automatic caching and deduplication
- Background refetching
- Optimistic updates
- Stale-while-revalidate pattern
- Loading/error state management

Store server-state in React Query, NOT in:
- Zustand stores
- React state (except for UI state)
- LocalStorage/sessionStorage
- Component state

### 5.3 Zustand for Client State Only

Zustand stores MUST only hold UI state, NOT server-state:

**ALLOWED (Client State):**
- Modal open/close state
- Sidebar collapsed state
- Active tab state
- Form wizard current step
- UI theme preference

**FORBIDDEN (Server State):**
- Cached API data (use React Query)
- User list from API
- Course data from API
- Any data that could be stale

### 5.4 Minimal Client Rendering

Keep client-side JavaScript minimal:

- Render as much as possible on the server
- Use `React.memo` for expensive child components
- Lazy load non-critical components
- Avoid unnecessary client re-renders

### 5.5 Auth-Aware Rendering

Frontend MUST respect authentication state:

- Use `useAppSession()` hook for session data
- Use `useIsOnLeave()` hook for mutation blocking
- Render role-specific UI via conditional checks
- Protect routes via layout-level checks

### 5.6 Tenant-Aware Frontend

Frontend MUST derive tenant context from session, NOT from client input:

- `institutionId` comes from `session.user.institutionId`
- Never trust client-provided institutionId
- Display tenant-specific data based on session context

---

## 6. Next.js App Router Rules

### 6.1 App Router Architecture

EduSystem uses Next.js App Router with the following structure:

```
src/app/
├── page.tsx                    # Root page (login redirect)
├── layout.tsx                  # Root layout (providers)
├── login/
│   └── page.tsx                # Public login page
├── invite/
│   └── accept/
│       └── page.tsx             # Invitation acceptance
├── dashboard/
│   └── page.tsx                # Role-based dashboard redirect
├── admin/
│   ├── layout.tsx              # Protected admin layout
│   ├── dashboard/
│   │   └── page.tsx
│   ├── students/
│   │   ├── page.tsx            # List students
│   │   └── [id]/
│   │       └── page.tsx        # Student detail
│   └── ...
├── teacher/
│   ├── layout.tsx              # Protected teacher layout
│   └── ...
└── superadmin/
    ├── layout.tsx              # Protected superadmin layout
    └── ...
```

### 6.2 Layout Hierarchy

Layouts MUST follow this hierarchy:

1. **Root layout** (`app/layout.tsx`) — HTML structure, providers, fonts
2. **Route group layouts** (`app/(group)/layout.tsx`) — Auth state, protected layouts
3. **Role-specific layouts** (`app/admin/layout.tsx`, `app/teacher/layout.tsx`) — Navigation, headers

All authenticated layouts MUST use `AppLayout` component for consistent navigation.

### 6.3 Server Rendering

All pages are server-rendered by default:

```typescript
// Default: Server Component
export default function StudentsPage() {
  // No 'use client' needed
  return <StudentsList />;
}
```

Add `'use client'` ONLY when client-side interactivity is required:

```typescript
'use client';

import { useState } from 'react';

export function CreateStudentDialog() {
  const [open, setOpen] = useState(false);
  // Client-side logic here
}
```

### 6.4 Route Groups

Use route groups for organizing related routes:

```
app/
├── (authenticated)/
│   ├── admin/
│   │   └── ...
│   └── teacher/
│       └── ...
└── (public)/
    ├── login/
    │   └── ...
    └── invite/
        └── ...
```

### 6.5 Protected Layouts

Authenticated layouts MUST verify session:

```typescript
// app/admin/layout.tsx
'use client';

import { AppLayout } from '@/components/layouts/app-layout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
```

The `AppLayout` component internally checks authentication via `useAppSession()`.

### 6.6 Forbidden App Router Patterns

Frontend MUST NOT:

- Use Pages Router patterns (`pages/` directory)
- Add unnecessary `'use client'` directives
- Break App Router conventions (e.g., using `getServerSideProps`)
- Duplicate routing logic in multiple places

---

## 7. Server vs Client Component Rules

### 7.1 Server Component Defaults

All components are server components by default. Server components can:

- Fetch data directly (Prisma in backend; not needed in frontend)
- Render UI without client-side JavaScript
- Use async/await for data preparation
- Import other server components
- Use React Server Components features

### 7.2 When to Use Client Components

Add `'use client'` ONLY when:

**React Hooks Required:**
```typescript
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0); // Requires client
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

**Event Handlers Required:**
```typescript
'use client';

export function SubmitButton({ onSubmit }) {
  return <button onClick={onSubmit}>Submit</button>; // Requires client
}
```

**Browser APIs Required:**
```typescript
'use client';

export function FileUploader() {
  const handleFile = () => {
    const input = document.createElement('input'); // Browser API
    input.type = 'file';
  };
  return <button onClick={handleFile}>Upload</button>;
}
```

### 7.3 Hydration Boundaries

Keep hydration boundaries intentional:

```typescript
// server-component.tsx (no 'use client')
export default function Page() {
  return (
    <div>
      {/* Server-rendered content */}
      <ServerContent />

      {/* Client component with explicit boundary */}
      <ClientInteractive />
    </div>
  );
}
```

### 7.4 Forbidden Server/Client Patterns

Frontend MUST NOT:

- Use browser APIs in server components (document, window, localStorage)
- Cause hydration mismatches (different server/client rendering)
- Unnecessarily convert server components to client components
- Put client components inside server components without need

---

## 8. React Query Rules

React Query is the ONLY acceptable way to manage server state in EduSystem frontend.

### 8.1 Query Hook Pattern

All API queries MUST follow this pattern:

```typescript
// src/lib/api/grades.ts
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

interface GradeFilters {
  studentId?: string;
  courseSubjectId?: string;
  periodId?: string;
}

export function useGrades(filters?: GradeFilters) {
  return useQuery({
    queryKey: ['grades', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.studentId) params.set('studentId', filters.studentId);
      if (filters?.courseSubjectId) params.set('courseSubjectId', filters.courseSubjectId);
      if (filters?.periodId) params.set('periodId', filters.periodId);
      const res = await api.get<Grade[]>(`/grades?${params.toString()}`);
      return res.data;
    },
    enabled: !!filters?.studentId || !!filters?.courseSubjectId || !!filters?.periodId,
  });
}
```

### 8.2 Query Key Convention

Query keys MUST be:

- Arrays (feature-based): `['grades']`, `['grades', filters]`
- Consistent across the application
- Include filter objects for parameterized queries

```typescript
// Good query keys
['students']
['students', { institutionId: 'uuid' }]
['grades', { studentId: 'uuid', periodId: 'uuid' }]

// Bad query keys
'students' // String instead of array
gradesKey // Dynamic variable
```

### 8.3 Mutation Pattern

All mutations MUST follow this pattern:

```typescript
export function useCreateGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGradeDto) => {
      const res = await api.post<Grade>('/grades', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast.success('Nota cargada exitosamente');
    },
    onError: () => {
      toast.error('Error al cargar la nota');
    },
  });
}
```

### 8.4 Optimistic Updates

Use optimistic updates for instant feedback:

```typescript
return useMutation({
  mutationFn: updateGrade,
  onMutate: async (newGrade) => {
    await queryClient.cancelQueries({ queryKey: ['grades'] });
    const previous = queryClient.getQueryData(['grades']);
    queryClient.setQueryData(['grades'], (old) =>
      old.map((g) => (g.id === newGrade.id ? { ...g, ...newGrade } : g))
    );
    return { previous };
  },
  onError: (err, newGrade, context) => {
    queryClient.setQueryData(['grades'], context.previous);
    toast.error('Error al actualizar');
  },
});
```

### 8.5 Stale Time Configuration

Set appropriate `staleTime` to reduce refetching:

```typescript
useQuery({
  queryKey: ['institution'],
  queryFn: fetchInstitution,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### 8.6 Reusable Hook Organization

Group API hooks by domain in `src/lib/api/[domain].ts`:

```
src/lib/api/
├── index.ts           # Axios client export
├── grades.ts          # Grade queries and mutations
├── students.ts        # Student queries and mutations
├── courses.ts         # Course queries and mutations
└── users.ts           # User queries and mutations
```

### 8.7 Forbidden React Query Patterns

Frontend MUST NOT:

- Duplicate fetch logic across components
- Use inconsistent query keys
- Store API data in Zustand or component state
- Use uncontrolled refetching (always set staleTime)
- Call API directly in components (use hooks)

---

## 9. Zustand Rules

Zustand is ONLY for client-side UI state. Server state belongs in React Query.

### 9.1 Client-State-Only Usage

Zustand stores MUST only hold UI state:

```typescript
// store/ui-store.ts
import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activeModal: string | null;
  openModal: (modal: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));
```

### 9.2 UI State Boundaries

Acceptable Zustand usage:

- **Modal state**: Which modal is open
- **Sidebar state**: Collapsed/expanded
- **Theme state**: Dark/light mode
- **Form wizard**: Current step
- **UI flags**: Loading states, expanded sections

### 9.3 Forbidden Zustand Patterns

Zustand MUST NOT store:

```typescript
// FORBIDDEN: Server state in Zustand
export const useStudentStore = create((set) => ({
  students: [], // NEVER store API data
  setStudents: (students) => set({ students }),
}));

// FORBIDDEN: Duplicating React Query cache
export const useGradesStore = create((set) => ({
  grades: null,
  setGrades: (grades) => set({ grades }), // Duplicates React Query!
}));
```

Use React Query for server state, NOT Zustand.

### 9.4 Minimal Store Design

Keep stores small and focused:

```typescript
// GOOD: Focused store
interface SidebarStore {
  isOpen: boolean;
  toggle: () => void;
}

// BAD: Giant store with mixed concerns
interface AppStore {
  users: User[];
  students: Student[];
  grades: Grade[];
  sidebarOpen: boolean;
  modalOpen: boolean;
  theme: 'light' | 'dark';
  // ... 50 more fields
}
```

---

## 10. Authentication & Session Rules

EduSystem uses NextAuth v5 for authentication with JWT-based session management.

### 10.1 NextAuth Configuration

The auth configuration is in `src/lib/auth.ts`:

```typescript
// src/lib/auth.ts
export const config: NextAuthConfig = {
  providers: [
    Credentials({
      async authorize(credentials) {
        const res = await axios.post(`${BASE_URL}/auth/login`, {
          email: credentials.email,
          password: credentials.password,
        });
        const { accessToken, refreshToken, user } = res.data;
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          institutionId: user.institutionId,
          status: user.status,
          accessToken,
          refreshToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) Object.assign(token, user);
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.institutionId = token.institutionId as string | null;
      session.user.status = token.status as string;
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
};
```

### 10.2 Session Hook Usage

Use `useAppSession` for typed session access:

```typescript
// src/lib/hooks/use-app-session.ts
import { useSession } from 'next-auth/react';

export function useAppSession() {
  return useSession();
}
```

### 10.3 Auth-Aware Navigation

Protect routes via layouts:

```typescript
// app/admin/layout.tsx
'use client';

import { AppLayout } from '@/components/layouts/app-layout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
```

`AppLayout` internally checks session and redirects to `/login` if unauthenticated.

### 10.4 Role-Aware Interfaces

Render UI based on user role:

```typescript
// In client components
const { data: session } = useAppSession();

if (session?.user.role === 'ADMIN') {
  return <AdminPanel />;
}

if (session?.user.role === 'TEACHER') {
  return <TeacherPanel />;
}

return <GuardianPanel />;
```

### 10.5 ON_LEAVE Status Handling

Use `useIsOnLeave()` hook to block mutations:

```typescript
// src/lib/hooks/use-is-on-leave.ts
import { useAppSession } from '@/lib/hooks/use-app-session';

export function useIsOnLeave(): boolean {
  const { data: session } = useAppSession();
  return (session?.user as any)?.status === 'ON_LEAVE';
}
```

Use in components to disable mutation buttons:

```typescript
const isOnLeave = useIsOnLeave();

<Button disabled={isOnLeave} onClick={handleSubmit}>
  Guardar
</Button>
```

### 10.6 API Client Integration

The Axios client automatically blocks mutations for ON_LEAVE users:

```typescript
// src/lib/api.ts
const MUTATING_METHODS = ['post', 'put', 'patch', 'delete'];

api.interceptors.request.use(async (config) => {
  const session = await getCachedSession();
  const status = (session?.user as any)?.status;
  if (status === 'ON_LEAVE' && MUTATING_METHODS.includes(config.method ?? '')) {
    toast.error('Tu cuenta está en licencia. No podés realizar cambios.');
    const controller = new AbortController();
    controller.abort();
    config.signal = controller.signal;
  }
  return config;
});
```

### 10.7 Forbidden Auth Patterns

Frontend MUST NOT:

- Store tokens in localStorage (use NextAuth session)
- Trust frontend authorization (always verify on backend)
- Expose sensitive auth data in UI
- Bypass session checks for protected routes

---

## 11. Multi-Tenancy Frontend Rules

EduSystem is a multi-tenant SaaS platform. Frontend MUST be tenant-aware.

### 11.1 Tenant Context Derivation

Tenant context MUST come from session, NOT client input:

```typescript
// CORRECT: Derive from session
const { data: session } = useAppSession();
const institutionId = session?.user.institutionId;

// FORBIDDEN: Trust client input
const institutionId = searchParams.get('institutionId'); // Untrusted!
```

### 11.2 Institution-Aware API Calls

Include institutionId in API requests when required:

```typescript
export function useStudents() {
  const { data: session } = useAppSession();

  return useQuery({
    queryKey: ['students', session?.user.institutionId],
    queryFn: async () => {
      const res = await api.get<Student[]>('/students', {
        params: { institutionId: session?.user.institutionId },
      });
      return res.data;
    },
    enabled: !!session?.user.institutionId,
  });
}
```

### 11.3 Tenant-Safe Navigation

Navigation MUST respect tenant boundaries:

```typescript
// Navigation uses session context, not user input
<Link href={`/admin/students?institutionId=${session.user.institutionId}`}>
  Students
</Link>
```

### 11.4 Role-Tenant Interaction

Handle SUPER_ADMIN case (no institution scope):

```typescript
const { data: session } = useAppSession();

if (session?.user.role === 'SUPER_ADMIN') {
  return <SuperAdminInterface />; // Different UI for platform admin
}

return <TenantInterface institutionId={session?.user.institutionId} />;
```

### 11.5 Forbidden Multi-Tenancy Patterns

Frontend MUST NOT:

- Trust client-provided institutionId
- Display data from different tenants
- Allow cross-tenant navigation
- Store tenant context in localStorage

---

## 12. API Integration Rules

### 12.1 Centralized API Client

All HTTP requests MUST use the centralized Axios client:

```typescript
// src/lib/api.ts
import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});
```

**NEVER create a new Axios instance.** Always import `api` from `@/lib/api`.

### 12.2 Request Interceptors

The API client includes automatic JWT injection:

```typescript
api.interceptors.request.use(async (config) => {
  const session = await getCachedSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});
```

### 12.3 Response Interceptors

Automatic 401 handling:

```typescript
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await signOut({ callbackUrl: '/login' });
    }
    return Promise.reject(error);
  }
);
```

### 12.4 Typed API Responses

Always type API responses:

```typescript
interface Grade {
  id: string;
  score: string;
  type: string;
  student: { id: string; firstName: string; lastName: string };
}

const res = await api.get<Grade[]>('/grades');
```

### 12.5 Pagination Support

Support pagination in queries:

```typescript
export function useGrades(filters?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['grades', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      const res = await api.get<Grade[]>(`/grades?${params}`);
      return res.data;
    },
  });
}
```

### 12.6 Error Handling

Handle errors consistently:

```typescript
export function useCreateStudent() {
  return useMutation({
    mutationFn: createStudent,
    onError: (error: AxiosError) => {
      if (error.response?.status === 409) {
        toast.error('El estudiante ya existe');
      } else {
        toast.error('Error al crear el estudiante');
      }
    },
  });
}
```

### 12.7 Forbidden API Patterns

Frontend MUST NOT:

- Create new Axios instances (use centralized `api`)
- Make untyped API calls
- Handle auth manually (use interceptors)
- Duplicate request logic

---

## 13. UI Component Architecture Rules

### 13.1 Reusable Component Pattern

Components MUST be reusable and composable:

```typescript
// components/ui/card.tsx - shadcn/ui primitive
export function Card({ children, className }: CardProps) {
  return <div className={cn('rounded-lg border bg-card p-6', className)}>{children}</div>;
}

// Usage in pages
<Card>
  <CardHeader>
    <CardTitle>Estudiantes</CardTitle>
  </CardHeader>
  <CardContent>
    <StudentList />
  </CardContent>
</Card>
```

### 13.2 Separation of Logic and Presentation

Keep components focused:

```typescript
// GOOD: Focused component
export function StudentList() {
  const { data: students } = useStudents();

  if (!students) return <Skeleton />;

  return (
    <ul>
      {students.map((s) => (
        <StudentRow key={s.id} student={s} />
      ))}
    </ul>
  );
}
```

### 13.3 Feature-Oriented Organization

Complex pages use subfolders:

```
src/app/admin/grades/
├── page.tsx              # Page orchestration (50-90 lines)
└── _components/
    ├── grades-table.tsx        # Table component
    ├── create-grade-dialog.tsx # Create dialog
    └── grades.types.ts         # Shared types
```

### 13.4 Component Modularity

Break large components into smaller ones:

```typescript
// BAD: Monolithic component
export function StudentDetail() {
  // 200 lines of everything
}

// GOOD: Modular components
export function StudentDetail() {
  return (
    <div>
      <PersonalInfoCard />
      <CoursesCard />
      <GuardiansCard />
      <AttendanceSummary />
    </div>
  );
}
```

### 13.5 Forbidden Component Patterns

Frontend MUST NOT:

- Create giant components (over 200 lines)
- Deeply nest component trees (max 3-4 levels)
- Duplicate UI logic across components
- Mix concerns in single component

---

## 14. shadcn/ui & Radix Rules

EduSystem uses shadcn/ui as its design system foundation with Radix UI primitives.

### 14.1 Design System Consistency

All UI components MUST use shadcn/ui primitives:

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem } from '@/components/ui/select';
```

### 14.2 Accessibility by Default

Radix primitives provide accessibility:

- Keyboard navigation
- Focus management
- Screen reader support
- ARIA attributes

Always prefer Radix-based components over custom implementations.

### 14.3 Composability

Compose primitives for complex UI:

```typescript
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Crear Estudiante</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Nuevo Estudiante</DialogTitle>
    </DialogHeader>
    <CreateStudentForm onSuccess={() => setOpen(false)} />
  </DialogContent>
</Dialog>
```

### 14.4 Customization via Tailwind

Extend primitives with Tailwind:

```typescript
<Button className="bg-primary hover:bg-primary/90">
  Primary Action
</Button>
```

### 14.5 Forbidden shadcn/ui Patterns

Frontend MUST NOT:

- Create custom components that duplicate shadcn/ui primitives
- Bypass accessibility features unnecessarily
- Mix custom styling with inconsistent design patterns
- Add new primitives without evaluating existing options

---

## 15. Form Handling Rules

### 15.1 React Hook Form Integration

All forms MUST use React Hook Form:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createStudentSchema, CreateStudentForm } from './students.types';

const form = useForm<CreateStudentForm>({
  resolver: zodResolver(createStudentSchema),
  defaultValues: {
    firstName: '',
    lastName: '',
    documentNumber: '',
  },
});
```

### 15.2 Zod Validation Schema

Zod schemas define form validation:

```typescript
// src/app/admin/students/_components/students.types.ts
export const createStudentSchema = z.object({
  firstName: z.string().min(1, 'Requerido').max(100),
  lastName: z.string().min(1, 'Requerido').max(100),
  documentNumber: z.string().min(1, 'Requerido').max(20),
  email: z.string().email('Email inválido').optional(),
});
export type CreateStudentForm = z.infer<typeof createStudentSchema>;
```

### 15.3 Controlled Form Components

Use controlled inputs with shadcn/ui:

```typescript
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="firstName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Nombre</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit">Guardar</Button>
  </form>
</Form>
```

### 15.4 Submission State

Handle loading/error states:

```typescript
async function onSubmit(data: CreateStudentForm) {
  try {
    await createStudent.mutateAsync(data);
    form.reset();
    setOpen(false);
    toast.success('Estudiante creado exitosamente');
  } catch (error) {
    toast.error('Error al crear el estudiante');
  }
}
```

### 15.5 Optimistic UX

Consider optimistic updates for forms:

```typescript
const createStudent = useCreateStudent({
  onMutate: async (newStudent) => {
    await queryClient.cancelQueries({ queryKey: ['students'] });
    const previous = queryClient.getQueryData(['students']);
    queryClient.setQueryData(['students'], (old) => [...(old || []), newStudent]);
    return { previous };
  },
});
```

### 15.6 Form Reset

Reset form after successful submission:

```typescript
form.reset(); // Clear form after success
```

### 15.7 Forbidden Form Patterns

Frontend MUST NOT:

- Use uncontrolled forms (use React Hook Form)
- Skip validation (always use Zod schemas)
- Hide loading states during submission
- Duplicate form logic across pages

---

## 16. State Management Rules

### 16.1 Server vs Client State Separation

Clearly separate server and client state:

| State Type | Storage | Examples |
|------------|---------|----------|
| **Server State** | React Query | Users, students, grades from API |
| **Client State** | React useState | Form inputs, local UI |
| **Global UI State** | Zustand | Modals, sidebars, themes |

### 16.2 Local State Discipline

Use local state for component-specific state:

```typescript
// Component-specific state
const [isOpen, setIsOpen] = useState(false);
const [selectedId, setSelectedId] = useState<string | null>(null);
```

### 16.3 Minimal Global State

Only globalize truly shared state:

```typescript
// GOOD: Shared UI state
export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
}));

// BAD: Over-globalized state
export const useAppStore = create((set) => ({
  students: [], // Should be in React Query!
  grades: [],
  // ... 50 more
}));
```

### 16.4 Predictable State Ownership

Each piece of state has ONE owner:

- React Query → Server data
- useState → Component-local data
- Zustand → Shared UI data

### 16.5 Forbidden State Patterns

Frontend MUST NOT:

- Store server data in Zustand
- Duplicate React Query cache in component state
- Create giant global stores
- Mix server and client state incorrectly

---

## 17. Error & Loading State Rules

### 17.1 Loading Skeletons

Use skeletons for loading states:

```typescript
export function StudentsList() {
  const { data: students, isLoading } = useStudents();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return <StudentTable students={students} />;
}
```

### 17.2 Async Error Handling

Handle errors gracefully:

```typescript
const { data: students, isError, error } = useStudents();

if (isError) {
  return (
    <div className="text-center py-8">
      <p className="text-red-500">Error al cargar estudiantes</p>
      <Button onClick={() => refetch()}>Reintentar</Button>
    </div>
  );
}
```

### 17.3 Retry UX

Provide retry capability:

```typescript
const query = useQuery({
  queryKey: ['students'],
  queryFn: fetchStudents,
  retry: 2,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

### 17.4 Empty States

Show meaningful empty states:

```typescript
if (!students || students.length === 0) {
  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground">No hay estudiantes registrados</p>
      <Button onClick={() => setOpen(true)}>Crear primer estudiante</Button>
    </div>
  );
}
```

### 17.5 Suspense Awareness

Use Suspense for streaming:

```typescript
<Suspense fallback={<Skeleton />}>
  <StudentsList />
</Suspense>
```

### 17.6 Forbidden Loading/Error Patterns

Frontend MUST NOT:

- Show blank screens during loading
- Hide errors silently
- Inconsistent loading UX across pages
- Missing empty states

---

## 18. Accessibility Rules

### 18.1 Semantic HTML

Use proper HTML elements:

```typescript
// GOOD: Semantic HTML
<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Title</h1>
    <p>Content</p>
  </article>
</main>

<footer>...</footer>

// BAD: Non-semantic
<div onClick={goToHome}>Home</div>
```

### 18.2 Keyboard Accessibility

Ensure keyboard navigation:

- All interactive elements focusable
- Logical tab order
- Keyboard shortcuts documented
- No keyboard traps

### 18.3 ARIA Usage

Use ARIA appropriately:

```typescript
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent aria-describedby="dialog-description">
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <p id="dialog-description">Description</p>
  </DialogContent>
</Dialog>
```

### 18.4 Focus Management

Manage focus for modals/dialogs:

- Focus trap in dialogs
- Return focus on close
- Visible focus indicators

### 18.5 Screen Reader Support

Ensure screen reader compatibility:

- Proper labels on form inputs
- Alternative text on images
- Meaningful link text
- Status announcements via aria-live

### 18.6 Accessible shadcn/ui

Use accessible Radix primitives:

```typescript
// Radix Dialog handles focus management, keyboard navigation, ARIA
<Dialog>
  <DialogTrigger>Open Dialog</DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>
```

### 18.7 Forbidden Accessibility Patterns

Frontend MUST NOT:

- Create custom interactive components without accessibility
- Skip form labels
- Trap keyboard focus
- Create inaccessible dialogs
- Use non-semantic markup for interactive elements

---

## 19. Performance Rules

### 19.1 Code Splitting

Next.js automatic code splitting:

- Each route is a separate bundle
- Dynamic imports for large components

```typescript
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <Skeleton />,
});
```

### 19.2 Lazy Loading

Lazy load non-critical resources:

```typescript
const PDFViewer = lazy(() => import('./PDFViewer'));
```

### 19.3 Render Optimization

Minimize unnecessary renders:

```typescript
// Use React.memo for expensive children
export const GradesTable = React.memo(function GradesTable({ grades }) {
  return <table>...</table>;
});
```

### 19.4 Query Optimization

Optimize React Query:

```typescript
// Set staleTime to avoid refetching
useQuery({
  queryKey: ['institution'],
  queryFn: fetchInstitution,
  staleTime: 5 * 60 * 1000,
});

// Select only needed fields
useQuery({
  queryKey: ['students'],
  queryFn: fetchStudents,
  select: (data) => data.map((s) => ({ id: s.id, name: s.name })),
});
```

### 19.5 Client/Server Render Tradeoffs

Choose appropriate rendering:

- **Server**: Data fetching, SEO-critical, static content
- **Client**: Interactive UI, personalization, real-time

### 19.6 Bundle Size Awareness

Monitor bundle size:

- Use `@next/bundle-analyzer`
- Keep dependencies minimal
- Use tree-shaking

### 19.7 Forbidden Performance Patterns

Frontend MUST NOT:

- Load everything on client
- Create oversized client bundles
- Duplicate API calls (use React Query cache)
- Cause excessive re-renders
- Block UI with synchronous operations

---

## 20. Security Rules

### 20.1 Secure Defaults

Frontend defaults to secure:

- HttpOnly cookies for session
- Server-side session validation
- CSRF protection via NextAuth

### 20.2 Safe Auth Rendering

Don't expose sensitive auth data:

```typescript
// GOOD: Role-based rendering
const { data: session } = useAppSession();
<div>Welcome, {session?.user.name}</div>

// BAD: Exposing sensitive data
<div>{JSON.stringify(session)}</div> // Exposes tokens!
```

### 20.3 Safe API Consumption

Use typed, validated API responses:

```typescript
// Always type responses
const res = await api.get<Student>('/students/1');
```

### 20.4 XSS-Aware Rendering

Prevent XSS:

```typescript
// GOOD: React escapes by default
<div>{userInput}</div>

// BAD: Dangerous HTML rendering
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### 20.5 Defensive UI

Handle errors gracefully without exposing internals:

```typescript
// GOOD: Safe error message
toast.error('Error al procesar la solicitud');

// BAD: Exposing internals
toast.error(`Database error: ${error.message}`);
```

### 20.6 Secure File Handling

File uploads handled securely:

- Use presigned URLs (backend generates)
- Validate file types client-side
- Limit file sizes

### 20.7 Forbidden Security Patterns

Frontend MUST NOT:

- Render unsafe HTML (dangerouslySetInnerHTML)
- Expose JWT/access tokens in UI
- Store sensitive data in localStorage
- Trust frontend authorization
- Bypass authentication checks

---

## 21. Styling & Tailwind Rules

### 21.1 Tailwind Consistency

Use Tailwind consistently:

```typescript
// Consistent spacing
<div className="space-y-4">...</div>

// Consistent typography
<h1 className="text-2xl font-semibold">Title</h1>

// Consistent colors
<Button className="bg-primary">Primary</Button>
```

### 21.2 Responsive Design

Mobile-first responsive classes:

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* Content */}
</div>
```

### 21.3 Spacing Consistency

Use consistent spacing scale:

```typescript
// Spacing: 1 (4px), 2 (8px), 3 (12px), 4 (16px), 6 (24px), 8 (32px)
<div className="p-4 space-y-2">...</div>
```

### 21.4 Typography Consistency

Use consistent typography:

```typescript
// Headings
<h1 className="text-2xl font-semibold">H1</h1>
<h2 className="text-xl font-semibold">H2</h2>
<h3 className="text-lg font-medium">H3</h3>

// Body
<p className="text-sm text-muted-foreground">Caption</p>
```

### 21.5 Reusable Utility Composition

Compose utilities:

```typescript
// Reusable class composition
const cardStyles = 'rounded-lg border bg-card p-6 shadow-sm';

// Usage
<div className={cardStyles}>...</div>
```

### 21.6 Design System Alignment

Align with shadcn/ui design tokens:

```typescript
// Use design tokens
<Button className="bg-primary text-primary-foreground">
<Card className="bg-card">
<div className="text-muted-foreground">
```

### 21.7 Forbidden Styling Patterns

Frontend MUST NOT:

- Use arbitrary values (e.g., `top-[123px]`)
- Duplicate utility patterns
- Use inline styles
- Inconsistent responsive behavior

---

## 22. File Organization Rules

### 22.1 Feature-Oriented Organization

Organize by feature:

```
src/
├── app/
│   ├── admin/
│   │   ├── students/
│   │   │   ├── page.tsx
│   │   │   └── _components/
│   │   │       ├── students-table.tsx
│   │   │       └── create-student-dialog.tsx
│   │   └── ...
│   └── ...
├── lib/
│   ├── api/
│   │   ├── grades.ts
│   │   ├── students.ts
│   │   └── ...
│   ├── hooks/
│   │   ├── use-app-session.ts
│   │   └── use-is-on-leave.ts
│   └── ...
└── components/
    ├── ui/                    # shadcn/ui primitives
    ├── layouts/
    │   └── app-layout.tsx
    └── ...
```

### 22.2 Component Modularity

Keep components in logical locations:

```
src/app/admin/students/
├── page.tsx                   # Page orchestrator
└── _components/
    ├── students.types.ts     # Shared types
    ├── students-table.tsx    # Table component
    └── create-dialog.tsx     # Dialog component
```

### 22.3 Hook Organization

Group hooks in `src/lib/hooks/`:

```
src/lib/hooks/
├── use-app-session.ts        # Session access
├── use-is-on-leave.ts        # Leave status
└── use-mobile.ts            # Responsive hook
```

### 22.4 API Utility Organization

Group API utilities in `src/lib/api/`:

```
src/lib/api/
├── index.ts                  # Axios export
├── grades.ts                # Grade API
├── students.ts              # Student API
├── courses.ts               # Course API
└── ...
```

### 22.5 Forbidden Organization Patterns

Frontend MUST NOT:

- Dump unrelated files together
- Create giant `shared/` folders
- Mix feature boundaries
- Inconsistent file organization

---

## 23. TypeScript Standards

### 23.1 Strict Typing

Use strict TypeScript:

```typescript
// GOOD: Explicit types
interface Student {
  id: string;
  firstName: string;
  lastName: string;
}

function getStudent(id: string): Promise<Student> {
  return api.get(`/students/${id}`);
}

// BAD: Weak types
function getStudent(id: string): Promise<any> {
  return api.get(`/students/${id}`);
}
```

### 23.2 Typed Component Props

Always type component props:

```typescript
// GOOD: Typed props
interface StudentRowProps {
  student: Student;
  onSelect: (id: string) => void;
}

export function StudentRow({ student, onSelect }: StudentRowProps) {
  return <tr onClick={() => onSelect(student.id)}>...</tr>;
}

// BAD: Untyped props
export function StudentRow(props) {
  return <tr onClick={() => props.onSelect(props.student.id)}>...</tr>;
}
```

### 23.3 DTO-Aware Frontend Typing

Frontend types match backend DTOs:

```typescript
// Match backend DTO
interface CreateStudentDto {
  firstName: string;
  lastName: string;
  documentNumber: string;
}
```

### 23.4 Avoiding Implicit Any

Never use implicit `any`:

```typescript
// BAD: Implicit any
function processData(data) {
  return data.map(d => d.value);
}

// GOOD: Explicit types
function processData(data: DataItem[]): number[] {
  return data.map((d) => d.value);
}
```

### 23.5 Predictable Type Boundaries

Clear type ownership:

```typescript
// API response types in lib/api/*
interface Grade { ... }

// Component props in components/*
interface Props { ... }

// Zustand stores in stores/*
interface State { ... }
```

### 23.6 Forbidden TypeScript Patterns

Frontend MUST NOT:

- Use excessive `any` types
- Create unsafe type assertions
- Skip explicit return types
- Use weak typing for API contracts

---

## 24. Maintainability Standards

### 24.1 Readability

Code MUST be readable:

- Clear variable names
- Single responsibility functions
- Avoid clever tricks
- Comment complex logic

### 24.2 Composability

Build composable components:

```typescript
// GOOD: Composable
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <Content />
  </CardContent>
</Card>
```

### 24.3 Simplicity Over Cleverness

Prefer obvious over clever:

```typescript
// GOOD: Obvious pattern
const filtered = students.filter(s => s.active);

// BAD: Clever but unclear
const filtered = students?.reduce((a, s) => s.active && [...a, s], []) ?? [];
```

### 24.4 Reusable Abstractions

Extract common patterns:

```typescript
// Extract shared hook
export function useEntity CRUD(entity: string) {
  const queryClient = useQueryClient();
  const create = useMutation(...);
  const update = useMutation(...);
  return { create, update };
}
```

### 24.5 Explicit Architecture

Clear boundaries:

- Server vs client components
- React Query for server state
- Zustand for UI state
- API layer isolation

### 24.6 Forbidden Maintainability Patterns

Frontend MUST NOT:

- Create speculative abstractions
- Build giant files
- Duplicate logic
- Introduce tight coupling
- Hide side effects

---

## 25. Preferred Patterns

These are the recommended patterns for EduSystem frontend development:

### 25.1 Server Components by Default

Use server components unless interactivity requires client.

### 25.2 React Query for Server State

All API data via React Query hooks with typed queries/mutations.

### 25.3 Zustand for Client State Only

UI state only (modals, sidebars) in Zustand, never API cache.

### 25.4 Composable UI Primitives

Build with shadcn/ui primitives for consistency.

### 25.5 Feature-Oriented Organization

Organize by feature with `_components/` subfolders.

### 25.6 Typed API Integration

Type-safe API client with response typing.

### 25.7 Isolated Responsibilities

Each component/hook does one thing well.

### 25.8 Predictable Loading/Error UX

Skeletons for loading, graceful errors, retry capability.

### 25.9 Accessibility-Aware Interfaces

Use Radix primitives, semantic HTML, keyboard navigation.

### 25.10 Auth-Aware Rendering

Role-based UI, ON_LEAVE mutation blocking.

---

## 26. Forbidden Patterns

These patterns are strictly prohibited in EduSystem frontend:

### 26.1 Giant Client Components

Components should be under 200 lines.

### 26.2 Hydration Mismatch Risks

Server and client must render identically.

### 26.3 Duplicated Fetch Logic

Use shared React Query hooks.

### 26.4 Server-State in Zustand

Use React Query for server data.

### 26.5 Excessive 'use client'

Server components by default.

### 26.6 Tightly Coupled UI Logic

Keep components modular.

### 26.7 Inconsistent Loading UX

Always show loading states.

### 26.8 Unsafe Auth Assumptions

Always verify on backend.

### 26.9 Untyped API Responses

Always type API responses.

### 26.10 Inaccessible UI Patterns

Use accessible Radix primitives.

---

## 27. Good Examples

These examples demonstrate proper implementation of EduSystem patterns:

### 27.1 Proper Server/Client Component Separation

```typescript
// app/admin/grades/page.tsx - Server component
'use client';

import { useState } from 'react';
import { useGrades } from '@/lib/api/grades';
import { useIsOnLeave } from '@/lib/hooks/use-is-on-leave';
import { CreateGradeDialog } from './_components/create-grade-dialog';
import { GradesTable } from './_components/grades-table';

export default function GradesPage() {
  const [view, setView] = useState<'list' | 'bulk'>('list');
  const isOnLeave = useIsOnLeave();
  const { data: grades } = useGrades({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notas</h1>
        {!isOnLeave && <CreateGradeDialog />}
      </div>
      <GradesTable grades={grades} />
    </div>
  );
}
```

### 27.2 React Query Hook with Filters

```typescript
// src/lib/api/grades.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Grade { ... }

export function useGrades(filters?: {
  studentId?: string;
  courseSubjectId?: string;
  periodId?: string;
  courseId?: string;
}) {
  return useQuery({
    queryKey: ['grades', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.studentId) params.set('studentId', filters.studentId);
      if (filters?.courseSubjectId) params.set('courseSubjectId', filters.courseSubjectId);
      if (filters?.periodId) params.set('periodId', filters.periodId);
      if (filters?.courseId) params.set('courseId', filters.courseId);
      const res = await api.get<Grade[]>(`/grades?${params.toString()}`);
      return res.data;
    },
  });
}

export function useCreateGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateGradeDto) => {
      const res = await api.post<Grade>('/grades', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast.success('Nota cargada exitosamente');
    },
    onError: () => toast.error('Error al cargar la nota'),
  });
}
```

### 27.3 Lightweight Zustand Store for UI State

```typescript
// src/lib/stores/ui-store.ts
import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activeModal: string | null;
  openModal: (modal: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));
```

### 27.4 Auth-Aware Layout

```typescript
// src/components/layouts/app-layout.tsx
'use client';

import { useState } from 'react';
import { AppSidebar } from './components/sidebar';
import { AppHeader } from './components/app-header';
import { LeaveBanner } from '@/components/leave-banner';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-muted/30">
      <aside className="hidden md:flex md:w-60 md:flex-col border-r bg-background">
        <AppSidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-background border-r">
            <AppSidebar onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <LeaveBanner />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 27.5 Form with Zod Validation

```typescript
// Using React Hook Form + Zod + shadcn/ui
const form = useForm<CreateStudentForm>({
  resolver: zodResolver(createStudentSchema),
  defaultValues: {
    firstName: '',
    lastName: '',
    documentNumber: '',
  },
});

async function onSubmit(data: CreateStudentForm) {
  await createStudent.mutateAsync(data);
  form.reset();
  setOpen(false);
  toast.success('Estudiante creado');
}
```

---

## 28. Bad Examples

These examples demonstrate anti-patterns that must be avoided:

### 28.1 Giant Client Component

```typescript
// FORBIDDEN: 500+ line client component
'use client';

export function StudentDetailPage() {
  const [tab, setTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  // ... 400 more lines of mixed logic
}
```

### 28.2 Storing Server-State in Zustand

```typescript
// FORBIDDEN: Server state in Zustand
export const useStudentStore = create((set) => ({
  students: [],
  setStudents: (students) => set({ students }),
}));

// Usage in component - WRONG!
const { students, setStudents } = useStudentStore();
const { data } = useStudents();
setStudents(data); // Duplicates React Query!
```

### 28.3 Duplicated API Logic

```typescript
// FORBIDDEN: Duplicate fetch logic
function useStudentsA() {
  const { data } = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get('/students'),
  });
  return data;
}

function useStudentsB() { // Duplicate!
  const { data } = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get('/students'),
  });
  return data;
}
```

### 28.4 Unnecessary 'use client'

```typescript
// FORBIDDEN: Unnecessary client component
'use client'; // Not needed!

export function StudentList({ students }) { // No client-side logic
  return (
    <ul>
      {students.map((s) => (
        <li key={s.id}>{s.name}</li>
      ))}
    </ul>
  );
}
```

### 28.5 Untyped API Responses

```typescript
// FORBIDDEN: Untyped API response
const { data } = await api.get('/students'); // No type!
console.log(data[0].name); // Unsafe
```

### 28.6 Missing Loading States

```typescript
// FORBIDDEN: No loading indicator
function StudentsList() {
  const { data: students } = useStudents();

  return <div>{students?.map(s => <span>{s.name}</span>)}</div>; // Blank during load!
}
```

### 28.7 Inaccessible Form

```typescript
// FORBIDDEN: Missing form labels
<form>
  <input placeholder="Nombre" /> {/* No label! */}
  <button>Enviar</button>
</form>
```

---

## 29. Review Heuristics

These heuristics help reviewers identify architectural drift and pattern violations:

### 29.1 Server/Client Boundaries

- [ ] Is 'use client' used only when necessary?
- [ ] Are server components fetching data appropriately?
- [ ] Any browser APIs in server components?

### 29.2 React Query Usage

- [ ] Are API hooks in `src/lib/api/`?
- [ ] Query keys consistent and array-based?
- [ ] Mutations invalidate correct queries?
- [ ] No server-state in Zustand?

### 29.3 Zustand Usage

- [ ] Only storing UI state?
- [ ] No API data in stores?
- [ ] Stores are small and focused?

### 29.4 Component Architecture

- [ ] Components under 200 lines?
- [ ] Feature-oriented organization?
- [ ] Reusing shadcn/ui primitives?

### 29.5 Auth/Tenant Safety

- [ ] Session from `useAppSession()`?
- [ ] Institution from session, not client?
- [ ] Role-based rendering correct?

### 29.6 Accessibility

- [ ] Semantic HTML used?
- [ ] Keyboard navigation works?
- [ ] Form labels present?

### 29.7 TypeScript

- [ ] Explicit types on props?
- [ ] API responses typed?
- [ ] No excessive `any`?

---

## 30. Refactoring Guidelines

Refactoring must preserve user experience and accessibility guarantees.

### 30.1 When to Refactor

Refactor when:
- Components exceed 200 lines
- Logic is duplicated across hooks
- Server-state is stored incorrectly
- Performance issues detected

### 30.2 Safe Refactoring Practices

1. **Preserve UX** — Keep loading/error states consistent
2. **Preserve accessibility** — Don't break keyboard navigation
3. **Preserve state management** — Keep React Query for server, Zustand for UI
4. **Preserve types** — Don't weaken typing

### 30.3 Avoid Unnecessary Rewrites

Don't refactor:
- Working code that follows patterns correctly
- Code needing features, not restructuring
- Stable components for theoretical improvements

### 30.4 Incremental Changes

Refactor in small steps:
1. Extract duplicated logic into shared hook
2. Move server-state from Zustand to React Query
3. Break giant component into focused subcomponents
4. Add proper types to untyped components

### 30.5 Verification

After refactoring:
- Run lint and typecheck
- Verify loading/error states work
- Check accessibility still works
- Test auth-aware behavior

---

## 31. Development Workflow Expectations

Before implementing any frontend feature, engineers and AI agents MUST follow this workflow:

### 31.1 Analyze Existing Patterns

Before writing code:
1. Find similar existing pages/components
2. Understand established patterns
3. Identify reusable hooks
4. Plan component structure

### 31.2 Preserve Frontend Consistency

- Follow existing patterns exactly
- Don't introduce stylistic variation
- Use existing components and hooks
- Match naming conventions

### 31.3 Reuse Existing Components

- Use shadcn/ui primitives
- Use React Query hooks from `src/lib/api/`
- Use session hooks from `src/lib/hooks/`
- Don't recreate existing patterns

### 31.4 Preserve Accessibility Guarantees

- Use accessible primitives
- Maintain keyboard navigation
- Keep semantic HTML
- Test with screen readers

### 31.5 Avoid Speculative Abstractions

- Don't build features you aren't going to need
- Don't create generic frameworks
- Use existing patterns instead of inventing new ones

### 31.6 Preserve Auth-Aware Behavior

- Role-based rendering via session
- ON_LEAVE blocking via hook
- Protected layouts via AppLayout

---

## 32. Validation Checklist

Before submitting any frontend code, verify:

### Server/Client Components
- [ ] Server components used by default
- [ ] 'use client' only where necessary
- [ ] No browser APIs in server components
- [ ] No hydration mismatches

### React Query
- [ ] API hooks in `src/lib/api/[domain].ts`
- [ ] Query keys are arrays and consistent
- [ ] Mutations invalidate correct queries
- [ ] Stale time configured appropriately

### Zustand
- [ ] Only UI state in Zustand
- [ ] No API data in stores
- [ ] Stores are small and focused

### Auth & Session
- [ ] Session via `useAppSession()`
- [ ] Role-based rendering correct
- [ ] ON_LEAVE blocking works
- [ ] Institution from session

### API Integration
- [ ] Using centralized `api` client
- [ ] Responses are typed
- [ ] Errors handled consistently

### UI Components
- [ ] Using shadcn/ui primitives
- [ ] Components under 200 lines
- [ ] Feature-oriented organization

### Forms
- [ ] React Hook Form + Zod
- [ ] Loading states shown
- [ ] Form reset after success

### Accessibility
- [ ] Semantic HTML
- [ ] Keyboard navigation works
- [ ] Form labels present

### TypeScript
- [ ] Explicit types on props
- [ ] No excessive `any`
- [ ] API responses typed

---

## 33. Expected Quality Standards

All EduSystem frontend code MUST meet these quality standards:

### Functional Requirements
- All features work as designed
- Loading/error states present
- Forms validate correctly
- Auth-aware behavior works

### Code Quality
- Server components by default
- React Query for server state
- Zustand only for UI state
- Consistent patterns throughout

### User Experience
- Loading skeletons for async
- Error handling with retry
- Empty states meaningful
- Forms responsive

### Accessibility
- Keyboard navigation works
- Screen reader compatible
- Semantic HTML used
- Focus management proper

### Security
- No sensitive data exposed
- Auth handled server-side
- XSS prevention in place

### Maintainability
- Clear component boundaries
- Reusable hooks and components
- Type-safe throughout
- Organized file structure

---

## 34. Navigation System

### 34.1 Navigation Principles

- Navigation is **config-driven**. All nav items are defined in `navigation/config.ts`, not in components.
- Sidebar groups represent **functional domains**, not user roles. A "GESTIÓN DOCENTE" group is always named the same regardless of who sees it.
- **Dashboard is standalone** — it renders above groups with a visual separator.
- **Chat is intentionally excluded** from the sidebar. Access is via the header icon.
- **Nested items use `children`** on `NavItem`. Parent items can be clickable (have `href`) or act as containers only.
- **Only nested items are collapsible.** Groups are always visible and not accordions.
- `SidebarProvider` is required at the layout level.

### 34.2 Navigation Structure

```typescript
// navigation/types.ts
export type NavItem = {
  name: string;
  href?: string;         // optional for container-only parents
  icon?: LucideIcon;
  children?: NavItem[];  // nested sub-items
  roles?: string[];      // future: permission filtering
};

export type NavGroup = {
  title: string;
  items: NavItem[];
  roles?: string[];
};

export type NavigationConfig = {
  dashboard: NavItem;     // standalone top item
  groups: NavGroup[];
};
```

### 34.3 Active State Strategy

- **Dashboard**: exact match only (`pathname === href`)
- **Regular items**: `pathname === href || pathname.startsWith(href + '/')`
- **Parent items**: active if any child is active
- **Nested items**: same as regular items
- **Key**: `pathname.startsWith(href + '/')` prevents false positives (e.g. `/admin/attendance` matching `/admin/attendance-detail`)

### 34.4 Sidebar Architecture

```
<SidebarProvider>              // app-layout.tsx
  <Sidebar collapsible="icon"> // AppSidebar
    <SidebarHeader>            // SidebarBrand
    <SidebarContent>           // scrollable nav area
      <SidebarMenu>            // Dashboard item (standalone)
      <SidebarSeparator />
      <SidebarGroup>           // per domain
        <SidebarGroupLabel>    // "ADMINISTRACIÓN"
        <SidebarMenu>          // items
          <Collapsible>        // only for items with children
    <SidebarFooter>            // SidebarUser (avatar + dropdown)
    <SidebarRail />            // drag handle for resize
```

### 34.5 Anti-patterns

Do NOT:
- Hardcode sidebar items inside components
- Create role-specific sidebar components
- Use string separators as fake section labels (`'— Panel del docente —'`)
- Duplicate route definitions in multiple places
- Create sidebar implementations outside shadcn Sidebar primitives
- Distribute navigation logic across multiple components
- Add Chat to the sidebar (header-only entry point)
- Make groups collapsible/accordion (groups are always visible)

### 34.6 Future Extensibility

The architecture is prepared for:
- `roles?: string[]` per item/group for granular filtering
- `SidebarMenuBadge` for notification counters
- SuperAdmin navigation with platform-wide modules
- Analytics/metrics sections in dedicated groups
- Multi-tenant administrative routes

---

## References

- `docs/ARCHITECTURE.md` — High-level system design
- `docs/AUTH.md` — Authentication and session management
- `docs/MULTITENANCY.md` — Tenant context handling
- `AGENTS.md` — Frontend development rules (sections 6.x)

---

*This document is the authoritative frontend engineering standards reference for EduSystem. It complements existing architectural documentation with code-level pattern guidance.*