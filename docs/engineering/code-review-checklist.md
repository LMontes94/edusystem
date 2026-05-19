# EduSystem Code Review & Engineering Governance

> **Version:** 1.0  
> **Last Updated:** 2026-05-18  
> **Classification:** Internal — Engineering Governance  
> **Purpose:** Authoritative code review handbook for AI-assisted development within EduSystem

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Non-Goals](#3-non-goals)
4. [Required Context](#4-required-context)
5. [Core Review Principles](#5-core-review-principles)
6. [Architectural Consistency Review](#6-architectural-consistency-review)
7. [Backend Review Checklist](#7-backend-review-checklist)
8. [Frontend Review Checklist](#8-frontend-review-checklist)
9. [Prisma \& Database Review Checklist](#9-prisma--database-review-checklist)
10. [Authentication \& Authorization Review Checklist](#10-authentication--authorization-review-checklist)
11. [Multi-Tenancy Review Checklist](#11-multi-tenancy-review-checklist)
12. [Security Review Checklist](#12-security-review-checklist)
13. [Async Workflow Review Checklist](#13-async-workflow-review-checklist)
14. [Queue \& Worker Review Checklist](#14-queue--worker-review-checklist)
15. [API Design Review Checklist](#15-api-design-review-checklist)
16. [TypeScript Review Checklist](#16-typescript-review-checklist)
17. [Performance \& Scalability Review Checklist](#17-performance--scalability-review-checklist)
18. [Accessibility Review Checklist](#18-accessibility-review-checklist)
19. [Validation \& Error Handling Review Checklist](#19-validation--error-handling-review-checklist)
20. [Logging \& Observability Review Checklist](#20-logging--observability-review-checklist)
21. [File Upload \& Storage Review Checklist](#21-file-upload--storage-review-checklist)
22. [Maintainability Review Checklist](#22-maintainability-review-checklist)
23. [Refactoring Review Checklist](#23-refactoring-review-checklist)
24. [Technical Debt Detection](#24-technical-debt-detection)
25. [Architectural Drift Detection](#25-architectural-drift-detection)
26. [Preferred Patterns](#26-preferred-patterns)
27. [Forbidden Patterns](#27-forbidden-patterns)
28. [Good Review Examples](#28-good-review-examples)
29. [Bad Review Examples](#29-bad-review-examples)
30. [AI-Assisted Review Expectations](#30-ai-assisted-review-expectations)
31. [Pull Request Review Expectations](#31-pull-request-review-expectations)
32. [Review Severity Classification](#32-review-severity-classification)
33. [Merge Readiness Checklist](#33-merge-readiness-checklist)
34. [Final Validation Checklist](#34-final-validation-checklist)
35. [Expected Quality Standards](#35-expected-quality-standards)

---

## 1. Purpose

This document establishes EduSystem's authoritative code review and engineering governance standards. It serves as the primary reference for validating code quality, architectural consistency, tenant safety, and operational reliability across all pull requests and architectural decisions.

The document defines:

- **Review heuristics** that guide systematic code evaluation
- **Validation logic** that ensures security, correctness, and performance
- **Architectural drift detection** criteria for identifying pattern violations
- **Scalability validation** rules for long-term system health
- **Maintainability governance** standards for technical sustainability
- **Merge readiness criteria** that determine when code is ready for integration

This is not advisory — it is the authoritative source for all code review decisions within EduSystem.

---

## 2. Scope

This document applies to all code review activities within the EduSystem repository:

| Area | Scope |
|------|-------|
| **Backend** | NestJS controllers, services, guards, middleware, DTOs, BullMQ processors |
| **Frontend** | Next.js pages, React components, hooks, API integrations |
| **Database** | Prisma schemas, migrations, queries, transactions |
| **Workers** | BullMQ job processors, queue configurations, retry logic |
| **Storage** | MinIO integration, file upload handling, presigned URLs |
| **Infrastructure** | Docker Compose, environment configurations |

This document does **not** apply to:

- External service integrations (Firebase, external identity providers)
- Development tooling configuration (ESLint, Prettier configs)
- CI/CD pipeline definitions

---

## 3. Non-Goals

This document explicitly **does not** cover:

- **Implementation details** — covered by `backend-patterns.md`, `frontend-patterns.md`, `prisma-guidelines.md`
- **Security standards** — covered by `security-practices.md`
- **Testing procedures** — documented in testing guidelines
- **Code style rules** — covered by `AGENTS.md` section 16
- **Deployment procedures** — documented in infrastructure playbooks

Reviewers should reference these documents for implementation guidance; this document focuses on **review and validation**.

---

## 4. Required Context

Before performing any code review, engineers and AI systems **must** read and understand the following documents. These provide the authoritative context for all review decisions:

| Document | Purpose | When to Reference |
|----------|---------|-------------------|
| `docs/ARCHITECTURE.md` | High-level system design, technology stack, request lifecycle | Architecture decisions, module boundaries |
| `docs/AUTH.md` | JWT flows, refresh tokens, CASL authorization, role hierarchy | Auth/authorization review |
| `docs/DATABASE.md` | Prisma schema design, soft delete, audit logging, indexing | Database patterns |
| `docs/MULTITENANCY.md` | Tenant isolation, institutionId enforcement, shared-database architecture | Multi-tenancy validation |
| `docs/WORKERS.md` | BullMQ topology, queue security, worker tenant propagation, retry strategies | Queue/worker review |
| `docs/INFRASTRUCTURE.md` | Docker Compose, Redis, PostgreSQL, MinIO configuration | Infrastructure review |
| `docs/engineering/security-practices.md` | Security standards, forbidden patterns, security invariants | Security validation |
| `docs/engineering/backend-patterns.md` | NestJS patterns, controller/service conventions | Backend implementation |
| `docs/engineering/frontend-patterns.md` | Next.js patterns, React Query, component structure | Frontend implementation |
| `docs/engineering/prisma-guidelines.md` | Prisma patterns, query composition, transactions | Prisma review |
| `AGENTS.md` | AI agent behavioral expectations, forbidden patterns, workflow | AI review behavior |

---

## 5. Core Review Principles

All code reviews within EduSystem must be governed by these foundational principles:

### 5.1 Maintainability-First Review Culture

Every review decision must prioritize long-term maintainability over short-term convenience:

- **Complexity costs** — Adding complexity for marginal gains should be questioned
- **Consistency over cleverness** — Prefer established patterns over novel solutions
- **Explicit over implicit** — Code should be self-documenting; hidden behavior is suspicious

### 5.2 Architectural Consistency

Code must align with established architectural patterns:

- **Pattern alignment** — All code must follow patterns defined in this repository's documentation
- **Module boundaries** — Respect vertical slice module organization; avoid cross-module tight coupling
- **Convention adherence** — Follow file naming, code style, and structure conventions defined in AGENTS.md

### 5.3 Tenant Isolation Guarantees

The most critical security property of EduSystem is tenant isolation. Reviewers must actively validate:

- **institutionId enforcement** — Every tenant-scoped query must include `institutionId` filter
- **Tenant-safe operations** — All mutations, async jobs, and file paths must be tenant-aware
- **No cross-tenant access** — Any code that enables cross-tenant data access is a critical violation

### 5.4 Validation-First Development

All input must be validated at boundaries:

- **ZodPipe enforcement** — Every controller `@Body()` must use `ZodPipe` with Zod schema
- **Query validation** — Query parameters must use Zod schemas with `z.coerce` for type conversion
- **Frontend alignment** — React Hook Form + Zod schemas must match backend DTOs

### 5.5 Explicit Authorization Boundaries

Authorization must be explicit and enforced:

- **@CheckAbility() on every route** — All controller routes must declare required permissions
- **Server-side enforcement** — Never trust frontend authorization; backend is authoritative
- **Role hierarchy awareness** — Understand the role hierarchy: SUPER_ADMIN > ADMIN > DIRECTOR > SECRETARY > PRECEPTOR > TEACHER > GUARDIAN

### 5.6 Scalability-Aware Review

Code must support horizontal scaling:

- **Stateless design** — API and worker instances must be stateless
- **Async-first for heavy operations** — PDF generation, notifications, audit logs must use BullMQ
- **Pagination awareness** — All list endpoints must support pagination with reasonable defaults

### 5.7 Operational Simplicity

Prefer simple, operationally straightforward solutions:

- **Minimal dependencies** — Avoid introducing new libraries without justification
- **Predictable behavior** — Code should behave consistently across environments
- **Observability** — All significant operations must be logged with appropriate context

---

## 6. Architectural Consistency Review

### 6.1 Pattern Alignment Validation

Reviewers must validate that code follows established patterns:

| Check | Expected Pattern | Deviation Indicator |
|-------|-----------------|---------------------|
| Module structure | `modules/[name]/*.module.ts, *.controller.ts, *.service.ts, dto/` | Missing files, wrong naming |
| Controller pattern | Thin controllers delegating to services | Business logic in controllers |
| Service pattern | Rich services with business logic | Oversized services (>300 lines) |
| DTO pattern | Zod schemas in `dto/` folders with `z.infer<>` types | Missing DTOs, manual types |
| Queue pattern | Jobs dispatched after successful DB writes | Sync processing in request path |

### 6.2 Module Boundary Enforcement

- **Vertical slices** — Each module should be self-contained within its domain
- **No circular dependencies** — Modules must not import each other in circular ways
- **Shared modules** — Common functionality in `common/`, `config/`, `queues/`

### 6.3 Deviation Indicators

The following are architectural drift indicators:

```typescript
// SUSPICIOUS: Business logic in controller
@Controller('grades')
export class GradesController {
  @Post()
  async create(@Body() dto: any) {
    // Controller doing business logic - violates thin controller pattern
    const grade = await this.prisma.grade.create({ ... });
    await this.notificationService.send(...);
  }
}

// SUSPICIOUS: Circular module dependency
// modules/students/students.module.ts imports GradesModule
// modules/grades/grades.module.ts imports StudentsModule
```

---

## 7. Backend Review Checklist

### 7.1 Controller Validation

| Item | Criteria | Severity |
|------|----------|----------|
| Thin controller | Controller contains only routing, guards, DTO parsing | Critical |
| @CheckAbility() present | Every route has explicit CASL authorization | Critical |
| ZodPipe usage | Every `@Body()` uses `ZodPipe` with Zod schema | Critical |
| @InstitutionId() usage | All tenant-scoped routes inject institutionId | Critical |
| @Public() justification | Any `@Public()` route has documented justification | High |
| Return type explicit | Controller methods have explicit return type annotations | Medium |
| No business logic | Controller does not contain business logic | Critical |

### 7.2 Service Layer Validation

| Item | Criteria | Severity |
|------|----------|----------|
| Business logic location | All business logic in services, not controllers | Critical |
| institutionId filter | All tenant-scoped queries include `where: { institutionId }` | Critical |
| Prisma transaction | Multi-step writes use `prisma.$transaction()` | High |
| Queue dispatch | Async operations dispatch BullMQ jobs after successful writes | High |
| Ownership validation | Service validates entity ownership before mutations | High |
| No raw SQL | Services do not use `prisma.$queryRaw` for business logic | High |

### 7.3 Guard & Middleware Validation

| Item | Criteria | Severity |
|------|----------|----------|
| Global guards | JwtAuthGuard, OnLeaveGuard applied globally | Critical |
| Route-level guards | CaslGuard applied via `@UseGuards(CaslGuard)` | Critical |
| TenantMiddleware | Applied in app.module.ts before guards | Critical |
| No new global guards | Creating new global guards requires architectural review | Critical |

### 7.4 DTO & Validation Review

| Item | Criteria | Severity |
|------|----------|----------|
| Zod schema present | Every POST/PUT/PATCH has Zod schema in dto/ folder | Critical |
| Strict validation | Use `.strict()` to reject unknown fields | High |
| Type inference | Use `z.infer<>` to generate TypeScript types | Medium |
| Error messages | Validation errors have Spanish user-facing messages | Medium |
| Query DTOs | Query parameters use Zod schemas with `z.coerce` | High |

---

## 8. Frontend Review Checklist

### 8.1 Server/Client Component Boundaries

| Item | Criteria | Severity |
|------|----------|----------|
| Server components | Pages use 'use client' only when necessary | Medium |
| Client components | Interactive UI marked with 'use client' | Medium |
| No hydration mismatch | No client/server content differences | High |
| RSC usage | Use React Server Components for data fetching where possible | Medium |

### 8.2 React Query Consistency

| Item | Criteria | Severity |
|------|----------|----------|
| Server state via React Query | API data uses useQuery hooks | Critical |
| Query key structure | `['resource', filters]` pattern for cache invalidation | Medium |
| onError defined | All useMutation hooks have onError handler | High |
| Invalidations correct | Mutations invalidate related query keys | High |
| No inline fetch | No useEffect with fetch; use React Query hooks | Medium |

### 8.3 Zustand Discipline

| Item | Criteria | Severity |
|------|----------|----------|
| Client state only | Zustand for client-only state (UI state), not server state | High |
| No server state duplication | React Query + Zustand for same data = warning | Medium |
| Store organization | Logical store grouping by feature | Low |

### 8.4 Component Organization

| Item | Criteria | Severity |
|------|----------|----------|
| Page component thin | page.tsx only orchestrates state, delegates to components | Medium |
| Child components isolated | Complex UI in `_components/` subfolder | Medium |
| No oversized components | Components under 200 lines | Medium |
| Props drilling avoided | Use composition or context for deep prop chains | Low |

### 8.5 Loading/Error UX

| Item | Criteria | Severity |
|------|----------|----------|
| Loading states | All async operations show loading feedback | High |
| Error states | Errors display user-friendly messages via sonner | High |
| Empty states | Lists show appropriate empty state when no data | Low |

### 8.6 Accessibility Validation

| Item | Criteria | Severity |
|------|----------|----------|
| Semantic HTML | Use proper HTML elements (button, input, label) | High |
| Focus management | Dialogs manage focus correctly | High |
| Keyboard accessibility | All interactions keyboard-accessible | High |
| Form labels | All inputs have associated labels | Critical |
| ARIA usage | Complex components use ARIA appropriately | Medium |

---

## 9. Prisma & Database Review Checklist

### 9.1 Tenant-Safe Queries

| Item | Criteria | Severity |
|------|----------|----------|
| institutionId in WHERE | Every `findMany`/`findFirst` on tenant models includes institutionId | Critical |
| No unscoped queries | Query without institutionId filter on tenant model = Critical | Critical |
| Unique constraints | Unique constraints scoped by institution (e.g., documentNumber per institution) | High |

### 9.2 Query Efficiency

| Item | Criteria | Severity |
|------|----------|----------|
| Pagination | All list queries use `take`/`skip` with reasonable defaults (20/100) | High |
| Select fields | Queries use `select` to retrieve only required fields | Medium |
| No N+1 | Related data loaded via `include` or batched, not N+1 | High |
| Include discipline | `include` only necessary relations; use `select` for specific fields | Medium |

### 9.3 Transaction Safety

| Item | Criteria | Severity |
|------|----------|----------|
| Multi-step writes | Use `prisma.$transaction()` for atomic operations | High |
| Error handling | Transaction errors caught and transformed to domain exceptions | High |
| No long transactions | Avoid holding transactions across async operations | Medium |

### 9.4 Soft-Delete Awareness

| Item | Criteria | Severity |
|------|----------|----------|
| Middleware handles filtering | Prisma middleware automatically adds `deletedAt: null` | - |
| No manual deletedAt filter | Services should not manually filter deletedAt | Medium |
| Soft-delete models | Institution, User, Student, Announcement have soft-delete | - |

### 9.5 Forbidden Patterns

| Item | Detection | Severity |
|------|-----------|----------|
| Unscoped queries | `prisma.student.findMany({})` without institutionId | Critical |
| Unbounded queries | No `take`/`skip` on potentially large result sets | High |
| Oversized includes | `include: { grades: true, attendances: true, convivencias: true }` | High |
| Raw SQL for business | Using `$queryRaw` for business logic | High |

---

## 10. Authentication & Authorization Review Checklist

### 10.1 JWT & Token Handling

| Item | Criteria | Severity |
|------|----------|----------|
| Access token TTL | 15 minutes - no extensions | Critical |
| Refresh token rotation | New refresh token issued on every refresh | High |
| Token not in logs | No tokens logged, no tokens in error messages | Critical |
| Secure storage | Tokens not in localStorage or accessible to JS | High |

### 10.2 CASL Authorization

| Item | Criteria | Severity |
|------|----------|----------|
| @CheckAbility() on every route | All controller routes declare required permissions | Critical |
| Correct subject/action | CASL subject and action match operation | High |
| Server-side enforcement | Authorization not trustable to frontend | Critical |
| Role hierarchy understanding | Effective role computed via `getHighestRole()` | High |

### 10.3 OnLeaveGuard Validation

| Item | Criteria | Severity |
|------|----------|----------|
| Global guard applied | OnLeaveGuard blocks mutations for ON_LEAVE users | Critical |
| Exempt paths | Leave-related paths properly exempt | High |
| Client-side gating | Frontend uses `useIsOnLeave()` for UX disable | Medium |

### 10.4 Forbidden Patterns

```typescript
// FORBIDDEN: Trusting frontend authorization
const canEdit = user.role === 'ADMIN'; // Just UI hiding, not real security

// FORBIDDEN: Missing @CheckAbility()
@Get()
findAll() { } // No explicit authorization

// FORBIDDEN: Auth logic in controller
@Post()
async create(@Body() dto: any) {
  if (!user.isAdmin) throw new ForbiddenException(); // Should be CASL
}
```

---

## 11. Multi-Tenancy Review Checklist

### 11.1 institutionId Source Validation

| Item | Criteria | Severity |
|------|----------|----------|
| From JWT | institutionId extracted from JWT via `@InstitutionId()` decorator | Critical |
| Not from client | institutionId never from request body, params, or headers | Critical |
| Job payloads | All BullMQ job payloads include institutionId | Critical |
| File paths | All MinIO object paths include institutionId prefix | High |

### 11.2 Tenant-Safe Operations

| Item | Criteria | Severity |
|------|----------|----------|
| API queries | Every tenant-scoped Prisma query filters by institutionId | Critical |
| Service methods | Service methods accept institutionId as explicit parameter | Critical |
| JOIN validation | Related entities validated to belong to same institution before creating relations | High |
| SUPER_ADMIN handling | Code handles institutionId: null for SUPER_ADMIN | High |

### 11.3 Tenant Leak Detection

| Item | Detection | Severity |
|------|-----------|----------|
| Missing institutionId filter | Query without institutionId on tenant-scoped model | Critical |
| Client-provided institutionId | Trusting institutionId from request body | Critical |
| Tenant-unaware async jobs | Job without institutionId in payload | Critical |
| Cross-tenant JOIN | Query that could return data from multiple institutions | Critical |

---

## 12. Security Review Checklist

### 12.1 Validation Enforcement

| Item | Criteria | Severity |
|------|----------|----------|
| ZodPipe on all bodies | Every POST/PUT/PATCH validates via ZodPipe | Critical |
| Query param validation | Query parameters use Zod schemas | High |
| Strict schemas | Use `.strict()` to reject unknown fields | High |
| No raw input | Services never receive unvalidated input | Critical |

### 12.2 Secure Uploads

| Item | Criteria | Severity |
|------|----------|----------|
| MIME type validation | Server-side MIME check, not just extension | Critical |
| Size limits | Enforce max file size (10MB avatars, 50MB documents) | Critical |
| UUID filenames | Use UUID to prevent path traversal | High |
| No execution | Uploaded files never executed | Critical |

### 12.3 Defensive Programming

| Item | Criteria | Severity |
|------|----------|----------|
| No any | No `any` types; use `unknown` with type guards | High |
| No non-null assertions | No `!` unless absolutely certain | Medium |
| Safe error responses | Production returns generic errors, not internals | High |
| No eval | No dynamic code execution | Critical |

### 12.4 Secret Handling

| Item | Criteria | Severity |
|------|----------|----------|
| No secrets in code | All secrets via environment variables | Critical |
| No secrets in logs | Tokens, passwords, secrets never logged | Critical |
| No secrets in job payloads | Queue jobs never include passwords or API keys | Critical |

---

## 13. Async Workflow Review Checklist

### 13.1 Idempotency Validation

| Item | Criteria | Severity |
|------|----------|----------|
| Idempotent processors | All BullMQ processors check for existing operations before side effects | High |
| Idempotency keys | Critical operations use idempotency keys to prevent duplicates | High |
| Retry behavior | Failed jobs are safely retried without duplicate side effects | High |

### 13.2 Retry Safety

| Item | Criteria | Severity |
|------|----------|----------|
| Non-retriable handling | Invalid payloads handled without retry (return, don't throw) | Medium |
| Retriable error handling | Transient failures re-thrown for retry | Medium |
| Appropriate attempts | Critical jobs (audit) use CRITICAL retry strategy (5 attempts) | High |

### 13.3 Consistency Guarantees

| Item | Criteria | Severity |
|------|----------|----------|
| Strong consistency | Core operations (grades, attendance) maintain strong consistency | High |
| Eventual consistency | Notifications, audit logs use eventual consistency | Medium |
| No partial assumptions | Code doesn't assume async operations complete immediately | Medium |

---

## 14. Queue & Worker Review Checklist

### 14.1 Payload Validation

| Item | Criteria | Severity |
|------|----------|----------|
| institutionId in payload | Every job includes institutionId | Critical |
| Lightweight payloads | Jobs include IDs, not full objects | Medium |
| No secrets | Jobs never include passwords, tokens, or API keys | Critical |
| Typed interfaces | Job payload has TypeScript interface | Medium |

### 14.2 Worker Behavior

| Item | Criteria | Severity |
|------|----------|----------|
| Stateless workers | Workers process one job at a time, no cross-job state | - |
| Tenant-aware queries | Worker queries scope to institutionId from job payload | Critical |
| Safe processing | Processor queries validate entity ownership | High |

### 14.3 Job Options

| Item | Criteria | Severity |
|------|----------|----------|
| Appropriate strategy | Jobs use correct JOB_OPTIONS (DEFAULT, CRITICAL, LOW_PRIORITY) | High |
| Audit logging uses CRITICAL | Audit log jobs use 5 attempts, exponential backoff | High |
| Notification uses DEFAULT | Notification jobs use 3 attempts | Medium |

---

## 15. API Design Review Checklist

### 15.1 Contract Validation

| Item | Criteria | Severity |
|------|----------|----------|
| Typed DTOs | All request/response use explicit TypeScript types | High |
| No any in responses | API responses never return `any` | High |
| Consistent return structure | Single resources return object, lists return array | Medium |
| Pagination support | List endpoints support page/limit | High |

### 15.2 Error Handling Consistency

| Item | Criteria | Severity |
|------|----------|----------|
| Standard exceptions | Use NestJS built-in exceptions (BadRequest, NotFound, Forbidden, etc.) | High |
| Consistent error format | GlobalExceptionFilter provides consistent JSON structure | Medium |
| Safe error messages | Production errors don't leak internals | High |
| Status code correctness | 400 validation, 401 auth, 403 authorization, 404 not found, 409 conflict | High |

### 15.3 Response Design

| Item | Criteria | Severity |
|------|----------|----------|
| No internal model exposure | API returns DTOs, not raw Prisma entities | High |
| Sensitive field exclusion | PasswordHash, refresh tokens never in responses | Critical |
| Predictable format | Similar endpoints return similar response shapes | Medium |

---

## 16. TypeScript Review Checklist

### 16.1 Strict Typing

| Item | Criteria | Severity |
|------|----------|----------|
| No any | No implicit or explicit `any` types | High |
| Explicit return types | All functions have explicit return type annotations | Medium |
| Parameter typing | All function parameters explicitly typed | Medium |
| No implicit any | Arrow functions also have explicit types | Medium |

### 16.2 Type Safety

| Item | Criteria | Severity |
|------|----------|----------|
| No unsafe casting | No `as` casts without type verification | High |
| Type guards | Use type guards to narrow `unknown` | Medium |
| Unknown handling | Use `unknown` when type is indeterminate, not `any` | Medium |

### 16.3 Interface Design

| Item | Criteria | Severity |
|------|----------|----------|
| Explicit interfaces | Use interfaces for API contracts | Medium |
| DTO typing | Use `z.infer<>` from Zod schemas for DTO types | Medium |
| Readonly usage | Use `readonly` for immutable data structures | Low |

---

## 17. Performance & Scalability Review Checklist

### 17.1 Query Scalability

| Item | Criteria | Severity |
|------|----------|----------|
| Pagination | All list queries use pagination (default 20, max 100) | High |
| No unbounded queries | Queries without take on tenant-scoped models | High |
| Proper indexes | Foreign key fields and filtered columns indexed | Medium |
| Query optimization | Use select/include efficiently, avoid over-fetching | Medium |

### 17.2 Async Scalability

| Item | Criteria | Severity |
|------|----------|----------|
| Heavy operations async | PDF generation, notifications, audit logs use BullMQ | Critical |
| No blocking in request | HTTP responses don't wait for async side effects | High |
| Worker concurrency | Processors handle concurrency appropriately | Medium |

### 17.3 Frontend Rendering

| Item | Criteria | Severity |
|------|----------|----------|
| No unbounded rendering | Large lists use virtualization or pagination | High |
| React.memo usage | Expensive components memoized to prevent re-renders | Medium |
| staleTime usage | React Query uses staleTime to reduce refetches | Low |
| Payload size discipline | API responses return only necessary fields | Medium |

---

## 18. Accessibility Review Checklist

### 18.1 Semantic HTML

| Item | Criteria | Severity |
|------|----------|----------|
| Proper elements | Use button for actions, input for entry, label for labels | High |
| Heading hierarchy | Proper h1-h6 nesting without skipping levels | Medium |
| Table semantics | Data tables use proper th/td structure | Medium |

### 18.2 Keyboard & Focus

| Item | Criteria | Severity |
|------|----------|----------|
| Keyboard accessible | All interactive elements reachable via keyboard | Critical |
| Focus visible | Focus states visible on all interactive elements | High |
| Focus management | Dialogs/dropdowns manage focus (trap, return on close) | High |
| No keyboard traps | No elements that trap keyboard focus | Critical |

### 18.3 Forms & Dialogs

| Item | Criteria | Severity |
|------|----------|----------|
| Associated labels | Every input has associated label (htmlFor/id or wrapped) | Critical |
| Error association | Form errors associated with inputs via aria-describedby | High |
| Dialog labeling | Dialogs have accessible names (title or aria-label) | High |

---

## 19. Validation & Error Handling Review Checklist

### 19.1 DTO Validation

| Item | Criteria | Severity |
|------|----------|----------|
| Zod schemas present | Every POST/PUT/PATCH body has Zod schema | Critical |
| Validation at boundary | ZodPipe validates in controller, not service | Critical |
| Error messages | Validation errors have Spanish user-facing messages | Medium |
| Strict mode | Use `.strict()` to reject unknown fields | High |

### 19.2 Exception Handling

| Item | Criteria | Severity |
|------|----------|----------|
| Domain exceptions | Use NestJS built-in exceptions (BadRequest, NotFound, etc.) | High |
| Prisma error transformation | Prisma errors caught and transformed to domain exceptions | High |
| No swallowed exceptions | Errors logged and re-thrown or transformed | High |

### 19.3 Error Exposure

| Item | Criteria | Severity |
|------|----------|----------|
| Production safe | Production returns generic error message | High |
| No internals leaked | Stack traces, DB details not in error responses | Critical |
| Request correlation | Errors include request ID for debugging | Medium |

---

## 20. Logging & Observability Review Checklist

### 20.1 Structured Logging

| Item | Criteria | Severity |
|------|----------|----------|
| Tenant context | Logs include institutionId when available | High |
| Log levels | Appropriate levels: log (info), warn (recoverable), error (critical) | Medium |
| Structured format | Logs use structured format for machine parsing | Low |

### 20.2 Audit Visibility

| Item | Criteria | Severity |
|------|----------|----------|
| Mutation logging | Significant mutations dispatch audit log jobs | High |
| Auth events | Login failures, authorization denials logged | Medium |

### 20.3 Forbidden Patterns

| Item | Detection | Severity |
|------|-----------|----------|
| Secrets in logs | JWT, passwords, API keys logged | Critical |
| PII in logs | Document numbers, personal data logged | High |
| No logging | Missing logs for significant operations | Medium |

---

## 21. File Upload & Storage Review Checklist

### 21.1 Upload Validation

| Item | Criteria | Severity |
|------|----------|----------|
| MIME type validation | Server-side MIME type check | Critical |
| File size limits | Max size enforced before upload | Critical |
| Extension validation | Extension checked against allowed types | Medium |
| UUID filenames | UUID prevents path traversal | High |

### 21.2 Storage Security

| Item | Criteria | Severity |
|------|----------|----------|
| Tenant path prefix | All paths include institutionId | High |
| Presigned URLs | Access via presigned URLs, not direct URLs | High |
| Short expiry | Presigned URLs expire within 3600 seconds | Medium |
| Private buckets | MinIO buckets not publicly accessible | Critical |

---

## 22. Maintainability Review Checklist

### 22.1 Code Organization

| Item | Criteria | Severity |
|------|----------|----------|
| File size | No file over 300 lines (split if larger) | Medium |
| Function size | No function over 50 lines (split if larger) | Medium |
| Single responsibility | Each file/module has clear, focused purpose | Medium |
| No duplication | Repeated logic extracted to shared utilities | Medium |

### 22.2 Naming & Structure

| Item | Criteria | Severity |
|------|----------|----------|
| Clear naming | Variable/function names reflect purpose | Medium |
| Convention adherence | File names follow kebab-case, classes PascalCase | Medium |
| Logical organization | Related code grouped logically | Low |

### 22.3 Complexity Management

| Item | Criteria | Severity |
|------|----------|----------|
| No giant services | Services under 300 lines | Medium |
| No giant components | React components under 200 lines | Medium |
| No deeply nested logic | Early returns, guard clauses preferred | Medium |

---

## 23. Refactoring Review Checklist

### 23.1 Invariant Preservation

| Item | Criteria | Severity |
|------|----------|----------|
| Tenant safety | Refactoring maintains institutionId enforcement | Critical |
| Auth behavior | Refactoring maintains authorization rules | Critical |
| Async safety | Refactoring maintains idempotency guarantees | High |

### 23.2 Backward Compatibility

| Item | Criteria | Severity |
|------|----------|----------|
| API contract stability | DTO changes don't break existing consumers | High |
| No breaking changes | Public interfaces maintain backward compatibility | High |
| Deprecation path | Removed features deprecated before removal | Medium |

### 23.3 Architectural Consistency

| Item | Criteria | Severity |
|------|----------|----------|
| Pattern alignment | Refactored code follows established patterns | Medium |
| Module boundaries | Refactoring respects vertical slice organization | Medium |

---

## 24. Technical Debt Detection

### 24.1 Duplication Detection

| Item | Detection | Severity |
|------|-----------|----------|
| Repeated logic | Same logic in multiple services/components | Medium |
| Copied code | Code blocks copied with minor variations | Medium |
| Duplicate utilities | Similar utilities not consolidated | Low |

### 24.2 Oversized Components

| Item | Detection | Severity |
|------|-----------|----------|
| Giant files | Files over 300 lines | Medium |
| Giant services | Services over 300 lines | Medium |
| Giant components | React components over 200 lines | Medium |

### 24.3 Architectural Drift

| Item | Detection | Severity |
|------|-----------|----------|
| Pattern violations | Code deviates from established patterns | Medium |
| Inconsistent abstractions | Different approaches to same problem | Medium |
| Weak module organization | Unclear module boundaries | Medium |

### 24.4 Fragile Async Workflows

| Item | Detection | Severity |
|------|-----------|----------|
| Retry-unsafe logic | Operations that fail on retry | High |
| Hidden side effects | Async operations not visible in code flow | High |
| Partial consistency | Assumptions about async completion timing | Medium |

---

## 25. Architectural Drift Detection

### 25.1 Pattern Deviation

Reviewers must actively detect deviations from established patterns:

| Pattern | Expected | Deviation |
|---------|----------|-----------|
| Module structure | modules/[name]/*.module.ts, *.controller.ts, *.service.ts | Missing files, wrong organization |
| Controller behavior | Thin, delegates to service | Business logic in controller |
| Service behavior | Business logic, Prisma, queue dispatch | Oversized, does routing |
| Validation | ZodPipe on controller | Validation in service |
| Queue dispatch | After successful DB writes | Sync processing |

### 25.2 Unauthorized Abstractions

- **No new global guards** — Creating new global guards requires architectural review
- **No new modules** — New modules should follow existing pattern
- **No new libraries** — Adding dependencies needs justification

### 25.3 Inconsistent Organization

- **Module boundaries** — Cross-module dependencies should be minimal
- **File organization** — Files should be in expected locations per AGENTS.md
- **API design** — Endpoints should follow REST conventions

---

## 26. Preferred Patterns

The following patterns are encouraged and should be present in all code:

### 26.1 Backend Patterns

- **Thin controllers** — Controllers handle routing, guards, DTO parsing only
- **Rich services** — All business logic in services
- **Zod validation** — ZodPipe with strict schemas on all inputs
- **Queue-first async** — Heavy operations dispatched to BullMQ
- **Tenant-safe queries** — Every query includes institutionId filter

### 26.2 Frontend Patterns

- **Server state via React Query** — API data through useQuery/useMutation
- **Client state via Zustand** — UI state only in Zustand
- **Thin page components** — page.tsx orchestrates, delegates to components
- **Component isolation** — Complex UI in _components/ subfolder

### 26.3 Database Patterns

- **Tenant-safe queries** — institutionId filter on every tenant-scoped query
- **Pagination** — All list queries use take/skip
- **Transactions** — Multi-step writes use prisma.$transaction()
- **Select fields** — Queries specify needed fields only

### 26.4 Async Patterns

- **Idempotent processors** — Check before side effects
- **institutionId in payloads** — All jobs include tenant context
- **Typed job interfaces** — Job payloads have TypeScript interfaces

---

## 27. Forbidden Patterns

The following patterns are explicitly prohibited and must be flagged in reviews:

### 27.1 Critical Security Violations

- Cross-tenant data access (missing institutionId filter)
- Missing @CheckAbility() on controller routes
- Trusting client-provided institutionId
- Secrets in logs or job payloads

### 27.2 Architectural Violations

- Business logic in controllers
- Unbounded queries without pagination
- Sync processing of heavy operations in request path
- New global guards without architectural review

### 27.3 Type Safety Violations

- Using `any` types
- Unsafe casting without verification
- Missing explicit return types

### 27.4 Consistency Violations

- Inconsistent patterns across modules
- Duplicated logic not extracted
- File organization not following conventions

---

## 28. Good Review Examples

### 28.1 Tenant Safety Review

**Comment:**
```
CRITICAL: Missing institutionId filter in grade query (line 47).

Every tenant-scoped Prisma query must include `where: { institutionId }`. 
This query could return grades from all institutions.

Recommended fix:
  const grades = await this.prisma.grade.findMany({
    where: { 
      courseSubject: { course: { institutionId } },  // Add this filter
      studentId: dto.studentId,
    },
  });
```

### 28.2 Architectural Consistency Review

**Comment:**
```
HIGH: Business logic detected in controller (lines 23-45).

Per AGENTS.md section 5.2, controllers must be thin — routing, guards, 
and DTO parsing only. This controller contains grade calculation logic 
that should be in the service layer.

Recommended fix: Move grade calculation logic to GradesService.create()
and call it from controller with validated DTO.
```

### 28.3 Scalability Review

**Comment:**
```
HIGH: Unbounded query without pagination (line 52).

This findMany has no take/skip, potentially returning thousands of 
students in a single response. Per AGENTS.md section 11.3, all list 
endpoints must support pagination.

Recommended fix: Add page/limit query params with default 20, max 100.
```

### 28.4 Authorization Review

**Comment:**
```
CRITICAL: Missing @CheckAbility() decorator.

Every controller route must have explicit CASL authorization. This 
endpoint is accessible to any authenticated user.

Recommended fix:
  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Student' })
  findAll(@InstitutionId() institutionId: string) { ... }
```

### 28.5 Validation Review

**Comment:**
```
HIGH: Raw body parameter without ZodPipe validation.

Per docs/ARCHITECTURE.md "Validation-First APIs", all POST/PUT/PATCH 
bodies must be validated via ZodPipe. This endpoint accepts any input.

Recommended fix:
  @Post()
  create(@Body(new ZodPipe(CreateStudentSchema)) dto: CreateStudentDto) { }
```

---

## 29. Bad Review Examples

### 29.1 Vague Comments

**Bad:**
```
"Looks good"
"Consider improving this"
"Maybe add error handling"
```

**Why bad:** No specific issue identified, no actionable feedback.

### 29.2 Style-Only Reviews

**Bad:**
```
"Add a blank line here"
"Use const instead of let"
"Change variable name"
```

**Why bad:** Focuses on style, ignores architectural, security, or scalability issues.

### 29.3 Missing Analysis

**Bad:**
```
"Approved"
"LGTM"
```

**Why bad:** No evidence of architectural, security, or tenant safety review.

### 29.4 Superficial Security Review

**Bad:**
```
"Make sure to validate input"
```

**Why bad:** Doesn't specify where, how, or reference existing validation patterns.

### 29.5 Weak Scalability Analysis

**Bad:**
```
"Could be slow with large data"
```

**Why bad:** Doesn't identify specific issue, doesn't reference pagination requirements.

---

## 30. AI-Assisted Review Expectations

AI systems performing code review within EduSystem must:

### 30.1 Pre-Code Analysis

- Read relevant context documents before reviewing (per Section 4)
- Understand the module's domain and existing patterns
- Identify the constraint chain (guards, decorators, middleware affecting the code)

### 30.2 Review Priority

1. **Tenant safety** — Validate institutionId enforcement first (most critical)
2. **Security** — Validate auth, authorization, validation, secrets
3. **Architecture** — Validate pattern alignment, module boundaries
4. **Scalability** — Validate pagination, async patterns, performance
5. **Maintainability** — Validate code organization, type safety

### 30.3 Validation Requirements

AI reviewers must actively detect:

- **Cross-tenant access** — Any query without institutionId filter on tenant models
- **Auth bypasses** — Missing @CheckAbility(), trusting frontend authorization
- **Validation gaps** — Missing ZodPipe, raw input to services
- **Hidden side effects** — Async operations not visible in code flow
- **Architectural drift** — Code deviating from established patterns

### 30.4 Forbidden AI Behaviors

AI systems must NOT:

- Suggest speculative abstractions not present in existing codebase
- Ignore existing patterns in favor of "better" alternatives
- Prioritize cleverness over maintainability
- Introduce architectural drift
- Skip tenant safety validation
- Approve without reviewing security implications

---

## 31. Pull Request Review Expectations

### 31.1 Review Depth

Every PR review must validate:

| Area | Minimum Validation |
|------|-------------------|
| **Security** | Tenant isolation, auth, authorization, validation, secrets |
| **Architecture** | Pattern alignment, module boundaries, abstraction usage |
| **Correctness** | Logic accuracy, edge cases, error handling |
| **Performance** | Pagination, query efficiency, async patterns |
| **Maintainability** | Code organization, type safety, duplication |

### 31.2 Required Checks

Before approving any PR, verify:

- [ ] All tenant-scoped queries include institutionId filter
- [ ] All controller routes have @CheckAbility() decorator
- [ ] All POST/PUT/PATCH bodies use ZodPipe with Zod schema
- [ ] All async heavy operations use BullMQ (not sync in request)
- [ ] No secrets in code, logs, or job payloads
- [ ] All list endpoints support pagination
- [ ] TypeScript strict typing maintained (no any)
- [ ] Code follows established patterns from reference documents

### 31.3 Review Documentation

Every review must include:

- Specific issues identified (with line numbers)
- Severity classification (Critical/High/Medium/Low)
- Recommended fix for each issue
- Reference to relevant documentation (ARCHITECTURE.md, AGENTS.md, etc.)

---

## 32. Review Severity Classification

### 32.1 Critical

**Definition:** Immediate security risk or data integrity violation. Must block merge.

**Examples:**
- Cross-tenant data access (missing institutionId filter)
- Missing @CheckAbility() on sensitive routes
- Secrets exposed in code or logs
- Auth bypass vulnerabilities
- Production data loss risk

### 32.2 High

**Definition:** Significant issue that compromises security, correctness, or performance. Must address before merge.

**Examples:**
- Missing ZodPipe on POST/PUT/PATCH endpoints
- Unbounded queries without pagination
- Business logic in controllers
- Unsafe retry behavior
- Type safety violations (any types)

### 32.3 Medium

**Definition:** Code quality or maintainability issue. Should address before merge.

**Examples:**
- Inconsistent naming or formatting
- Missing error handling on non-critical paths
- Suboptimal query patterns (N+1)
- Missing React.memo on expensive components
- Insufficient logging for debugging

### 32.4 Low

**Definition:** Polish or preference. May address in follow-up.

**Examples:**
- Code style variations within conventions
- Minor duplication
- Missing comments on complex logic
- Non-essential file organization improvements

### 32.5 Suggestion

**Definition:** Improvement opportunity, not an issue. No merge blocking.

**Examples:**
- Alternative approach that could improve readability
- Future enhancement ideas
- Optimization opportunities for future consideration

---

## 33. Merge Readiness Checklist

Before any PR is merged, verify:

### 33.1 Tenant Safety

- [ ] All tenant-scoped Prisma queries include `where: { institutionId }`
- [ ] No queries accept institutionId from client (always from JWT)
- [ ] All BullMQ job payloads include institutionId
- [ ] All MinIO file paths include institutionId prefix

### 33.2 Security Guarantees

- [ ] All controller routes have @CheckAbility() decorator
- [ ] All POST/PUT/PATCH bodies validated via ZodPipe
- [ ] No secrets in code, logs, or job payloads
- [ ] Production-safe error responses (no internals leaked)

### 33.3 Scalability Expectations

- [ ] All list endpoints support pagination (page/limit)
- [ ] Heavy operations use BullMQ (not sync in request)
- [ ] No unbounded queries (take/skip on all findMany)

### 33.4 Maintainability

- [ ] No any types introduced
- [ ] Functions have explicit return types
- [ ] Code follows file naming conventions (kebab-case)
- [ ] No oversized files (under 300 lines)

### 33.5 Architectural Consistency

- [ ] Controllers are thin (no business logic)
- [ ] Services contain business logic only
- [ ] DTOs use Zod schemas with z.infer<> types
- [ ] Queue dispatch after successful DB writes

### 33.6 Validation Enforcement

- [ ] ZodPipe on every @Body() for POST/PUT/PATCH
- [ ] Query params validated via Zod with z.coerce
- [ ] Strict schemas (.strict()) to reject unknown fields
- [ ] Error messages in Spanish (user-facing)

### 33.7 Async Workflow Safety

- [ ] BullMQ processors are idempotent
- [ ] Job payloads include institutionId
- [ ] Critical operations use CRITICAL retry strategy
- [ ] No blocking in request path

### 33.8 Typing Consistency

- [ ] No any types
- [ ] Explicit return types on all functions
- [ ] Interfaces for API contracts (via z.infer<>)
- [ ] No unsafe casting

---

## 34. Final Validation Checklist

Before merging, confirm:

- [ ] **No tenant leaks** — All queries on tenant-scoped models filter by institutionId
- [ ] **No weak validation** — All inputs validated via ZodPipe with Zod schemas
- [ ] **No unsafe async** — All heavy operations use BullMQ, processors are idempotent
- [ ] **No security gaps** — Auth, authorization, secrets handling all correct
- [ ] **No scalability bottlenecks** — Pagination on all lists, efficient queries
- [ ] **No hidden side effects** — All async operations visible in code flow
- [ ] **Maintainability preserved** — No oversized files, clear organization
- [ ] **Operational simplicity** — No unnecessary complexity introduced
- [ ] **No architectural drift** — Code follows established patterns
- [ ] **No type safety violations** — No any, explicit types throughout

---

## 35. Expected Quality Standards

### 35.1 Enterprise-Grade Bar

All code merged to EduSystem must meet:

| Dimension | Standard |
|-----------|----------|
| **Security** | Zero tolerance for tenant leaks, auth bypasses, secret exposures |
| **Correctness** | All edge cases handled, proper error transformation |
| **Performance** | Pagination on all lists, efficient queries, async for heavy ops |
| **Maintainability** | Clear organization, explicit types, no duplication |
| **Consistency** | Follows all established patterns from reference documents |

### 35.2 Review Culture

- **Reviewers** — Validate thoroughly, don't approve superficial changes
- **Authors** — Write reviewable code, respond to feedback, test locally
- **AI systems** — Apply same standards as human reviewers, don't skip security

### 35.3 Continuous Improvement

- **Documentation** — Update reference docs when patterns evolve
- **Patterns** — Add new patterns to preferred/forbidden lists when established
- **Standards** — Review and update this document quarterly

---

*This document is the authoritative code review handbook for EduSystem. All reviewers must apply these standards consistently. Questions about interpretation should be escalated to the technical lead.*