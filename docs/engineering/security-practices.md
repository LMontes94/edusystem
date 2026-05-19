# EduSystem Security Engineering Standards

> **Version:** 1.0  
> **Last Updated:** 2026-05-18  
> **Classification:** Internal — Security Engineering  
> **Purpose:** Authoritative security engineering handbook for AI-assisted development within EduSystem

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Non-Goals](#3-non-goals)
4. [Required Context](#4-required-context)
5. [Core Security Principles](#5-core-security-principles)
6. [Authentication Security Rules](#6-authentication-security-rules)
7. [Authorization Security Rules](#7-authorization-security-rules)
8. [Multi-Tenancy Security Rules](#8-multi-tenancy-security-rules)
9. [API Security Rules](#9-api-security-rules)
10. [Backend Security Rules](#10-backend-security-rules)
11. [Frontend Security Rules](#11-frontend-security-rules)
12. [Database Security Rules](#12-database-security-rules)
13. [Prisma Security Rules](#13-prisma-security-rules)
14. [Queue & Worker Security Rules](#14-queue--worker-security-rules)
15. [Async Workflow Security Rules](#15-async-workflow-security-rules)
16. [File Upload & Storage Security Rules](#16-file-upload--storage-security-rules)
17. [MinIO/Object Storage Security Rules](#17-minioobject-storage-security-rules)
18. [Validation & Sanitization Rules](#18-validation--sanitization-rules)
19. [Session & Token Security Rules](#19-session--token-security-rules)
20. [Password & Credential Handling Rules](#20-password--credential-handling-rules)
21. [Logging & Observability Security Rules](#21-logging--observability-security-rules)
22. [Error Handling Security Rules](#22-error-handling-security-rules)
23. [Infrastructure Security Considerations](#23-infrastructure-security-considerations)
24. [Secure TypeScript Practices](#24-secure-typescript-practices)
25. [Scalability & Security Considerations](#25-scalability--security-considerations)
26. [Maintainability & Security Considerations](#26-maintainability--security-considerations)
27. [Preferred Security Patterns](#27-preferred-security-patterns)
28. [Forbidden Security Patterns](#28-forbidden-security-patterns)
29. [Security Invariants](#29-security-invariants)
30. [Good Examples](#30-good-examples)
31. [Bad Examples](#31-bad-examples)
32. [Review Heuristics](#32-review-heuristics)
33. [Refactoring Guidelines](#33-refactoring-guidelines)
34. [Incident Prevention Guidelines](#34-incident-prevention-guidelines)
35. [Development Workflow Expectations](#35-development-workflow-expectations)
36. [Validation Checklist](#36-validation-checklist)
37. [Expected Quality Standards](#37-expected-quality-standards)

---

## 1. Purpose

This document defines the authoritative security engineering standards for EduSystem, a large-scale multi-tenant SaaS educational management platform. It establishes mandatory security practices that must be followed by all engineers and AI-assisted development systems operating within the repository.

The document serves as the primary security engineering handbook, providing:

- **Operational security standards** for all layers of the system
- **Defensive programming guidelines** that prioritize tenant isolation and authentication safety
- **Secure-by-default architecture** expectations for every code change
- **Maintainability-focused security** that enables sustainable secure development

All security decisions within EduSystem must trace back to principles defined in this document. This is not advisory — it is the authoritative source for security expectations.

---

## 2. Scope

This document applies to all components of the EduSystem platform:

| Component | Scope |
|-----------|-------|
| **Backend** | NestJS REST API, BullMQ workers, Prisma ORM |
| **Frontend** | Next.js admin panel, NextAuth v5, React Query |
| **Database** | PostgreSQL 16, Prisma schema, migrations |
| **Queue/Worker** | BullMQ processors, job payloads, retry logic |
| **Storage** | MinIO S3-compatible object storage, presigned URLs |
| **Infrastructure** | Docker Compose, Redis, environment configuration |

This document does **not** apply to:

- External services (Firebase Cloud Messaging, external identity providers)
- Development tooling (ESLint, Prettier, TypeScript compiler)
- CI/CD pipelines (security of pipeline infrastructure is documented elsewhere)

---

## 3. Non-Goals

This document explicitly **does not** cover:

- **Public vulnerability disclosure** — handled by separate SECURITY.md
- **Penetration testing procedures** — documented in security operations playbooks
- **Physical security** — data center and infrastructure physical security
- **Security compliance certifications** — ISO 27001, SOC 2, etc.
- **Incident response procedures** — separate security incident response plan

These areas are important but outside the scope of this engineering standards document.

---

## 4. Required Context

Before implementing any security-affecting changes, engineers and AI systems **must** read and understand the following documents. These are the authoritative architectural sources that this security document builds upon:

| Document | Purpose |
|----------|---------|
| `docs/ARCHITECTURE.md` | High-level system design, technology stack, request lifecycle |
| `docs/AUTH.md` | Authentication flows, JWT strategy, refresh token lifecycle, CASL authorization |
| `docs/DATABASE.md` | Prisma schema design, soft delete, audit logging, indexing strategy |
| `docs/MULTITENANCY.md` | Tenant isolation strategy, institutionId enforcement, shared-database architecture |
| `docs/WORKERS.md` | BullMQ topology, queue security, worker tenant propagation, retry strategies |
| `docs/INFRASTRUCTURE.md` | Docker Compose, Redis, PostgreSQL, MinIO configuration |
| `AGENTS.md` | AI agent behavioral expectations, forbidden patterns, development workflow |

This security document does not duplicate content from these sources — it assumes familiarity with them and establishes security-specific standards on top.

---

## 5. Core Security Principles

EduSystem security is built on foundational principles that must never be compromised:

### 5.1 Zero Trust Architecture

**Principle:** Never trust, always verify. Every request, every user, every service must be authenticated and authorized regardless of origin.

**Implementation:**

- All API endpoints require authentication (global `JwtAuthGuard`)
- Authorization verified via CASL `@CheckAbility()` on every controller route
- Tenant context extracted from JWT, never from client-provided data
- Workers process jobs with tenant context from job payload, not from assumptions

### 5.2 Tenant Isolation Guarantees

**Principle:** Tenant data must never leak across institution boundaries. This is the most critical security property of EduSystem.

**Implementation:**

- Every tenant-scoped Prisma query includes `where: { institutionId }`
- `institutionId` extracted from JWT by `TenantMiddleware`, never from request parameters or body
- Service methods validate referenced entities belong to the same institution (JOIN validation)
- Queue job payloads contain explicit `institutionId` for worker processing

### 5.3 Validation-First Architecture

**Principle:** All input is untrusted until validated. Validation must happen at the boundary, not inside business logic.

**Implementation:**

- Every `@Body()` in controllers uses `ZodPipe` with Zod schemas
- Query parameters validated via Zod schemas with `z.coerce` for type conversion
- Service layer never re-validates data that passed through the pipe
- Frontend uses React Hook Form + Zod matching backend DTOs

### 5.4 Least Privilege Enforcement

**Principle:** Every component, user, and service should operate with the minimum permissions necessary.

**Implementation:**

- CASL rules scoped by `institutionId` for tenant users
- SUPER_ADMIN is the only role with cross-tenant access, and it is explicitly handled
- Prisma queries select only required fields, never `*`
- Workers are stateless and tenant-agnostic, processing one job at a time

### 5.5 Explicit Authorization Boundaries

**Principle:** Authorization must be declared explicitly on every endpoint. There are no implicit permissions.

**Implementation:**

- Every controller route has `@CheckAbility()` decorator
- Global `OnLeaveGuard` blocks mutations for ON_LEAVE users regardless of role
- `@Public()` decorator explicitly marks routes that skip authentication
- No fallback-to-allow authorization semantics

### 5.6 Secure Async Workflows

**Principle:** Async operations must be as secure as synchronous ones, with proper retry safety and idempotency.

**Implementation:**

- BullMQ jobs include `institutionId` in every payload
- Processors use idempotency checks before side effects
- Retry options configured per job criticality (DEFAULT, CRITICAL, LOW_PRIORITY)
- Audit logging is async but guaranteed via CRITICAL retry strategy

### 5.7 Defensive Programming

**Principle:** Assume code will be misused. Write code that fails safely.

**Implementation:**

- No `any` types — use `unknown` and narrow with type guards
- No non-null assertions (`!`) unless absolutely certain
- Services validate entity ownership before mutations
- GlobalExceptionFilter provides safe error responses in production

### 5.8 Predictable Security Behavior

**Principle:** Security behavior should be consistent and predictable across the codebase.

**Implementation:**

- All tenant-scoped queries follow the same pattern: `where: { institutionId }`
- All queue jobs follow the same pattern: payload includes `institutionId`
- All file paths follow the same pattern: `folder/{institutionId}/{uuid}.ext`
- Exception handling follows the same pattern: structured JSON with safe messages

---

## 6. Authentication Security Rules

### 6.1 JWT Security Expectations

EduSystem uses JWT for stateless authentication. The following rules must be followed:

| Rule | Implementation |
|------|----------------|
| **Short-lived access tokens** | 15 minute TTL (`JWT_EXPIRES_IN=15m`) |
| **Algorithm** | HS256 (symmetric, single secret) |
| **Secret minimum** | 32 characters (`JWT_SECRET` enforced by Zod) |
| **Payload contains** | `sub` (userId), `institutionId`, `role`, `email` |
| **Verification** | Passport JWT strategy with signature + expiry check |

**Forbidden:**

- Never store access tokens server-side
- Never expose tokens in logs
- Never trust token contents without verification (TenantMiddleware decodes, JwtAuthGuard verifies)
- Never extend token TTL beyond 15 minutes

### 6.2 Refresh Token Handling

Refresh tokens provide seamless re-authentication. Security rules:

| Rule | Implementation |
|------|----------------|
| **Storage** | bcrypt hash in `RefreshToken` table (NOT plaintext) |
| **TTL** | 7 days (`JWT_REFRESH_EXPIRES_IN=7d`) |
| **Rotation** | New refresh token issued on every refresh; old one revoked |
| **Multi-device** | Multiple refresh tokens per user (one per device) |

**Forbidden:**

- Never store refresh tokens in plaintext
- Never expose refresh tokens in logs
- Never send refresh tokens in URL parameters

### 6.3 Token Expiration Discipline

- Access tokens expire after 15 minutes — clients must use refresh token rotation
- Refresh tokens expire after 7 days — users must re-authenticate
- Expired tokens result in 401 — frontend NextAuth handles automatic refresh
- Logout revokes the specific refresh token (sets `revokedAt`)

### 6.4 Login Workflow Security

1. Credentials validated against bcrypt hash
2. User status checked (INACTIVE/SUSPENDED blocked, ON_LEAVE allowed with mutation restrictions)
3. New access token (15m) + refresh token (7d) generated
4. Refresh token stored as bcrypt hash with device metadata
5. Identical error messages for "user not found" and "wrong password" (prevents username enumeration)

### 6.5 Logout & Revocation

- `POST /auth/logout` revokes the specific refresh token
- Revocation is idempotent — calling on already-revoked token returns 204
- Access tokens remain valid until expiry (max 15 minutes after logout)

### 6.6 Forbidden Authentication Patterns

**NEVER do the following:**

```typescript
// NEVER: Store tokens in localStorage (XSS vulnerable)
// NEVER: Expose tokens in URL query parameters
// NEVER: Send tokens in response body to frontend (use headers)
// NEVER: Bypass JwtAuthGuard without @Public() justification
// NEVER: Trust frontend authentication state
// NEVER: Implement custom auth logic instead of using JwtStrategy
```

---

## 7. Authorization Security Rules

### 7.1 CASL Enforcement Expectations

Authorization is implemented via CASL (Condition-Based Access Control):

- **AbilityFactory** builds `AppAbility` from user role + level roles
- **Effective role** computed via `getHighestRole()` from User.role + UserLevelRole entries
- **@CheckAbility()** decorator on every controller route declares required permission
- **CaslGuard** enforces the declared ability at request time

### 7.2 Permission Matrix (Simplified)

| Role | Student | Grade | Attendance | User | Institution |
|------|---------|-------|------------|------|--------------|
| SUPER_ADMIN | Manage (all) | Manage (all) | Manage (all) | Manage (all) | Manage (all) |
| ADMIN/DIRECTOR | Manage (own) | Manage (own) | Manage (own) | Manage (own) | Read (own) |
| SECRETARY | Manage (own) | Read | Read | Create/Update TEACHER/PRECEPTOR | — |
| PRECEPTOR | Read | Read | Manage (own) | — | — |
| TEACHER | Read | CRUD (own) | Create/Update (own) | Update self | — |
| GUARDIAN | Read (own) | Read (own) | Read (own) | — | — |

### 7.3 Role Hierarchy

```
SUPER_ADMIN > ADMIN > DIRECTOR > SECRETARY > PRECEPTOR > TEACHER > GUARDIAN
```

- `getHighestRole()` computes effective role from User.role + all UserLevelRole entries
- GUARDIAN has the least privileges and is scoped to own children only

### 7.4 Authorization Patterns

```typescript
// CORRECT: Explicit authorization on every route
@Controller('grades')
@UseGuards(CaslGuard)
export class GradesController {
  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Grade' })
  create(@Body(new ZodPipe(CreateGradeSchema)) dto: CreateGradeDto) { }

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  findAll(@InstitutionId() institutionId: string) { }
}

// FORBIDDEN: Missing @CheckAbility() — route is accessible to anyone with valid JWT
// FORBIDDEN: Authorization logic in frontend (can be bypassed)
// FORBIDDEN: Trusting client-provided role or permissions
```

### 7.5 Forbidden Authorization Patterns

**NEVER do the following:**

```typescript
// NEVER: Trust frontend authorization state
// NEVER: Hide privilege escalation paths (e.g., user changing own role)
// NEVER: Make implicit permission assumptions (always use @CheckAbility())
// NEVER: Put authorization logic in frontend-only flows
// NEVER: Bypass @CheckAbility() without explicit @Public() + justification comment
// NEVER: Rely on UI hiding for security — backend must enforce
```

---

## 8. Multi-Tenancy Security Rules

### 8.1 institutionId Enforcement

`institutionId` is the most critical security field in EduSystem. It must be handled as follows:

| Source | Can Be Trusted? | Reason |
|--------|-----------------|--------|
| **JWT payload** | YES | Verified by JwtAuthGuard |
| **Request body** | NO | Client-controlled, can be manipulated |
| **Request params** | NO | Client-controlled, can be manipulated |
| **Request headers** | NO | Client-controlled (except Authorization) |
| **Job payload** | YES | Generated by trusted API code |

```typescript
// CORRECT: institutionId from JWT via @InstitutionId() decorator
@Post()
create(@Body(new ZodPipe(CreateStudentSchema)) dto: CreateStudentDto,
       @InstitutionId() institutionId: string) {
  return this.studentsService.create(dto, institutionId);
}

// FORBIDDEN: institutionId from request body — client can tamper
@Post()
create(@Body() dto: { name: string; institutionId: string })  // NEVER trust client
```

### 8.2 Tenant-Aware Service Patterns

Every service method handling tenant-scoped data must:

1. Accept `institutionId` as an explicit parameter
2. Include `institutionId` in every Prisma query WHERE clause
3. Validate that related entities belong to the same institution before mutations

```typescript
// CORRECT: Explicit institutionId parameter + tenant filter
async create(dto: CreateGradeDto, user: RequestUser, institutionId: string) {
  // Validate courseSubject belongs to this institution
  const courseSubject = await this.prisma.courseSubject.findFirst({
    where: { id: dto.courseSubjectId, course: { institutionId } },
  });
  if (!courseSubject) {
    throw new BadRequestException('La materia no pertenece a la institución');
  }

  // Create with institutionId in the record
  return this.prisma.grade.create({
    data: { ...dto, institutionId },
  });
}
```

### 8.3 Tenant-Safe Queries

```typescript
// CORRECT: Always filter by institutionId
const students = await this.prisma.student.findMany({
  where: { institutionId, deletedAt: null },
});

// FORBIDDEN: Missing institutionId filter — cross-tenant leak
const students = await this.prisma.student.findMany({  // SECURITY VIOLATION
  where: { deletedAt: null },  // Missing institutionId!
});
```

### 8.4 Tenant-Safe File Access

- Files stored in MinIO with path prefix: `{folder}/{institutionId}/{uuid}.ext`
- Presigned URLs generated server-side with short expiry (3600 seconds default)
- Frontend never gets direct MinIO access — all file access goes through presigned URLs

### 8.5 Tenant-Aware Workers

- Every BullMQ job payload includes `institutionId`
- Workers are stateless and tenant-agnostic — they process any tenant's jobs
- Processor queries scope to `institutionId` from job data

```typescript
// CORRECT: institutionId in job payload
await this.notificationQueue.add(JOBS.GRADE_CREATED, {
  gradeId: grade.id,
  studentId: dto.studentId,
  institutionId,  // REQUIRED
}, JOB_OPTIONS.DEFAULT);
```

### 8.6 Forbidden Multi-Tenancy Patterns

**NEVER do the following:**

```typescript
// NEVER: Cross-tenant data access via manipulated IDs
// NEVER: Trusting client-provided institutionId
// NEVER: Tenant-unaware queries (missing institutionId filter)
// NEVER: Tenant-unaware async jobs (missing institutionId in payload)
// NEVER: Tenant-unaware file access (missing institutionId in path)
// NEVER: SUPER_ADMIN bypass without explicit role check
```

---

## 9. API Security Rules

### 9.1 Validation-First APIs

All API input must be validated before reaching business logic:

```typescript
// CORRECT: Zod validation on every POST/PUT/PATCH body
@Post()
create(@Body(new ZodPipe(CreateStudentSchema)) dto: CreateStudentDto) { }

// CORRECT: Zod validation on query params
@Get()
findAll(@Query(new ZodPipe(StudentQuerySchema)) query: StudentQueryDto) { }
```

**Rules:**

- Every `@Body()` uses `ZodPipe` with a Zod schema
- Every `@Query()` uses Zod schema with `z.coerce` for type conversion
- Zod schemas defined in `dto/` folders alongside services
- Error messages in Spanish (user-facing) or structured (API consumers)

### 9.2 DTO-Based Request Boundaries

DTOs are the contract between client and server. They must be:

- **Strict:** Use `.strict()` to reject unknown fields
- **Typed:** Use `z.infer<>` to generate TypeScript types
- **Validated:** Every field has validation rules (min/max, format, enum)

```typescript
// CORRECT: Strict Zod schema with typed DTO
export const CreateStudentSchema = z.object({
  firstName: z.string().min(1, 'Requerido').max(100),
  lastName: z.string().min(1, 'Requerido').max(100),
  documentNumber: z.string().min(7).max(20),
  birthDate: z.string().date(),
  level: z.enum(['INICIAL', 'PRIMARIA', 'SECUNDARIA']),
}).strict();

export type CreateStudentDto = z.infer<typeof CreateStudentSchema>;
```

### 9.3 Typed API Contracts

- Return types must be explicit, not `any`
- Use TypeScript interfaces for response shapes
- Avoid returning raw database entities — use DTOs that exclude sensitive fields

### 9.4 Pagination-Aware APIs

- List endpoints use `page` and `limit` query parameters (default: 20, max: 100)
- Return arrays directly (not wrapped in `{ data: [...] }`)
- Include metadata for paginated results when needed

### 9.5 Forbidden API Patterns

**NEVER do the following:**

```typescript
// NEVER: Trusting raw payload without validation
@Post()
create(@Body() dto: any) { }  // NO Zod validation!

// NEVER: Leaking internal models in API responses
return this.prisma.user.findMany();  // Returns internal fields like passwordHash!

// NEVER: Oversized payload handling (no limit on array inputs)
@Post()
createMany(@Body() dto: { students: any[] })  // No limit = DoS vector

// NEVER: Inconsistent API contracts (different error formats)
```

---

## 10. Backend Security Rules

### 10.1 Secure NestJS Patterns

- **Thin controllers:** Controllers handle routing, guards, and DTO parsing only
- **Rich services:** All business logic lives in services
- **Global guards:** JwtAuthGuard and OnLeaveGuard applied globally via APP_GUARD
- **Explicit guards:** CaslGuard applied per-controller via `@UseGuards(CaslGuard)`

### 10.2 Service-Layer Authorization

Authorization enforcement must happen in services, not controllers:

```typescript
// CORRECT: Service handles authorization logic
@Injectable()
export class GradesService {
  async create(dto: CreateGradeDto, user: RequestUser, institutionId: string) {
    // Validate teacher owns the courseSubject
    const courseSubject = await this.prisma.courseSubject.findFirst({
      where: { id: dto.courseSubjectId, teacherId: user.id },
    });
    if (!courseSubject) {
      throw new ForbiddenException('No podés calificar esta materia');
    }
    // ... create grade
  }
}
```

### 10.3 Validation Boundaries

- Validation happens at the controller layer via ZodPipe
- Services assume DTOs are already validated
- Services do not re-validate data that passed through the pipe

### 10.4 Secure Queue Orchestration

- After successful DB writes, dispatch BullMQ jobs for async side effects
- Always include `institutionId` in job payloads
- Use appropriate JOB_OPTIONS (DEFAULT, CRITICAL, LOW_PRIORITY)

### 10.5 Defensive Async Handling

- Never block HTTP responses on async operations
- Use BullMQ for notifications, audit logging, PDF generation
- Handle async errors via retry logic, not try-catch in the request path

### 10.6 Forbidden Backend Patterns

**NEVER do the following:**

```typescript
// NEVER: Business logic inside controllers
@Controller('grades')
export class GradesController {
  @Post()
  async create(@Body() dto: any) {
    // Business logic in controller!
    const grade = await this.prisma.grade.create({ ... });
    await this.prisma.auditLog.create({ ... });  // Should be async via BullMQ
  }
}

// NEVER: Direct auth bypasses (creating bypass mechanisms)
// NEVER: Hidden side effects (operations not visible in code flow)
// NEVER: Insecure dynamic execution (eval, Function constructor)
// NEVER: Unsafe background processing (sync heavy operations in request)
```

---

## 11. Frontend Security Rules

### 11.1 Auth-Aware Rendering

- Frontend must check user status before rendering mutation UI
- Use `useIsOnLeave()` hook to disable mutation buttons for ON_LEAVE users
- Never rely solely on frontend checks — backend guards are authoritative

```typescript
// CORRECT: Client-side gating for UX, backend is authoritative
export function GradesPage() {
  const isOnLeave = useIsOnLeave();
  const { data: grades } = useGrades();

  return (
    <div>
      <h1>Notas</h1>
      {!isOnLeave && <CreateGradeDialog />}  // Disabled for ON_LEAVE
      <GradesTable grades={grades} />
    </div>
  );
}
```

### 11.2 Secure Session Handling

- NextAuth v5 manages session with JWT callback integration
- Tokens stored server-side via NextAuth, not in localStorage
- 5-minute session cache to avoid repeated `/api/auth/session` calls

### 11.3 Safe API Integration

- All API calls go through singleton `api` Axios instance (src/lib/api.ts)
- Interceptor adds Bearer token to every request
- Interceptor handles 401 (logout) and 403 (ON_LEAVE) responses
- Never create new Axios instances — always use `api` from `@/lib/api`

### 11.4 XSS-Aware Rendering

- React escapes by default — avoid `dangerouslySetInnerHTML`
- If HTML rendering is needed, use DOMPurify
- Never render user-provided content without sanitization

### 11.5 Safe File-Upload UX

- Upload to MinIO via presigned URL (not through API server)
- Validate file type and size before upload
- Show progress and error states clearly

### 11.6 Defensive Frontend Behavior

- React Query for server state (not local state for API data)
- Form validation matches backend Zod schemas
- Error messages shown via sonner toasts
- Loading states for all async operations

### 11.7 Forbidden Frontend Patterns

**NEVER do the following:**

```typescript
// NEVER: Trusting frontend authorization (can be bypassed)
const canEdit = user.role === 'ADMIN';  // Just checking, not real security

// NEVER: Unsafe dangerouslySetInnerHTML usage
<div dangerouslySetInnerHTML={{ __html: userInput }} />  // XSS vector!

// NEVER: Insecure token persistence (localStorage)
localStorage.setItem('token', token);  // XSS accessible!

// NEVER: Exposing sensitive data in console or UI
console.log('User password:', password);  // SECURITY VIOLATION

// NEVER: Insecure upload handling (no validation)
<input type="file" onChange={handleUpload} />  // No size/type check!
```

---

## 12. Database Security Rules

### 12.1 Tenant-Safe Persistence

- Every tenant-scoped model has `institutionId` as required foreign key
- All queries include `where: { institutionId }` filter
- Unique constraints scoped by institution (e.g., `@@unique([institutionId, documentNumber])`)

### 12.2 Transaction Safety

- Use `prisma.$transaction()` for atomic multi-step writes
- Avoid long-running transactions that hold connections
- Use batch operations (`createMany`) for bulk inserts

### 12.3 Least Privilege Query Design

- Use `select` to retrieve only required fields
- Never `select: { * }` or return raw entities in API responses
- Exclude sensitive fields (passwordHash, refresh tokens) from queries

```typescript
// CORRECT: Select only needed fields
const students = await this.prisma.student.findMany({
  where: { institutionId },
  select: { id: true, firstName: true, lastName: true, documentNumber: true },
});

// FORBIDDEN: Exposing sensitive fields
const students = await this.prisma.student.findMany({  // Returns all fields!
  where: { institutionId },
});
```

### 12.4 Audit-Aware Persistence

- All significant mutations dispatch audit log jobs
- Audit logs stored with `institutionId` for cross-tenant queries (SUPER_ADMIN)
- Before/after snapshots captured in JSON format

### 12.5 Soft-Delete Awareness

- Soft-delete models: Institution, User, Student, Announcement
- Prisma middleware automatically adds `deletedAt: null` to queries
- Never manually filter `deletedAt` in services — middleware handles it

### 12.6 Forbidden Database Patterns

**NEVER do the following:**

```typescript
// NEVER: Cross-tenant queries (missing institutionId)
const allStudents = await this.prisma.student.findMany();  // SECURITY VIOLATION!

// NEVER: Unsafe dynamic queries (SQL injection vectors)
// NEVER: Exposing sensitive fields in query results
// NEVER: Unbounded persistence operations (no pagination on large queries)
```

---

## 13. Prisma Security Rules

### 13.1 Safe Query Composition

- Always use Prisma's type-safe query builder
- Never concatenate user input into query strings
- Use parameterized values for all inputs

```typescript
// CORRECT: Type-safe Prisma query
const student = await this.prisma.student.findFirst({
  where: { id: studentId, institutionId },
});

// FORBIDDEN: Dynamic query building with string concatenation
const query = `SELECT * FROM students WHERE id = '${studentId}'`;  // SQL Injection!
```

### 13.2 Tenant-Aware Prisma Usage

- Every `findMany` or `findFirst` on tenant-scoped models includes `institutionId`
- Use `include` for relations, but be mindful of N+1 queries
- Use `select` instead of `include` when only specific fields are needed

### 13.3 Safe Relation Loading

- Validate related entities belong to the same institution before creating relations
- Use `findFirst` with JOIN conditions to validate cross-entity references

```typescript
// CORRECT: Validate courseSubject belongs to institution before creating grade
const courseSubject = await this.prisma.courseSubject.findFirst({
  where: { id: dto.courseSubjectId, course: { institutionId } },
});
if (!courseSubject) {
  throw new BadRequestException('CourseSubject no pertenece a la institución');
}
```

### 13.4 Raw SQL Restrictions

- **NEVER** use `prisma.$queryRaw` for business logic
- Raw SQL acceptable only for:
  - Complex analytical queries in dedicated reports
  - Batch operations where Prisma is too slow
- When raw SQL is needed, use parameterized queries with proper escaping

### 13.5 Transaction Isolation Expectations

- Prisma uses default PostgreSQL isolation level
- Use `$transaction` for atomic multi-step operations
- Avoid nested transactions

### 13.6 Forbidden Prisma Patterns

**NEVER do the following:**

```typescript
// NEVER: Unsafe raw SQL
const result = await this.prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;

// NEVER: Tenant-unaware querying
const students = await this.prisma.student.findMany();  // Missing institutionId!

// NEVER: Oversized relational payloads (include without select/where)
const students = await this.prisma.student.findMany({
  include: { grades: true, attendances: true, convivencias: true },  // Could be huge!
});

// NEVER: Unsafe transaction orchestration (missing error handling)
await this.prisma.$transaction([op1, op2]);  // No try-catch!
```

---

## 14. Queue & Worker Security Rules

### 14.1 Retry-Safe Workers

- BullMQ processors must be idempotent
- Use idempotency checks before side effects (e.g., check if notification already sent)
- Handle non-retriable errors (not found, invalid payload) by returning without throwing
- Handle retriable errors (timeouts, external service failures) by re-throwing

### 14.2 Tenant-Aware Async Jobs

- Every job payload includes `institutionId` as required field
- Workers process jobs from any tenant — they are stateless and tenant-agnostic
- Processor queries scope to `institutionId` from job data

```typescript
// CORRECT: institutionId in job payload
await this.auditQueue.add(JOBS.AUDIT_LOG, {
  institutionId,  // REQUIRED
  userId: user.id,
  action: 'CREATE',
  resource: 'Grade',
  resourceId: grade.id,
}, JOB_OPTIONS.CRITICAL);
```

### 14.3 Secure Queue Payloads

- Never include secrets (passwords, API keys) in job payloads
- Keep payloads lightweight — include IDs, not full objects
- Use typed interfaces for all job payloads

### 14.4 Job Options by Criticality

| Strategy | Attempts | Backoff | Use Case |
|----------|----------|---------|----------|
| DEFAULT | 3 | Exponential (2s) | Notifications, grade recalculation |
| CRITICAL | 5 | Exponential (1s) | Audit logs (must not lose) |
| LOW_PRIORITY | 2 | Fixed (5s) | PDF generation (best-effort) |

### 14.5 Secure Event-Driven Workflows

- Services dispatch jobs after successful DB writes
- Jobs are async and non-blocking
- Workers handle failures via retry logic

### 14.6 Forbidden Queue Patterns

**NEVER do the following:**

```typescript
// NEVER: Secrets inside queue payloads
await this.queue.add('job', { password: 'secret' });  // NEVER!

// NEVER: Giant payloads (send IDs, not full objects)
await this.queue.add('job', { student: entireStudentObject });  // Too large!

// NEVER: Tenant-unaware workers (missing institutionId filter)
// NEVER: Insecure retry behavior (unbounded retries)
// NEVER: Non-idempotent processors (duplicate side effects on retry)
```

---

## 15. Async Workflow Security Rules

### 15.1 Secure Event-Driven Architecture

- Domain events trigger BullMQ jobs (grades, attendance, announcements)
- Choreography pattern (services emit events) not orchestration
- Events are typed and include tenant context

### 15.2 Retry-Safe Workflows

- All async processors must be idempotent
- Use idempotency keys for critical operations
- Log failures with tenant context for debugging

### 15.3 Consistency Guarantees

- Strong consistency for core operations (grades, attendance)
- Eventual consistency for notifications and audit logs
- No partial consistency assumptions

### 15.4 Secure Async Orchestration

- Services wait for BullMQ acknowledgment only for critical operations
- Non-critical async operations fire-and-forget
- Background jobs do not block API responses

### 15.5 Operational Resilience

- Workers handle transient failures via retry
- Dead letter queue for permanently failed critical jobs
- Monitoring of queue depth and failed job rate

### 15.6 Forbidden Async Patterns

**NEVER do the following:**

```typescript
// NEVER: Hidden async side effects (not visible in code flow)
// NEVER: Insecure retries (no idempotency, unbounded attempts)
// NEVER: Partial consistency assumptions (data not ready when needed)
// NEVER: Blocking heavy operations in async context (sync PDF in request)
```

---

## 16. File Upload & Storage Security Rules

### 16.1 Upload Validation

- Validate file MIME type on server side (not just extension)
- Validate file size limits (max 10MB for avatars, 50MB for documents)
- Generate UUID-based filenames to prevent path traversal

```typescript
// CORRECT: Validate file before upload
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

async validateUpload(buffer: Buffer, mimetype: string): boolean {
  if (!ALLOWED_MIMETYPES.includes(mimetype)) return false;
  if (buffer.length > MAX_SIZE) return false;
  return true;
}
```

### 16.2 MIME-Type Validation

- Check MIME type using `file-type` library or similar
- Never trust `Content-Type` header alone — it can be spoofed
- Reject files with mismatched extension and MIME type

### 16.3 File-Size Restrictions

- Enforce maximum file size at upload time
- Reject oversized files before they reach storage
- Return clear error messages for size violations

### 16.4 Malware-Awareness

- Do not execute uploaded files
- Store files in isolated MinIO bucket
- Scan for malware if integration available (future enhancement)

### 16.5 Secure Object Access

- Never expose direct MinIO URLs
- Use presigned URLs with short expiry (3600 seconds default)
- Generate unique object keys (UUID) to prevent enumeration

### 16.6 Signed URL Expectations

- Presigned URLs generated server-side only
- Expiry never exceeds 3600 seconds (1 hour) for regular access
- URL includes specific object key, not wildcards

### 16.7 Forbidden Upload Patterns

**NEVER do the following:**

```typescript
// NEVER: Unrestricted uploads (no size/type validation)
await this.minio.putObject(bucket, filename, buffer);  // No validation!

// NEVER: Trusting file extensions
const ext = file.name.split('.').pop();  // Extension can be spoofed!

// NEVER: Public object exposure by default
await this.minio.setBucketPolicy('public-read');  // NEVER!

// NEVER: Tenant-unaware storage paths
const key = `avatars/${filename}`;  // Missing institutionId!
```

---

## 17. MinIO/Object Storage Security Rules

### 17.1 Tenant-Aware Object Paths

- All objects stored under institution prefix: `{bucket}/{institutionId}/...`
- This prevents accidental cross-tenant access even if application logic has bugs
- Path pattern: `avatars/{institutionId}/{uuid}.jpg`, `logos/{institutionId}/{uuid}.png`

```typescript
// CORRECT: Tenant-aware object path
const objectKey = `avatars/${institutionId}/${uuid}.${ext}`;
await this.minio.putObject(bucket, objectKey, buffer, size, { 'Content-Type': mimetype });
```

### 17.2 Private Bucket Expectations

- MinIO buckets should be private by default
- No public read access on any bucket
- All access through presigned URLs generated by backend

### 17.3 Signed URL Expiration

- Default expiry: 3600 seconds (1 hour)
- Longer expiry acceptable for reports (up to 24 hours) with additional controls
- Never generate indefinite access

### 17.4 Secure Object Lifecycle Management

- Delete objects when related entities are deleted
- Use lifecycle policies for automated cleanup of temporary files
- Archive logs, don't delete

### 17.5 Upload Isolation

- Frontend requests presigned upload URL from API
- Frontend uploads directly to MinIO (bypasses API server)
- API stores object key in database after upload confirmation
- This prevents API server from handling large file streams

### 17.6 Forbidden MinIO Patterns

**NEVER do the following:**

```typescript
// NEVER: Public buckets by default
await this.minio.setBucketPolicy('public-read');  // SECURITY VIOLATION!

// NEVER: Predictable object naming
const key = `avatars/user-${userId}-profile.jpg`;  // Enumerable!

// NEVER: Insecure object exposure
const url = await this.minio.getObjectUrl(bucket, key);  // Direct URL!

// NEVER: Shared tenant storage paths (missing institutionId)
const key = `shared/${filename}`;  // Cross-tenant contamination risk!
```

---

## 18. Validation & Sanitization Rules

### 18.1 Validation-First Design

All input validation happens at API boundaries:

- Controllers use `ZodPipe` for request body validation
- Query parameters use Zod schemas with `z.coerce` for type conversion
- Services assume all input is already validated

```typescript
// CORRECT: Validation at boundary
@Controller('students')
export class StudentsController {
  @Post()
  create(@Body(new ZodPipe(CreateStudentSchema)) dto: CreateStudentDto) {
    // dto is validated - service can trust it
    return this.studentsService.create(dto);
  }
}
```

### 18.2 Strict DTO Enforcement

- Use `.strict()` to reject unknown fields
- Define explicit types for all fields
- Use enum validation for discrete choices

```typescript
// CORRECT: Strict validation
export const CreateStudentSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  documentNumber: z.string().min(7).max(20),
}).strict();  // Rejects unknown fields!
```

### 18.3 Sanitization Expectations

- Zod handles most sanitization (trim, lowercase, etc.)
- For HTML content, use DOMPurify on frontend
- Backend stores raw data, sanitization happens at display layer

### 18.4 Safe Parsing

- Use `z.coerce` for query parameters that arrive as strings
- Handle parse errors gracefully with ZodPipe
- Never use `JSON.parse` on untrusted input without try-catch

### 18.5 Defensive Payload Handling

- Reject payloads over 1MB at API gateway
- Limit array inputs (e.g., max 1000 items in bulk operations)
- Log suspicious validation failures for security monitoring

### 18.6 Forbidden Validation Patterns

**NEVER do the following:**

```typescript
// NEVER: Trusting raw input
const name = req.body.name;  // Never trust client!

// NEVER: Bypassing validation
@Post()
create(@Body() dto: any) { }  // No Zod validation!

// NEVER: Unsafe parsing
const data = JSON.parse(untrustedInput);  // Can throw!

// NEVER: Weak DTO contracts
export const LooseSchema = z.object({ anything: z.any() });  // No validation!
```

---

## 19. Session & Token Security Rules

### 19.1 Short-Lived Access Tokens

- Access token TTL: 15 minutes
- This limits the window of opportunity for token theft
- Clients must use refresh token rotation for continued access

### 19.2 Refresh Token Rotation

- New access token + new refresh token issued on refresh
- Old refresh token marked as revoked (`revokedAt = now()`)
- Rotation prevents reuse of compromised tokens

### 19.3 Revocation Expectations

- Logout revokes specific refresh token
- Password change could revoke all user tokens (future enhancement)
- Account suspension revokes all tokens immediately

### 19.4 Secure Session Invalidation

- 401 response triggers session invalidation
- Frontend clears session and redirects to login
- NextAuth handles this via `signOut()` in axios interceptor

### 19.5 Cookie Handling

- Session cookie: HttpOnly, Secure (production), SameSite=Strict
- Tokens stored server-side by NextAuth, not in cookies accessible to JavaScript

### 19.6 Forbidden Session Patterns

**NEVER do the following:**

```typescript
// NEVER: Long-lived insecure sessions
const token = jwt.sign(payload, secret, { expiresIn: '30d' });  // NEVER!

// NEVER: Insecure token persistence
localStorage.setItem('refreshToken', token);  // XSS accessible!

// NEVER: Exposing session internals
return { accessToken, refreshToken, user };  // Exposing tokens in response body!

// NEVER: Unsafe client-side token handling
const token = cookies.get('token');  // Not HttpOnly!
```

---

## 20. Password & Credential Handling Rules

### 20.1 Bcrypt Usage

- Password hashing: bcrypt with cost factor 12
- Hash stored in `User.passwordHash` field
- Never store plaintext passwords

```typescript
// CORRECT: Password hashing
const hash = await bcrypt.hash(password, 12);
await this.prisma.user.create({ data: { ..., passwordHash: hash } });
```

### 20.2 Secret Management Discipline

- All secrets via environment variables (validated by Zod)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NEXTAUTH_SECRET` required
- `MINIO_SECRET_KEY`, `DATABASE_URL` required for operation
- Never commit secrets to repository

### 20.3 Environment Variable Handling

- Use `ConfigService<EnvConfig>` with typed Zod schema
- Validate at startup — fail fast if secrets missing
- Document all required secrets in `.env.example`

### 20.4 Secure Credential Storage

- PostgreSQL stores user data (passwords as bcrypt hashes)
- Redis stores BullMQ job data (no secrets)
- MinIO stores files only (no credentials in objects)

### 20.5 Credential Rotation Awareness

- Support for rotating JWT secrets (changes invalidate all tokens)
- MinIO credentials rotatable via environment variables
- Database credentials rotatable via connection string

### 20.6 Forbidden Credential Patterns

**NEVER do the following:**

```typescript
// NEVER: Plain-text passwords
await this.prisma.user.create({ data: { password: 'plain123' } });  // NEVER!

// NEVER: Hardcoded secrets
const secret = 'my-hardcoded-secret';  // NEVER!

// NEVER: Exposing credentials in logs
this.logger.log(`Password: ${password}`);  // SECURITY VIOLATION!

// NEVER: Insecure secret sharing
// POST /users password=secret in URL params
```

---

## 21. Logging & Observability Security Rules

### 21.1 Structured Security Logging

- All logs include tenant context (`institutionId`) when available
- Use structured JSON format for machine parsing
- Log levels: log (info), warn (recoverable), error (critical)

```typescript
// CORRECT: Structured logging with tenant context
this.logger.log(
  `Grade created: ${grade.id}`,
  institutionId,  // Second param for context
);
```

### 21.2 Audit Logging Expectations

- All significant mutations trigger audit log jobs
- Audit includes: institutionId, userId, action, resource, resourceId, before/after
- Critical jobs use CRITICAL retry strategy (5 attempts)

### 21.3 Incident Visibility

- Failed authentication attempts logged with IP
- Authorization failures logged with user context
- Unusual activity patterns flagged for investigation

### 21.4 Tenant-Aware Diagnostics

- Filter logs by `institutionId` for tenant-specific debugging
- Structured logging enables cross-tenant analysis for SUPER_ADMIN
- Log aggregation supports security monitoring

### 21.5 Safe Observability Practices

- Metrics: request counts, error rates, latency percentiles
- Traces: request IDs propagated through services
- Health checks: database, Redis, MinIO connectivity

### 21.6 Forbidden Logging Patterns

**NEVER do the following:**

```typescript
// NEVER: Logging secrets
this.logger.error(`JWT: ${token}`);  // SECURITY VIOLATION!

// NEVER: Logging passwords
this.logger.log(`Password reset: ${email} - ${password}`);  // NEVER!

// NEVER: Leaking sensitive PII
this.logger.log(`Student: ${student.documentNumber}`);  // DNI exposed!

// NEVER: Missing security visibility
// No logging of auth failures, authorization denials
```

---

## 22. Error Handling Security Rules

### 22.1 Safe Error Exposure

- Production: Generic error message ("Error interno del servidor")
- Development: Full error message + stack trace
- Controlled by `NODE_ENV` check

```typescript
// CORRECT: Safe error response
const isDev = process.env.NODE_ENV === 'development';
return {
  statusCode: 500,
  message: isDev ? error.message : 'Error interno del servidor',
};
```

### 22.2 Production-Safe Exceptions

- Never leak internal model names in error messages
- Never expose database table/column names
- Never expose file paths or system information

### 22.3 Operational Diagnostics

- Log full error details server-side (for debugging)
- Return safe error to client
- Include request ID for correlation

### 22.4 Predictable Error Responses

- Use NestJS built-in exceptions: BadRequestException, NotFoundException, ForbiddenException
- Consistent JSON structure: `{ statusCode, error, message, timestamp, path }`
- GlobalExceptionFilter enforces consistency

### 22.5 Security-Aware Exception Handling

- Handle validation errors (Zod) with 400
- Handle auth failures with 401
- Handle authorization failures with 403
- Handle not found with 404
- Handle conflicts (unique constraint) with 409

### 22.6 Forbidden Error Patterns

**NEVER do the following:**

```typescript
// NEVER: Leaking stack traces in production
throw new Error(`Database error: ${err.stack}`);  // Exposes internals!

// NEVER: Leaking internal DB details
throw new Error(`Prisma error: ${err.meta}`);  // NEVER!

// NEVER: Exposing sensitive internals
return { message: `Invalid password for user ${email}` };  // User enumeration!

// NEVER: Inconsistent security failures
// Some errors 400, some 500, some 403 - unpredictable!
```

---

## 23. Infrastructure Security Considerations

### 23.1 Environment Isolation

- Development, staging, production environments separated
- Different secrets per environment
- Environment variables validated at startup

### 23.2 Docker Security Awareness

- Containers run as non-root user (nestjs user)
- Read-only root filesystem where possible
- Network isolation: only required ports exposed
- No secrets in Dockerfile

### 23.3 Redis Security Expectations

- Password protection (`REDIS_PASSWORD` in production)
- AOF persistence enabled for job durability
- Maxmemory limited (256MB) to prevent unbounded growth
- No AUTH in development, password required in production

### 23.4 PostgreSQL Access Discipline

- TLS connection required (`sslmode=require`)
- Connection limited by role
- Password in connection string, not in code

### 23.5 MinIO Access Control

- Credentials via environment variables
- Private bucket access only
- Presigned URLs for all access
- MinIO console not exposed in production

### 23.6 Forbidden Infrastructure Patterns

**NEVER do the following:**

```typescript
// NEVER: Open infrastructure exposure
// Exposing ports 5432, 6379, 9000 directly to internet

// NEVER: Weak environment segregation
// dev and prod on same infrastructure without isolation

// NEVER: Insecure container defaults
// Running as root, no resource limits, no network policies

// NEVER: Exposed internal services
// MinIO console on production without auth
```

---

## 24. Secure TypeScript Practices

### 24.1 Strict Typing Expectations

- No `any` types — use `unknown` and narrow with type guards
- All function parameters and return types explicitly typed
- No implicit `any` in arrow functions

```typescript
// CORRECT: Explicit types
function findStudent(id: string, institutionId: string): Promise<Student | null> {
  return this.prisma.student.findFirst({ where: { id, institutionId } });
}

// FORBIDDEN: No implicit any
function findStudent(id, institutionId) {  // NO!
```

### 24.2 DTO-Safe Typing

- Use `z.infer<>` to generate TypeScript types from Zod schemas
- Match frontend types to backend DTOs
- Use interfaces for response shapes

### 24.3 Avoiding Unsafe `any`

- Use `unknown` when type is truly indeterminate
- Use type guards to narrow:
  ```typescript
  function isString(value: unknown): value is string {
    return typeof value === 'string';
  }
  ```

### 24.4 Defensive Interfaces

- Define interfaces for all API contracts
- Use `readonly` for immutable data structures
- Use `Partial<T>` for update DTOs (all fields optional)

### 24.5 Predictable Type Boundaries

- Services accept DTOs as input, return typed responses
- Controllers map request to DTO, service returns entity or DTO
- Clear type flow: Request → DTO → Service → Response

### 24.6 Forbidden TypeScript Patterns

**NEVER do the following:**

```typescript
// NEVER: Unsafe casting
const user = data as User;  // Never assume!

// NEVER: Weak typing
const payload: any = response.data;  // NEVER!

// NEVER: Untyped payload handling
function handle(data) { }  // No types!

// NEVER: Dynamic insecure execution
eval(userInput);  // SECURITY VIOLATION!
new Function(code);  // NEVER!
```

---

## 25. Scalability & Security Considerations

### 25.1 Secure Horizontal Scaling

- API instances are stateless (JWT auth, no local state)
- Worker instances are stateless (process jobs from queue)
- Scaling adds capacity without security degradation

### 25.2 Async Security Boundaries

- Background jobs process independently of API scale
- Queue depth monitoring triggers scaling decisions
- No security state stored in process memory

### 25.3 Scalable Auth Workflows

- JWT stateless — no session affinity needed
- Refresh token rotation works across API instances
- Token validation stateless (signature + expiry only)

### 25.4 Scalable Audit Logging

- Async audit via BullMQ — does not block API
- Workers scale independently
- Audit logs stored in PostgreSQL, queryable by institution

### 25.5 Scalable Tenant Isolation

- Tenant filter in every query — no cross-tenant joins
- Institution-level aggregations only (SUPER_ADMIN)
- Pagination prevents large result sets

### 25.6 Forbidden Scaling Patterns

**NEVER do the following:**

```typescript
// NEVER: Security bottlenecks
// Single point of auth verification that limits throughput

// NEVER: Insecure scaling shortcuts
// Disabling tenant filters to improve performance

// NEVER: Inconsistent distributed security behavior
// Auth working differently on different API instances
```

---

## 26. Maintainability & Security Considerations

### 26.1 Explicit Security Boundaries

- Security logic in dedicated services/guards, not scattered
- Consistent patterns: `@InstitutionId()`, `@CheckAbility()`, `ZodPipe`
- Clear separation: controllers (routing), services (logic), guards (security)

### 26.2 Predictable Secure Behavior

- Same patterns applied everywhere: tenant filters, auth decorators, validation
- Code reviews can verify pattern compliance
- New engineers learn security by learning patterns

### 26.3 Reusable Security Abstractions

- `@InstitutionId()` decorator extracts tenant context
- `ZodPipe` validates all input
- `@CheckAbility()` declares authorization
- These are reusable, not reinvented per endpoint

### 26.4 Maintainability-First Defensive Design

- Security code is testable (guards, services have clear interfaces)
- Security logic is auditable (patterns visible in code)
- Security bugs are traceable (structured logging)

### 26.5 Forbidden Maintainability Patterns

**NEVER do the following:**

```typescript
// NEVER: Hidden security logic
// Scattered auth checks across many files

// NEVER: Duplicated auth logic
// Copy-pasting guard logic instead of reusing

// NEVER: Scattered validation
// Validating in multiple places instead of at boundary

// NEVER: Insecure abstractions
// Generic middleware that doesn't apply tenant filters
```

---

## 27. Preferred Security Patterns

The following patterns are **recommended** for all security-affecting code:

| Pattern | Description |
|---------|-------------|
| **Validation-first APIs** | ZodPipe on every `@Body()`, Zod schema on every `@Query()` |
| **Explicit authorization** | `@CheckAbility()` on every controller route |
| **Tenant-safe queries** | `where: { institutionId }` on every tenant-scoped Prisma query |
| **Secure queue workflows** | `institutionId` in every BullMQ job payload |
| **Short-lived tokens** | 15-minute access token TTL |
| **Defensive programming** | No `any`, no `!`, explicit types everywhere |
| **Reusable secure abstractions** | Use decorators, guards, pipes from common module |
| **Audit-aware operations** | Dispatch audit job after every mutation |
| **Strongly typed boundaries** | DTOs for all input/output, interfaces for contracts |
| **Secure-by-default** | Error on the side of restriction |

---

## 28. Forbidden Security Patterns

The following patterns are **explicitly prohibited** and constitute security violations:

| Pattern | Reason | Consequence |
|---------|--------|-------------|
| **Trusting frontend authorization** | Frontend can be bypassed | Data leak, privilege escalation |
| **Cross-tenant access** | Missing institutionId filter | Tenant data leakage |
| **Unsafe raw SQL** | SQL injection risk | Database compromise |
| **Secrets in logs** | Log exposure | Credential theft |
| **Insecure uploads** | No validation | Malware upload, DoS |
| **Insecure token handling** | XSS/localStorage access | Token theft |
| **Hidden privilege escalation** | No explicit auth check | Unauthorized access |
| **Bypassing validation** | No ZodPipe | Injection attacks |
| **Weak typing** | `any` everywhere | Unpredictable behavior |
| **Insecure async workflows** | No idempotency | Duplicate operations |

---

## 29. Security Invariants

The following are **non-negotiable** security properties that must hold at all times:

### 29.1 Authentication Invariants

- All protected routes require authentication (`JwtAuthGuard` global)
- Public routes explicitly marked with `@Public()`
- Token verification includes signature + expiry + user status check

### 29.2 Authorization Invariants

- Every controller route has explicit `@CheckAbility()` (or justified `@Public()`)
- CASL conditions include `institutionId` for tenant users
- SUPER_ADMIN explicitly handled (bypass allowed but documented)

### 29.3 Tenant Isolation Invariants

- `institutionId` **never** comes from client payloads
- Every tenant-scoped Prisma query includes `institutionId` filter
- Every queue job payload includes `institutionId`
- File storage paths include `institutionId` prefix

### 29.4 Data Protection Invariants

- Passwords stored as bcrypt hashes (never plaintext)
- Refresh tokens stored as bcrypt hashes (never plaintext)
- API responses exclude sensitive fields (`passwordHash`, `refreshToken`)
- Logs never contain secrets, tokens, or passwords

### 29.5 Validation Invariants

- Every request body validated via ZodPipe + Zod schema
- Every query parameter validated via Zod schema
- Service layer trusts validated DTOs (no re-validation)

### 29.6 Error Handling Invariants

- Production errors never expose stack traces, internal paths, or DB details
- Consistent JSON error format from GlobalExceptionFilter
- Error messages are user-safe (no technical jargon exposed)

---

## 30. Good Examples

### 30.1 Tenant-Safe Queries

```typescript
// GOOD: Explicit institutionId filter on every query
async findAll(institutionId: string, query: FindStudentsDto) {
  return this.prisma.student.findMany({
    where: {
      institutionId,  // Always included!
      deletedAt: null,
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    },
    select: { id: true, firstName: true, lastName: true, documentNumber: true },
    orderBy: { lastName: 'asc' },
  });
}
```

### 30.2 Secure DTO Validation

```typescript
// GOOD: Strict Zod schema with typed DTO
export const CreateGradeSchema = z.object({
  studentId: z.string().uuid('ID de estudiante inválido'),
  courseSubjectId: z.string().uuid('ID de materia inválido'),
  periodId: z.string().uuid('ID de período inválido'),
  score: z.number().min(0).max(10).multipleOf(0.01, 'La nota debe tener hasta 2 decimales'),
  type: z.enum(['EXAM', 'ASSIGNMENT', 'ORAL', 'PROJECT', 'PARTICIPATION']),
  description: z.string().max(200).optional(),
  date: z.string().date('Fecha inválida'),
}).strict();

export type CreateGradeDto = z.infer<typeof CreateGradeSchema>;
```

### 30.3 Safe File Uploads

```typescript
// GOOD: Validate before upload
async uploadAvatar(userId: string, institutionId: string, buffer: Buffer, mimetype: string) {
  // Validate type
  if (!['image/jpeg', 'image/png'].includes(mimetype)) {
    throw new BadRequestException('Tipo de archivo no permitido');
  }

  // Validate size
  if (buffer.length > 10 * 1024 * 1024) {
    throw new BadRequestException('El archivo excede el tamaño máximo de 10MB');
  }

  // Generate safe filename
  const filename = `${crypto.randomUUID()}.${mimetype.split('/')[1]}`;
  const objectKey = `avatars/${institutionId}/${userId}/${filename}`;

  // Upload
  await this.minio.putObject(this.bucket, objectKey, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  return objectKey;
}
```

### 30.4 Secure Token Handling

```typescript
// GOOD: Generate tokens with proper configuration
async login(dto: LoginDto) {
  const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
  if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
    throw new UnauthorizedException('Credenciales inválidas');
  }

  const payload = { sub: user.id, institutionId: user.institutionId, role: user.role, email: user.email };
  const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
  const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

  // Store refresh token as hash
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  await this.prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt: addDays(new Date(), 7) },
  });

  return { accessToken, refreshToken };
}
```

### 30.5 Auth-Aware Service Orchestration

```typescript
// GOOD: Service validates entity ownership before mutation
async updateGrade(id: string, dto: UpdateGradeDto, user: RequestUser, institutionId: string) {
  // Find existing grade
  const existing = await this.prisma.grade.findUnique({ where: { id } });
  if (!existing) throw new NotFoundException('Nota no encontrada');

  // Verify teacher owns the courseSubject
  const courseSubject = await this.prisma.courseSubject.findFirst({
    where: { id: existing.courseSubjectId, teacherId: user.id },
  });
  if (!courseSubject) {
    throw new ForbiddenException('No tenés permiso para modificar esta nota');
  }

  // Update
  const updated = await this.prisma.grade.update({
    where: { id },
    data: dto,
  });

  // Dispatch async jobs
  await Promise.all([
    this.notificationQueue.add(JOBS.GRADE_UPDATED, { gradeId: id, institutionId }, JOB_OPTIONS.DEFAULT),
    this.auditQueue.add(JOBS.AUDIT_LOG, { institutionId, userId: user.id, action: 'UPDATE', resource: 'Grade', resourceId: id, before: existing, after: updated }, JOB_OPTIONS.CRITICAL),
  ]);

  return updated;
}
```

### 30.6 Secure Async Jobs

```typescript
// GOOD: Idempotent processor with institutionId
@Processor(QUEUES.NOTIFICATIONS)
export class NotificationProcessor {
  @Process(JOBS.GRADE_CREATED)
  async handleGradeCreated(job: Job<GradeCreatedPayload>) {
    const { gradeId, studentId, institutionId } = job.data;

    // Idempotency check
    const existing = await this.prisma.notification.findFirst({
      where: { type: 'GRADE', data: { path: ['gradeId'], equals: gradeId } },
    });
    if (existing) {
      this.logger.debug(`Notifications already sent for grade ${gradeId}`);
      return;
    }

    // Process notification
    const guardians = await this.prisma.user.findMany({
      where: { studentGuardians: { some: { studentId } }, status: 'ACTIVE' },
    });

    await this.notificationService.notify({
      userIds: guardians.map(g => g.id),
      type: 'GRADE',
      title: 'Nueva calificación registrada',
      data: { gradeId, institutionId },
    });
  }
}
```

### 30.7 Safe Prisma Usage

```typescript
// GOOD: Validate referenced entities belong to same institution
async createAttendance(dto: CreateAttendanceDto, institutionId: string) {
  // Validate course belongs to institution
  const course = await this.prisma.course.findFirst({
    where: { id: dto.courseId, institutionId },
  });
  if (!course) {
    throw new BadRequestException('El curso no pertenece a la institución');
  }

  // Validate student enrolled in course
  const enrollment = await this.prisma.courseStudent.findFirst({
    where: { courseId: dto.courseId, studentId: dto.studentId },
  });
  if (!enrollment) {
    throw new BadRequestException('El estudiante no está inscripto en este curso');
  }

  // Create attendance
  return this.prisma.attendance.create({ data: { ...dto, institutionId } });
}
```

---

## 31. Bad Examples

### 31.1 Trusting Frontend Authorization

```typescript
// BAD: Frontend role check is not security
const canEdit = user.role === 'ADMIN';  // Bypassable!
if (canEdit) await api.patch(`/grades/${id}`, { score: 10 });

// ATTACK: Attacker modifies request regardless of frontend check
await api.patch(`/grades/${id}`, { score: 10 });  // No role check in request!
```

### 31.2 Insecure Uploads

```typescript
// BAD: No validation before upload
async upload(file: Express.Multer.File) {
  await this.minio.putObject(bucket, file.originalname, file.buffer);
  return file.originalname;
}

// ATTACK: Upload malware.sh, executable with 1GB size
```

### 31.3 Unsafe Raw SQL

```typescript
// BAD: SQL injection vulnerability
const query = `SELECT * FROM students WHERE documentNumber = '${dto.documentNumber}'`;
const result = await this.prisma.$queryRawUnsafe(query);

// ATTACK: documentNumber = "'; DROP TABLE students; --"
```

### 31.4 Cross-Tenant Access

```typescript
// BAD: Missing institutionId filter
async findAllStudents() {
  return this.prisma.student.findMany({ where: { deletedAt: null } });
}

// ATTACK: Teacher from Institution A sees Institution B's students
```

### 31.5 Weak Validation

```typescript
// BAD: No Zod validation
@Post()
create(@Body() dto: any) {
  return this.studentsService.create(dto);
}

// ATTACK: Send malformed payload, expect undefined behavior
```

### 31.6 Insecure Queue Payloads

```typescript
// BAD: Secrets in job payload
await this.queue.add('process-payment', {
  studentId,
  password: userPassword,  // NEVER!
});

// ATTACK: Read password from queue metadata
```

### 31.7 Exposed Secrets

```typescript
// BAD: Logging sensitive data
this.logger.log(`User ${email} logged in with token ${token}`);
this.logger.error(`Password reset for ${email}: ${newPassword}`);

// ATTACK: Read logs, steal tokens/passwords
```

### 31.8 Insecure Token Handling

```typescript
// BAD: Storing tokens in localStorage (XSS accessible)
localStorage.setItem('accessToken', token);
localStorage.setItem('refreshToken', refreshToken);

// ATTACK: XSS script reads localStorage, steals tokens
```

---

## 32. Review Heuristics

Use these heuristics when reviewing code for security issues:

### 32.1 Privilege Escalation Detection

- Check: Are there endpoints that don't use `@CheckAbility()`?
- Check: Does SUPER_ADMIN bypass have explicit role verification?
- Check: Can users modify their own role or other sensitive fields?

### 32.2 Tenant Leak Detection

- Check: Every Prisma query on tenant-scoped model includes `institutionId`
- Check: Service validates referenced entities before mutations
- Check: Queue job payloads include `institutionId`

### 32.3 Unsafe Upload Detection

- Check: File type validated (not just extension)
- Check: File size limits enforced
- Check: Filenames are UUIDs, not user-provided

### 32.4 Insecure Token Handling Detection

- Check: Tokens not stored in localStorage or cookies (except HttpOnly)
- Check: JWT secret is environment variable, not hardcoded
- Check: Token TTL is short (15 minutes for access)

### 32.5 Weak Validation Detection

- Check: Every `@Body()` uses `ZodPipe`
- Check: Zod schemas use `.strict()`
- Check: No `any` types in DTOs

### 32.6 Auth Bypass Detection

- Check: No routes missing `@CheckAbility()` without `@Public()`
- Check: No custom auth logic bypassing Passport
- Check: `OnLeaveGuard` not bypassed inappropriately

### 32.7 Unsafe Async Workflow Detection

- Check: Processors idempotent
- Check: Job payloads don't contain secrets
- Check: Retry logic has limits (not infinite)

### 32.8 Insecure Logging Detection

- Check: No tokens, passwords, or secrets in logs
- Check: No PII (document numbers, personal info) in logs
- Check: Structured logging with tenant context

### 32.9 Security Drift Detection

- Check: New endpoints follow established patterns
- Check: No shortcuts introduced "for convenience"
- Check: Security invariants preserved in refactoring

---

## 33. Refactoring Guidelines

### 33.1 Preserving Security Invariants

- Never remove `institutionId` filters during refactoring
- Never remove `@CheckAbility()` decorators
- Never remove ZodPipe from controllers
- Maintain tenant isolation in new implementation

### 33.2 Safe Auth Refactoring

- Keep token TTL short (15 minutes)
- Keep refresh token rotation (new token, revoke old)
- Keep bcrypt hashing for passwords
- Never store tokens in plaintext

### 33.3 Preserving Tenant Isolation

- If extracting service, maintain `institutionId` parameter
- If creating new module, add `institutionId` to all queries
- If changing data model, maintain tenant FK constraints

### 33.4 Safe Async Workflow Evolution

- If adding new queue job, include `institutionId`
- If creating processor, make idempotent
- If changing retry logic, maintain limits

### 33.5 Avoiding Risky Rewrites

- Don't rewrite auth system "for simplicity"
- Don't remove CASL "to speed up development"
- Don't replace Zod with loose validation "for flexibility"
- Don't merge tenant-scoped queries "for performance"

---

## 34. Incident Prevention Guidelines

### 34.1 Defensive Development Expectations

- Validate all input at boundaries
- Log security-relevant events (auth failures, authorization denials)
- Use parameterized queries (Prisma does this by default)
- Follow established patterns (they have been security-reviewed)

### 34.2 Operational Monitoring Expectations

- Monitor failed login attempts (rate limiting)
- Monitor authorization denial rate
- Monitor queue failed job rate
- Monitor database query patterns (slow queries, full scans)

### 34.3 Secure Rollout Awareness

- Feature flags for risky changes
- Canary deployments for major features
- Rollback capability for security-affecting changes
- Staged rollout with monitoring

### 34.4 Audit Visibility Expectations

- All mutations logged (via BullMQ audit jobs)
- Login/logout events logged
- Export operations logged
- Audit logs queryable by institution

### 34.5 Security-First Review Culture

- Security review for all PRs (manual or automated)
- Security-focused checklist in PR template
- No bypassing of security checks for speed
- Document security decisions

---

## 35. Development Workflow Expectations

### 35.1 Analyze Security Impact Before Implementing

Before any code change, ask:

- Does this touch authentication or authorization?
- Does this affect tenant isolation?
- Does this add new API endpoints?
- Does this change data validation?
- Does this modify file uploads or storage?
- Does this add new queue jobs or workers?

If yes to any, security review is required.

### 35.2 Preserve Tenant Isolation

- New queries must include `institutionId`
- New services must accept `institutionId` parameter
- New queue jobs must include `institutionId` in payload

### 35.3 Preserve Auth Guarantees

- New endpoints must use `@CheckAbility()` or `@Public()`
- New DTOs must use Zod schemas
- New guards must not bypass existing checks

### 35.4 Preserve Validation Guarantees

- All input validated via ZodPipe + Zod schema
- No bypassing validation for "trusted" internal calls
- Validation happens once at boundary

### 35.5 Preserve Async Safety

- New async operations use BullMQ (not sync in request path)
- Queue jobs are idempotent
- Retry logic has appropriate limits

### 35.6 Avoid Speculative Security Abstractions

- Don't create new auth middleware without justification
- Don't create new authorization systems (use CASL)
- Don't create new validation approaches (use Zod)
- Don't create new tenant isolation mechanisms (use institutionId)

### 35.7 Explain Security-Impacting Changes Before Implementing

For any change that:

- Modifies authentication or authorization
- Changes tenant isolation logic
- Adds new security-sensitive features
- Modifies how secrets are handled

You must explain the reasoning and wait for confirmation before implementing.

---

## 36. Validation Checklist

Before any PR is merged, verify:

### Tenant Isolation

- [ ] All tenant-scoped Prisma queries include `institutionId` filter
- [ ] All queue job payloads include `institutionId`
- [ ] File storage paths include `institutionId` prefix
- [ ] Service methods accept `institutionId` as parameter

### Authentication

- [ ] All protected routes use `JwtAuthGuard` (global)
- [ ] Public routes explicitly marked with `@Public()`
- [ ] Token TTL is 15 minutes (access) and 7 days (refresh)
- [ ] Refresh tokens stored as bcrypt hashes

### Authorization

- [ ] All controller routes have `@CheckAbility()` decorator
- [ ] CASL rules include `institutionId` conditions for tenant roles
- [ ] `OnLeaveGuard` blocks mutations for ON_LEAVE users

### Uploads

- [ ] File type validated (MIME type checked)
- [ ] File size limits enforced
- [ ] Filenames are UUIDs, not user-provided
- [ ] Presigned URLs used for access, not direct URLs

### Validation

- [ ] All `@Body()` use `ZodPipe` with Zod schema
- [ ] All `@Query()` use Zod schema with `z.coerce`
- [ ] Zod schemas use `.strict()`
- [ ] No `any` types in DTOs

### Secrets

- [ ] No secrets in logs
- [ ] No passwords/tokens in response bodies
- [ ] Environment variables used for all secrets
- [ ] No hardcoded secrets in code

### Async

- [ ] Async operations use BullMQ (not sync in request)
- [ ] Processors are idempotent
- [ ] Retry logic has limits
- [ ] No secrets in job payloads

### Error Handling

- [ ] Production errors don't expose stack traces
- [ ] Production errors don't expose internal paths
- [ ] Consistent JSON error format
- [ ] GlobalExceptionFilter handles all errors

### Maintainability

- [ ] Security logic in dedicated components (guards, decorators)
- [ ] Consistent patterns across codebase
- [ ] No duplicate auth/validation logic
- [ ] Code is auditable (patterns visible, not hidden)

---

## 37. Expected Quality Standards

The final document should meet these quality standards:

- **Strict**: Clear security rules, no ambiguity, explicit prohibitions
- **Operational**: Practical guidance engineers can apply daily
- **Security-focused**: Every section addresses security concerns
- **Maintainability-focused**: Patterns that scale, not one-off solutions
- **Enterprise-grade**: Suitable for large SaaS platform with compliance needs
- **AI-agent accessible**: Clear enough for AI systems to follow consistently
- **Scalability-aware**: Patterns work at current and future scale
- **Defensive-by-default**: Error on the side of restriction

This document is the authoritative source for security expectations in EduSystem. All engineers and AI-assisted development systems must follow these standards.

---

*Document generated for EduSystem v1.0. For questions or corrections, contact the architecture team.*