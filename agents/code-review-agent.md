# Code Review Agent — Governance Document

> **Version:** 1.0  
> **Last Updated:** 2026-05-15  
> **Classification:** Internal — AI Coding Agents & Engineering Team  
> **Purpose:** Enforce architectural code review, maintainability, scalability, tenant isolation, security invariants, and long-term engineering quality for all AI-generated code in EduSystem.

---

## Table of Contents

1. [Agent Purpose & Scope](#1-agent-purpose--scope)
2. [Architectural Review Invariants](#2-architectural-review-invariants)
3. [Security Review Checklist](#3-security-review-checklist)
4. [Authentication & Authorization Review](#4-authentication--authorization-review)
5. [Multi-Tenancy Safety Verification](#5-multi-tenancy-safety-verification)
6. [Database & Prisma Review](#6-database--prisma-review)
7. [Async Workflow & Queue Review](#7-async-workflow--queue-review)
8. [Frontend Pattern Enforcement](#8-frontend-pattern-enforcement)
9. [API Design Review](#9-api-design-review)
10. [TypeScript Quality Gates](#10-typescript-quality-gates)
11. [Service Layer Patterns](#11-service-layer-patterns)
12. [DTO Validation Standards](#12-dto-validation-standards)
13. [Error Handling Review](#13-error-handling-review)
14. [File Storage Review](#14-file-storage-review)
15. [Logging & Observability](#15-logging--observability)
16. [Performance Review Checklist](#16-performance-review-checklist)
17. [Forbidden Patterns Detection](#17-forbidden-patterns-detection)
18. [Test Coverage Expectations](#18-test-coverage-expectations)
19. [Migration & Deployment Review](#19-migration--deployment-review)
20. [Environment & Configuration](#20-environment--configuration)
21. [Dependency Management](#21-dependency-management)
22. [Documentation Update Triggers](#22-documentation-update-triggers)
23. [Code Review Workflow](#23-code-review-workflow)
24. [Reviewer Calibration](#24-reviewer-calibration)
25. [Scalability Verification](#25-scalability-verification)
26. [Agent Collaboration](#26-agent-collaboration)

---

## 1. Agent Purpose & Scope

### 1.1 Primary Responsibility

The code review agent serves as the governing authority for all AI-generated code in the EduSystem repository. It enforces architectural invariants, security requirements, code quality standards, and long-term maintainability across both backend (NestJS) and frontend (Next.js) codebases.

### 1.2 Scope of Review

This agent reviews:

- **Backend code:** NestJS modules, controllers, services, DTOs, guards, middleware, pipes, queue processors
- **Frontend code:** Next.js pages, components, API hooks, forms, layouts
- **Infrastructure:** Docker Compose, environment configurations, Prisma migrations
- **Cross-cutting concerns:** Multi-tenancy enforcement, authentication, authorization, logging

### 1.3 Differentiating from Other Agents

| Agent | Primary Focus |
|-------|---------------|
| `security-agent.md` | Threat modeling, penetration testing, vulnerability scanning |
| `auth-agent.md` | Authentication flows, JWT token management, session handling |
| `multitenancy-agent.md` | Tenant isolation, institutionId scoping, cross-tenant prevention |
| `database-agent.md` | Prisma schema design, migrations, indexes, soft delete |
| `worker-agent.md` | BullMQ topology, job processors, retry strategies |
| `frontend-agent.md` | React patterns, component architecture, UI conventions |
| `backend-agent.md` | NestJS module structure, service patterns, API design |

The code review agent enforces the **intersection** of all these concerns, ensuring that code complies with the collective requirements documented across specialized agents.

### 1.4 Review Triggers

A code review is required when:

1. A pull request is created or updated
2. An AI agent proposes changes to any file under `backend/src/` or `frontend/src/`
3. A migration file is added to `backend/prisma/migrations/`
4. Environment variables are added or modified in `.env.example`
5. New dependencies are introduced in `package.json` or `package-lock.json`

---

## 2. Architectural Review Invariants

### 2.1 Multi-Tenancy Enforcement (Non-Negotiable)

**INVARIANT:** Every Prisma query on a tenant-scoped model MUST include an `institutionId` filter in the `where` clause. No exceptions.

```typescript
// CORRECT: Scoped query
const students = await this.prisma.student.findMany({
  where: { institutionId, deletedAt: null },
});

// FORBIDDEN: Unscoped query — CRITICAL SECURITY VIOLATION
const students = await this.prisma.student.findMany();
```

**Tenant-scoped models include:** Institution (soft-deleted), User, Student, Course, CourseSubject, Grade, Attendance, Announcement, Convivencia, Space, SpaceReservation, Sport, SportGroup, AcademicYear, Period, ScheduleEntry, Event, Notification.

### 2.2 TenantMiddleware Integrity

**INVARIANT:** TenantMiddleware must be present in the global middleware chain and must inject `req.institutionId`, `req.userId`, `req.userRole`, and `req.userEmail` for every authenticated request.

Detection patterns for bypass:
- Routes decorated with `@Public()` without documented justification
- Direct database access bypassing PrismaService
- Custom middleware that overwrites tenant context

### 2.3 Cross-Tenant Data Leak Prevention

**INVARIANT:** The response from any API endpoint scoped to a tenant MUST NOT contain entities or identifiers from another institution.

Detection:
- Compare returned `institutionId` values against `req.institutionId`
- Verify that SUPER_ADMIN endpoints with `institutionId: null` correctly filter or aggregate across tenants without leaking cross-tenant data in lists

### 2.4 Dual-Mode Runtime Integrity

**INVARIANT:** The backend supports two mutually exclusive runtime modes via `APP_MODE`: `api` (HTTP REST API) and `worker` (BullMQ job processor). Code must not introduce coupling between these modes.

Detection:
- Verify that `app.module.ts` and `worker-app.module.ts` have distinct import sets
- Ensure no HTTP-specific code (controllers, guards, middleware) leaks into worker module imports
- Confirm that BullMQ processors do not import HTTP dependencies

---

## 3. Security Review Checklist

### 3.1 JWT Validation

| Requirement | Verification |
|-------------|--------------|
| JWT_SECRET >= 32 characters | Check `env.schema.ts` and runtime configuration |
| HS256 algorithm | Verify `jwtStrategy` configuration |
| Token expiration enforced | Check `exp` claim validation in `JwtStrategy` |
| Access token TTL = 15 minutes | Verify in `AuthService.tokenGeneration` |
| Refresh token TTL = 7 days | Verify in `AuthService.createRefreshToken` |

### 3.2 Refresh Token Security

| Requirement | Verification |
|-------------|--------------|
| Tokens stored as bcrypt hash | Verify `RefreshToken` table stores hashed tokens |
| Rotation on use | Confirm refresh flow invalidates old token |
| Expiration tracking | Verify `expiresAt` and `revokedAt` fields |

### 3.3 Password Security

| Requirement | Verification |
|-------------|--------------|
| Bcrypt hashing | Verify `bcrypt.hash` in `AuthService` |
| No plaintext storage | Confirm password field never exposed in responses |
| Minimum complexity | Check validation in `CreateUserSchema` or similar |

### 3.4 Input Sanitization

| Requirement | Verification |
|-------------|--------------|
| Zod validation on all inputs | Confirm `ZodPipe` on `@Body()` for POST/PUT/PATCH |
| No raw SQL execution | Confirm Prisma parameterization throughout |
| File upload validation | Verify MIME type and size checks in StorageService |
| XSS prevention | Confirm HTML sanitization for announcement content |

### 3.5 Authorization Enforcement

| Requirement | Verification |
|-------------|--------------|
| `@CheckAbility()` on all routes | Verify every controller route has decorator |
| CASL subjects registered | Confirm subjects in `CaslAbilityFactory`: Institution, User, Student, Course, Grade, Attendance, Announcement, Convivencia, Space, SpaceReservation, Sport, SportGroup, all |
| Role hierarchy enforcement | Verify `getHighestRole()` computation in authorization logic |

---

## 4. Authentication & Authorization Review

### 4.1 AuthService Patterns

The code review agent must verify that `AuthService` implements the following patterns:

```typescript
// Required: Token generation with correct payload
async generateTokens(user: User) {
  const payload = {
    sub: user.id,
    institutionId: user.institutionId,
    role: user.role,
    email: user.email,
  };
  return {
    accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
    refreshToken: await this.createRefreshToken(user),
  };
}

// Required: Credential verification
async validateCredentials(email: string, password: string) {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user || user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
    return null;
  }
  return bcrypt.compare(password, user.password) ? user : null;
}
```

### 4.2 Guard Execution Order

The code review agent must verify that the following guard order is enforced in `app.module.ts`:

1. **TenantMiddleware** — injects tenant context before guards
2. **APP_GUARD (JwtAuthGuard)** — verifies JWT signature, loads user from DB
3. **OnLeaveGuard** — blocks mutations for users with `status === 'ON_LEAVE'`
4. **Route-level (CaslGuard)** — enforces `@CheckAbility()` rules

Deviation from this order is a critical architectural violation.

### 4.3 OnLeaveGuard Exemptions

The following paths are exempted from ON_LEAVE mutation blocking:

- `/auth/login`
- `/auth/logout`
- `/auth/refresh`
- `/users/:id/password`
- `/users/:id/leave`
- `/users/:id/restore`

Detection: Verify these paths are listed in the `exemptPaths` array in `OnLeaveGuard`.

### 4.4 CASL Rule Verification

Verify that CASL rules in `CaslAbilityFactory` match the access matrix:

| Action | SUPER_ADMIN | ADMIN | DIRECTOR | SECRETARY | PRECEPTOR | TEACHER | GUARDIAN |
|--------|-------------|-------|----------|-----------|-----------|---------|----------|
| Manage institution | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage users | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage students | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage grades | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Manage attendance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Read all (own institution) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (own children) |

---

## 5. Multi-Tenancy Safety Verification

### 5.1 Tenant-Scoped Model Coverage

The code review agent must verify that all 14 tenant-scoped models include `institutionId` in every Prisma query:

| Model | Scoped | Soft Deleted |
|-------|--------|--------------|
| Institution | — | Yes |
| User | Yes | Yes |
| Student | Yes | Yes |
| Course | Yes | No |
| CourseSubject | Yes | No |
| Grade | Yes | No |
| Attendance | Yes | No |
| Announcement | Yes | Yes |
| Convivencia | Yes | No |
| Space | Yes | No |
| SpaceReservation | Yes | No |
| Sport | Yes | No |
| SportGroup | Yes | No |
| AcademicYear | Yes | No |
| Period | Yes | No |
| ScheduleEntry | Yes | No |
| Event | Yes | No |
| Notification | Yes | No |

### 5.2 SUPER_ADMIN Handling

Verify that services handle `institutionId: null` for SUPER_ADMIN users:

```typescript
async findAll(institutionId: string | null, user: RequestUser) {
  if (user.role === 'SUPER_ADMIN') {
    // SUPER_ADMIN sees all institutions — no institutionId filter
    return this.prisma.student.findMany({ where: { deletedAt: null } });
  }
  return this.prisma.student.findMany({ where: { institutionId, deletedAt: null } });
}
```

### 5.3 Queue Tenant Isolation

Verify that every BullMQ job payload includes `institutionId`:

```typescript
// CORRECT: institutionId in job payload
await this.notificationQueue.add(JOBS.GRADE_CREATED, {
  gradeId: grade.id,
  studentId: dto.studentId,
  institutionId, // REQUIRED
}, JOB_OPTIONS.DEFAULT);

// FORBIDDEN: Missing institutionId
await this.notificationQueue.add(JOBS.GRADE_CREATED, {
  gradeId: grade.id,
  studentId: dto.studentId,
  // institutionId missing — violates tenant isolation
}, JOB_OPTIONS.DEFAULT);
```

### 5.4 File Storage Tenant Isolation

Verify that MinIO paths include `institutionId`:

```
avatars/{institutionId}/{userId}/{filename}
logos/{institutionId}/{filename}
```

---

## 6. Database & Prisma Review

### 6.1 Schema Change Protocol

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Modify `schema.prisma` | Check file under `backend/prisma/schema.prisma` |
| 2 | Run `npx prisma migrate dev` | Confirm migration file created in `backend/prisma/migrations/` |
| 3 | Run `npx prisma generate` | Confirm client regenerated |
| 4 | Test against local DB | Verify migration applies without errors |

**FORBIDDEN:** Modifying existing migration files. Always create a new migration.

### 6.2 Soft Delete Enforcement

Verify that the PrismaService middleware automatically filters `deletedAt: null` on all soft-deleted models:

```typescript
// In PrismaService middleware
if (modelNames.includes(model)) {
  args.where = { ...args.where, deletedAt: null };
}
```

Models with soft delete: Institution, User, Student, Announcement.

### 6.3 Index Strategy

Verify that indexes exist for:

- All foreign keys used in `where` clauses (`institutionId`, `studentId`, `courseId`, `userId`)
- Composite `where` combinations (`institutionId + documentNumber`, `studentId + courseId + date`)
- Fields used in `orderBy` clauses

Detection: Review `@@index` declarations in `schema.prisma`.

### 6.4 Transaction Boundaries

Verify that multi-model writes use `prisma.$transaction()`:

```typescript
await this.prisma.$transaction(async (tx) => {
  await tx.attendance.create({ data });
  await tx.justification.create({ data: { attendanceId: attendance.id } });
});
```

---

## 7. Async Workflow & Queue Review

### 7.1 Queue Dispatch Pattern

Verify that every successful mutation that requires async side effects dispatches a BullMQ job:

| Mutation | Required Job |
|----------|--------------|
| Grade created/updated | `JOBS.GRADE_CREATED` |
| Attendance recorded | `JOBS.ATTENDANCE_RECORDED` |
| Announcement published | `JOBS.ANNOUNCEMENT_PUBLISHED` |
| Any CREATE/UPDATE/DELETE | `JOBS.AUDIT_LOG` |

Detection: Search for `queue.add` calls in service methods after Prisma writes.

### 7.2 Idempotency Requirements

Verify that all BullMQ processors implement idempotency checks:

```typescript
@Process(JOBS.GRADE_CREATED)
async handleGradeCreated(job: Job<GradeCreatedPayload>) {
  const { gradeId } = job.data;
  const existing = await this.prisma.notification.findFirst({
    where: {
      userId: { in: guardians },
      type: 'GRADE',
      data: { gradeId } as any,
    },
  });
  if (existing) return; // Already processed — idempotent guard
  // ... send notifications
}
```

### 7.3 Retry Options Verification

Verify that job retry options match the criticality:

| Job Type | Options | Attempts | Backoff |
|----------|---------|----------|---------|
| Notifications | DEFAULT | 3 | exponential, 2s |
| Audit logs | CRITICAL | 5 | exponential, 1s |
| PDF generation | LOW_PRIORITY | 2 | fixed, 5s |

Detection: Verify `JOB_OPTIONS.DEFAULT`, `JOB_OPTIONS.CRITICAL`, or `JOB_OPTIONS.LOW_PRIORITY` usage.

### 7.4 FCM Direct Call Prevention

**FORBIDDEN:** Calling `FcmService` directly. All notification flows must use `NotificationQueueService`:

```typescript
// CORRECT: Use queue service
await this.notificationQueueService.notify({
  type: 'GRADE_CREATED',
  institutionId,
  userIds: guardians,
  data: { gradeId, studentId },
});

// FORBIDDEN: Direct FCM call
await this.fcmService.sendPush(tokens, payload);
```

---

## 8. Frontend Pattern Enforcement

### 8.1 Server State Management

| Requirement | Verification |
|-------------|--------------|
| React Query for all server state | Confirm `useQuery` hooks in `src/lib/api/*.ts` |
| No Zustand for server state | Search for Zustand store usage — should only be for UI state if any |
| Query key with filters | Confirm `queryKey: ['grades', filters]` pattern |

### 8.2 Local UI State

| Requirement | Verification |
|-------------|--------------|
| useState for local UI | Confirm no external state management for UI-only concerns |
| No prop drilling of complex state | Verify context or lifting for shared state |

### 8.3 Form Handling

| Requirement | Verification |
|-------------|--------------|
| React Hook Form + Zod | Confirm `useForm` with `zodResolver` |
| Matching backend DTO | Verify frontend Zod schema matches backend CreateXxxSchema |
| Form reset after submit | Confirm `form.reset()` called in onSuccess |

### 8.4 Page Component Structure

| Requirement | Verification |
|-------------|--------------|
| Thin page.tsx orchestrator | Confirm page is 50-90 lines, delegates to components |
| Isolated _components/ | Confirm complex UI extracted to child components |
| useIsOnLeave() for mutation gating | Confirm mutation buttons disabled when user is ON_LEAVE |

### 8.5 API Client Singleton

**FORBIDDEN:** Creating a new Axios instance. All HTTP calls must use the singleton from `src/lib/api.ts`:

```typescript
// CORRECT: Use singleton
import { api } from '@/lib/api';
const res = await api.get('/grades');

// FORBIDDEN: New instance
import axios from 'axios';
const api = axios.create({ baseURL: '...' });
```

### 8.6 Date Display Convention

Verify that dates are displayed without timezone conversion:

```typescript
// CORRECT: Display without timezone shift
const displayDate = date.split('T')[0].split('-').reverse().join('/'); // "14/05/2026"

// FORBIDDEN: UTC shift via toISOString
const displayDate = new Date(date).toISOString().split('T')[0]; // WRONG: may shift by UTC offset
```

### 8.7 CSV Export Convention

Verify that CSV exports include BOM for Excel Spanish locale compatibility:

```typescript
// CORRECT: BOM + semicolon separator
const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
const csv = new TextEncoder().encode(BOM.concat(new TextEncoder().encode('sep=;\n' + rows)));
```

---

## 9. API Design Review

### 9.1 RESTful Conventions

| Requirement | Verification |
|-------------|--------------|
| GET /resource — list (paginated) | Confirm list endpoints return array directly |
| GET /resource/:id — single | Confirm single resource endpoints |
| POST /resource — create | Confirm 201 status on success |
| PUT /resource/:id — full replace | Verify complete replacement semantics |
| PATCH /resource/:id — partial update | Verify partial update semantics |
| DELETE /resource/:id — soft delete | Verify `deletedAt` set, not hard delete |

### 9.2 Route Ordering

**CRITICAL:** More specific routes must be defined before generic routes. Detection:

```typescript
// CORRECT: Specific route before parameterized route
@Get('my-subjects')
findMySubjects(...) { ... }

@Get(':id')
findOne(...) { ... }

// FORBIDDEN: Generic route blocks specific route
@Get(':id')
findOne(...) { ... }

@Get('my-subjects') // NEVER REACHED — :id matches first
findMySubjects(...) { ... }
```

### 9.3 Pagination

Verify that list endpoints support:

- `page` query param (default: 1)
- `limit` query param (default: 20, max: 100)
- Response returns array directly (not wrapped in `{ data: [...] }`)

### 9.4 HTTP Status Code Usage

| Status | Usage |
|--------|-------|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE (no body) |
| 400 | Validation error (Zod failures) |
| 401 | Unauthorized (invalid/expired JWT) |
| 403 | Forbidden (CASL denial or ON_LEAVE) |
| 404 | Resource not found |
| 409 | Conflict (unique constraint violation) |
| 500 | Internal server error |

### 9.5 ZodPipe Usage

Verify that all `@Body()` inputs on POST/PUT/PATCH routes use `ZodPipe`:

```typescript
@Post()
create(@Body(new ZodPipe(CreateStudentSchema)) dto: CreateStudentDto) {
  // dto is validated and typed
}
```

---

## 10. TypeScript Quality Gates

### 10.1 Forbidden Type Patterns

| Pattern | Severity | Detection |
|---------|----------|-----------|
| `any` | CRITICAL | Reject immediately |
| Non-null assertion (`!`) | HIGH | Require type guard or null check |
| `as` casts | HIGH | Require type guard or Zod parse verification |
| Implicit `any` on function params | CRITICAL | Require explicit type annotation |

### 10.2 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `create-grade.dto.ts` |
| Classes | PascalCase | `StudentsController` |
| Methods | camelCase | `findAll`, `createMany` |
| Constants | SCREAMING_SNAKE_CASE | `QUEUES.NOTIFICATIONS` |
| Interfaces | PascalCase | `GradeCreatedPayload` |
| Variables | camelCase | `institutionId`, `studentIds` |
| DTOs | PascalCase with Dto/Type suffix | `CreateStudentDto` |
| Enums | SCREAMING_SNAKE_CASE | `UserRole.ADMIN` |

### 10.3 Import Organization

Verify imports are grouped:

1. Node built-ins (path, crypto, etc.)
2. Third-party (nestjs, prisma, bullmq, etc.)
3. Internal modules (@/, relative imports)

No barrel exports (`index.ts`) for services — import directly.

---

## 11. Service Layer Patterns

### 11.1 Thin Controller Requirement

Controllers must contain only:

- Route definitions
- DTO parsing with `ZodPipe`
- Delegation to services
- Guard/decorator application

**FORBIDDEN:** Business logic in controllers.

Detection: Review controller methods for Prisma calls, business rules, or data transformation.

### 11.2 Rich Service Requirement

Services must contain:

- All business logic
- Prisma queries with institutionId filtering
- Queue dispatch after successful mutations
- Error handling and transformation

### 11.3 Service Dependency Pattern

Verify service dependencies:

```typescript
@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService, // First: always
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly notificationQueue: Queue,
    @InjectQueue(QUEUES.AUDIT) private readonly auditQueue: Queue,
  ) {}
}
```

### 11.4 Guard/Pipe Isolation

Services must NOT import or call guards, interceptors, or pipes directly. Detection: Search for guard/pipe imports in service files.

---

## 12. DTO Validation Standards

### 12.1 Zod-Only Validation

**FORBIDDEN:** Using class-validator, joi, yup, or manual validation. Only Zod is permitted.

Detection: Search imports for `class-validator`, `joi`, `yup` — should not exist.

### 12.2 Common Zod Patterns

```typescript
// UUID
z.string().uuid()

// Email
z.string().email('Formato de email inválido')

// Numeric range
z.number().min(0).max(10).multipleOf(0.01)

// Enum
z.enum(['EXAM', 'ASSIGNMENT', 'ORAL', 'PROJECT', 'PARTICIPATION'])

// HTML input coercion (string to number)
z.coerce.number().min(1)

// Strict object (reject unknown fields)
z.object({ ... }).strict()

// Required field with message
z.string().min(1, 'Requerido')
```

### 12.3 DTO File Structure

Per AGENTS.md conventions:

```
modules/[name]/dto/
├── create.[name].dto.ts
├── update.[name].dto.ts
└── query.[name].dto.ts
```

---

## 13. Error Handling Review

### 13.1 NestJS Exception Usage

| Exception | Usage |
|-----------|-------|
| BadRequestException | Zod validation failures, invalid input |
| NotFoundException | Resource not found (by ID) |
| ForbiddenException | CASL denial, ON_LEAVE mutation attempt |
| ConflictException | Unique constraint violation (P2002) |
| UnauthorizedException | Invalid/expired JWT |

### 13.2 Service-Level Error Handling

Verify that services wrap Prisma calls in try-catch:

```typescript
try {
  await this.prisma.student.create({ data });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new ConflictException('El estudiante con este documento ya existe');
  }
  this.logger.error('Error creating student', err);
  throw err;
}
```

### 13.3 Async Job Error Handling

Verify that queue processors catch errors and log without re-throwing (for non-critical jobs):

```typescript
try {
  await this.sendPush(tokens, payload);
} catch (err) {
  this.logger.error('FCM send failed', err);
  // Don't re-throw — notification already persisted in DB
}
```

### 13.4 Frontend Error Handling

Verify that all `useMutation` hooks define `onError`:

```typescript
const createGrade = useMutation({
  mutationFn: async (data: CreateGradeDto) => api.post('/grades', data),
  onError: () => toast.error('Error al cargar la nota'),
});
```

---

## 14. File Storage Review

### 14.1 MinIO Only

**FORBIDDEN:** Storing files on the local filesystem. All uploads must use MinIO via StorageService.

Detection: Search for `fs.writeFile`, `fs.readFile`, or similar — should not exist.

### 14.2 StorageService Usage

Verify that all file operations go through StorageService:

```typescript
constructor(private readonly storageService: StorageService) {}

async uploadAvatar(userId: string, file: Buffer, filename: string) {
  const key = `avatars/${institutionId}/${userId}/${filename}`;
  return this.storageService.upload(key, file, contentType);
}
```

### 14.3 Presigned URLs

Verify that downloads use presigned URLs, not direct MinIO access:

```typescript
const url = await this.storageService.getPresignedUrl(key);
return { url };
```

### 14.4 Bucket Structure

Verify buckets created on first upload if they don't exist. Standard buckets:

- `avatars` — user profile pictures
- `logos` — institution logos
- `documents` — generic document storage
- `pdf-reports` — generated PDF reports

---

## 15. Logging & Observability

### 15.1 NestJS Logger Usage

**FORBIDDEN:** Using `console.log`, `console.error`, or `console.warn`. All logging must use NestJS Logger.

```typescript
constructor(private readonly logger: Logger = new Logger(GradesService.name)) {}

this.logger.log(`Student ${student.id} enrolled in course ${courseId}`);
this.logger.error('Failed to send FCM notification', err);
this.logger.debug('Token malformed in TenantMiddleware — ignored');
```

### 15.2 Logged Information

| Include | Exclude |
|---------|---------|
| Operation start/end with entity IDs | Passwords |
| Non-recoverable errors with stack traces | JWT tokens |
| Security-relevant events (login failures, auth denials) | Refresh tokens |
| Performance metrics for slow operations (>500ms) | Personal data (PII) |

### 15.3 Health Check Endpoint

Verify `/health` endpoint monitors:

- Database connectivity (`prisma.$connect()`)
- Redis connectivity (`redis.ping()`)
- MinIO connectivity (head bucket)

---

## 16. Performance Review Checklist

### 16.1 Database Performance

| Requirement | Verification |
|-------------|--------------|
| Indexes on institutionId + foreign keys | Review `@@index` in schema.prisma |
| select limiting | Verify `select: { id: true, name: true }` for non-full-entity queries |
| include for relations | Verify `include: { course: true }` for related data |
| Avoid N+1 | Verify `Promise.all()` for parallel independent queries |
| Pagination defaults | Verify `take: 100` max on list endpoints |

### 16.2 BullMQ Performance

| Requirement | Verification |
|-------------|--------------|
| Sequential PDF processing | Verify `for...of` loop, not `Promise.all()` |
| Browser reuse | Verify `generatePdfWithBrowser()` using shared instance |
| Concurrency settings | Verify `concurrency: 1` for PDF, higher for notifications |

### 16.3 Frontend Performance

| Requirement | Verification |
|-------------|--------------|
| React Query staleTime | Verify appropriate caching per query |
| Session cache (5 min TTL) | Verify Axios interceptor caches session |
| React.memo on expensive children | Verify `React.memo(PeriodSection)` for complex components |

---

## 17. Forbidden Patterns Detection

### 17.1 Backend Forbidden Patterns

| Pattern | Severity | Rationale |
|---------|----------|------------|
| Business logic in controllers | CRITICAL | Violates service-layer architecture |
| Prisma queries without institutionId | CRITICAL | Cross-tenant data leak |
| Calling FcmService directly | HIGH | Circumvents NotificationQueueService |
| Using `any` | CRITICAL | Type safety violation |
| Promise.all() for BullMQ bulk PDFs | CRITICAL | Browser exhaustion |
| Circular module dependencies | CRITICAL | NestJS DI failure |
| Hardcoded secrets | CRITICAL | Security violation |
| Silently swallowed errors | HIGH | Debugging impossible |
| Bypassing guards with @Public() | HIGH | Authorization bypass |
| Non-idempotent queue processors | HIGH | Duplicate notifications/logs |
| Creating new global guard | CRITICAL | Architectural change |
| Using class-validator instead of Zod | HIGH | Mixed validation paradigms |

### 17.2 Frontend Forbidden Patterns

| Pattern | Severity | Rationale |
|---------|----------|------------|
| New Axios instance | CRITICAL | Breaks auth interceptors |
| Using Zustand for server state | CRITICAL | Cache inconsistency |
| `any` for API response types | CRITICAL | Type safety violation |
| Date display without timezone handling | HIGH | Off-by-one errors |
| CSV export without BOM | HIGH | Excel compatibility broken |
| New global component without layout | HIGH | Inconsistent UX |
| Bypassing useIsOnLeave() | CRITICAL | Allows ON_LEAVE writes |

### 17.3 Database Forbidden Patterns

| Pattern | Severity | Rationale |
|---------|----------|------------|
| Modifying existing migrations | CRITICAL | Data loss risk |
| Adding NOT NULL without default | CRITICAL | Breaks existing rows |
| Removing columns without deprecation | HIGH | Breaking change |
| ORDER BY random() on large tables | HIGH | Performance killer |
| Missing indexes on tenant filters | HIGH | Slow queries |

---

## 18. Test Coverage Expectations

### 18.1 Unit Test Requirements

| Component | Test Coverage |
|-----------|---------------|
| Service methods with non-trivial logic | 100% |
| Role-based filtering logic | 100% |
| Upsert logic | 100% |
| Transaction boundaries | 100% |

### 18.2 Mock Patterns

```typescript
// Mock PrismaService
const prismaServiceMock = {
  student: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// Mock Queue
const notificationQueueMock = {
  add: jest.fn().mockResolvedValue({}),
};
```

### 18.3 Integration Test Requirements

- institutionId scoping enforced
- CASL authorization with different roles
- OnLeaveGuard blocking mutations

### 18.4 What NOT to Test

- Built-in NestJS behavior (guard execution order, pipe transformation)
- Prisma client directly
- Third-party library internals (FCM, MinIO, bcrypt)
- Generated types from Zod

---

## 19. Migration & Deployment Review

### 19.1 Migration Protocol

| Step | Action |
|------|--------|
| 1 | Create branch for schema change |
| 2 | Modify `schema.prisma` |
| 3 | Run `npx prisma migrate dev --name descriptive_name` |
| 4 | Review generated SQL |
| 5 | Test on local database |
| 6 | Commit migration file |
| 7 | Run `npx prisma generate` |
| 8 | Verify application starts |

### 19.2 Migration Safety Rules

- Never modify existing migration files
- Never add NOT NULL columns without a default value on existing tables
- Use nullable columns when adding new required fields to existing tables
- Test migrations on production-like data volume before deploying

### 19.3 Deployment Checklist

- [ ] Migration applied to production database
- [ ] Prisma client regenerated
- [ ] Application restarted
- [ ] Health check passes
- [ ] Smoke tests executed

---

## 20. Environment & Configuration

### 20.1 Environment Variable Protocol

| Step | Action |
|------|--------|
| 1 | Add variable to `env.schema.ts` with Zod validation |
| 2 | Add to `.env.example` with placeholder value |
| 3 | Add to docker-compose.yml if infrastructure-related |
| 4 | Document in docs/INFRASTRUCTURE.md |

### 20.2 Required Environment Variables

| Variable | Purpose | Validation |
|----------|---------|------------|
| APP_MODE | api or worker | z.enum(['api', 'worker']) |
| DATABASE_URL | PostgreSQL connection | valid postgres URL |
| REDIS_HOST / REDIS_PORT | Redis connection | string / number |
| JWT_SECRET | Access token signing | string.min(32) |
| JWT_REFRESH_SECRET | Refresh token signing | string.min(32) |
| NEXTAUTH_SECRET | NextAuth session encryption | string.min(32) |
| MINIO_ENDPOINT | MinIO server address | string |
| FCM_PROJECT_ID | Firebase Cloud Messaging | string |

### 20.3 Secrets Management

**FORBIDDEN:** Hardcoding secrets in source code. All secrets must be injected via environment variables.

---

## 21. Dependency Management

### 21.1 New Dependency Protocol

| Step | Action |
|------|--------|
| 1 | Justify need (existing alternatives insufficient) |
| 2 | Check package.json for current dependencies |
| 3 | Evaluate maintenance status and security history |
| 4 | Add to package.json with version range |
| 5 | Run npm install |
| 6 | Update AGENTS.md if new library added to stack |

### 21.2 Existing Library Usage

Before adding new code that uses a library, verify the library is already in the project:

```bash
# Check package.json for library
grep "library-name" package.json
```

Common existing libraries:

- Backend: @nestjs/*, prisma, @prisma/client, bullmq, zod, bcrypt, @nestjs/config
- Frontend: next, react, @tanstack/react-query, react-hook-form, @hookform/resolvers, zod, axios, sonner, shadcn-ui

---

## 22. Documentation Update Triggers

| Change Type | Required Documentation Update |
|-------------|------------------------------|
| New module | Add to AGENTS.md modules list + docs/ARCHITECTURE.md |
| New Prisma model | Add to docs/DATABASE.md schema section |
| New queue | Add to docs/WORKERS.md queue topology |
| New environment variable | Add to .env.example + docs/INFRASTRUCTURE.md |
| New CASL subject | Add to AGENTS.md CASL subjects list |
| New role | Update role hierarchy table in docs/MULTITENANCY.md |
| New forbidden pattern | Add to AGENTS.md §22 |

---

## 23. Code Review Workflow

### 23.1 PR Checklist

Every pull request must pass:

- [ ] All institutionId filters present on tenant-scoped queries
- [ ] CASL @CheckAbility() on every controller route
- [ ] Zod validation on all DTOs
- [ ] Queue dispatch after successful mutations
- [ ] No `any` types introduced
- [ ] No console.log/error (use Logger)
- [ ] Unit tests for new service methods
- [ ] npm run lint and npm run typecheck pass
- [ ] New environment variables documented
- [ ] Prisma migration generated (if schema changed)
- [ ] No secrets in diff

### 23.2 PR Size Limits

**Maximum: 400 lines of changed code** (excluding generated files, migrations, and lock files)

If exceeded, split into logically separate PRs.

### 23.3 Commit Style

Use conventional commits:

```
feat(grades): add upsert endpoint for grade records
fix(attendance): correct institutionId filter in findAll
docs(convivencias): add notification trigger for parent_meeting
refactor(notifications): extract getRecipientsForStudent helper
test(courses): add unit tests for exportAlumnosCsv
```

---

## 24. Reviewer Calibration

### 24.1 Role-Based Access Verification

Each review must verify role-specific access:

```typescript
// Example: Verify TEACHER can only read grades for their courses
if (user.role === 'TEACHER') {
  const teacherCourses = await this.getTeacherCourses(user.id);
  where.courseId = { in: teacherCourses.map(c => c.id) };
}
```

### 24.2 ON_LEAVE Guard Calibration

Verify exemptions and blocks:

- Exempt paths: login, logout, refresh, password change, leave request, restore
- Blocked: all mutating methods (POST, PUT, PATCH, DELETE) for users with status ON_LEAVE

### 24.3 SkipLeaveCheck Calibration

Verify `@SkipLeaveCheck()` usage is justified:

- Used only on paths that must work even when user is ON_LEAVE
- Documented in OnLeaveGuard source

---

## 25. Scalability Verification

### 25.1 Horizontal Scaling Readiness

| Requirement | Verification |
|-------------|--------------|
| API instances stateless | Verify no local state, JWT auth |
| Worker instances stateless | Verify no module-level variables |
| Load balancer compatible | Verify no sticky session dependencies |

### 25.2 Current Scale Targets

| Dimension | Current | Target |
|-----------|---------|--------|
| Institutions | 1–10 | 100–1,000 |
| Concurrent users per institution | 50–200 | 500–2,000 |
| API RPS (peak) | 50 | 500 |
| BullMQ jobs/hour | 1,000 | 10,000 |
| Database (PostgreSQL) | ~50GB | ~500GB |

### 25.3 Scaling Triggers

| Metric | Trigger | Action |
|--------|---------|--------|
| API RPS > 200 | Scale API | docker compose up --scale api=N |
| BullMQ jobs > 5,000/hr | Scale workers | docker compose up --scale worker=N |
| Job throughput > 10,000/hr | Evaluate Kafka | See docs/WORKERS.md §26 |
| DB queries slow (>500ms p95) | Add indexes | EXPLAIN ANALYZE |
| Redis memory > 200MB | Review backlog | Update docker-compose |

### 25.4 Redis Configuration

- AOF persistence enabled
- maxmemory: 256MB
- eviction policy: noeviction

---

## 26. Agent Collaboration

### 26.1 Specialized Agent References

The code review agent must reference and coordinate with:

| Agent | File | Coordination |
|-------|------|--------------|
| Security Agent | `agents/security-agent.md` | Escalate vulnerability findings |
| Auth Agent | `agents/auth-agent.md` | Verify auth flow compliance |
| Multi-Tenancy Agent | `agents/multitenancy-agent.md` | Verify tenant isolation |
| Database Agent | `agents/database-agent.md` | Verify schema/migration compliance |
| Worker Agent | `agents/worker-agent.md` | Verify queue processor compliance |
| Frontend Agent | `agents/frontend-agent.md` | Verify React/Next.js compliance |
| Backend Agent | `agents/backend-agent.md` | Verify NestJS pattern compliance |

### 26.2 Escalation Path

For architectural violations that cannot be resolved in code review:

1. Document violation in PR comments
2. Reference relevant section in AGENTS.md
3. Request review from security-agent for security-related issues
4. Request architecture review for multi-tenancy or infrastructure changes

### 26.3 Documentation-Driven Review

All code review must be grounded in existing documentation:

- Read relevant `docs/*.md` files before reviewing code affecting those areas
- Reference specific section numbers in review comments
- Update documentation when new patterns are introduced

---

## Appendix A: Quick Reference

### A.1 Critical Invariants

| Invariant | File Location | Section |
|-----------|---------------|---------|
| institutionId on all tenant queries | AGENTS.md | §8.1 |
| Zod-only validation | AGENTS.md | §12.1 |
| No any types | AGENTS.md | §16.1 |
| Queue dispatch after mutations | AGENTS.md | §5.7 |
| FCM via NotificationQueueService | AGENTS.md | §7.4 |
| React Query for server state | AGENTS.md | §6.2 |
| BOM + semicolon for CSV | AGENTS.md | §6.6 |

### A.2 Forbidden Patterns Summary

**Backend (11 patterns):**
Business logic in controllers, Prisma without institutionId, FcmService direct call, any types, Promise.all bulk PDFs, circular dependencies, hardcoded secrets, swallowed errors, @Public() bypass, non-idempotent processors, new global guard, class-validator.

**Frontend (7 patterns):**
New Axios instance, Zustand server state, any response types, date without timezone, CSV without BOM, global component without layout, useIsOnLeave bypass.

**Database (5 patterns):**
Modify migrations, NOT NULL without default, remove columns, random() ordering, missing indexes.

### A.3 Review Checklist Template

```
## Code Review Checklist

### Security
- [ ] JWT validation correct
- [ ] Passwords hashed with bcrypt
- [ ] @CheckAbility() on all routes
- [ ] No hardcoded secrets

### Multi-Tenancy
- [ ] institutionId on all tenant queries
- [ ] SUPER_ADMIN handled correctly
- [ ] Queue payloads include institutionId

### TypeScript
- [ ] No any types
- [ ] No ! assertions
- [ ] Explicit typing

### Patterns
- [ ] Thin controllers
- [ ] Zod + ZodPipe
- [ ] Queue dispatch after mutations
- [ ] React Query for server state

### Performance
- [ ] Indexes on tenant filters
- [ ] Pagination defaults
- [ ] No N+1 queries

### Tests
- [ ] Unit tests for service logic
- [ ] npm run lint passes
- [ ] npm run typecheck passes
```

---

*This document is the authoritative code review governance document for all AI agents operating within the EduSystem repository. It complements AGENTS.md and specialized agent documents, providing the enforcement layer that validates compliance with all architectural, security, and quality requirements.*