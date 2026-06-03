# EduSystem Backend Engineering Patterns

> **Version:** 1.0
> **Last Updated:** 2026-05-18
> **Classification:** Internal — Backend Engineering Standards
> **Purpose:** Authoritative backend engineering handbook for AI-assisted development within EduSystem

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Non-Goals](#3-non-goals)
4. [Required Context](#4-required-context)
5. [Core Backend Architectural Principles](#5-core-backend-architectural-principles)
6. [NestJS Module Organization Rules](#6-nestjs-module-organization-rules)
7. [Controller Design Rules](#7-controller-design-rules)
8. [Service Layer Rules](#8-service-layer-rules)
9. [DTO & Validation Rules](#9-dto--validation-rules)
10. [Authorization & Guard Rules](#10-authorization--guard-rules)
11. [Multi-Tenancy Backend Rules](#11-multi-tenancy-backend-rules)
12. [Prisma Usage Rules](#12-prisma-usage-rules)
13. [Database Transaction Rules](#13-database-transaction-rules)
14. [Queue & Worker Integration Rules](#14-queue--worker-integration-rules)
15. [Async Workflow Rules](#15-async-workflow-rules)
16. [Error Handling Rules](#16-error-handling-rules)
17. [Logging & Observability Rules](#17-logging--observability-rules)
18. [File & Storage Rules](#18-file--storage-rules)
19. [API Design Rules](#19-api-design-rules)
20. [TypeScript Standards](#20-typescript-standards)
21. [Scalability Considerations](#21-scalability-considerations)
22. [Security Considerations](#22-security-considerations)
23. [Maintainability Standards](#23-maintainability-standards)
24. [Preferred Patterns](#24-preferred-patterns)
25. [Forbidden Patterns](#25-forbidden-patterns)
26. [Good Examples](#26-good-examples)
27. [Bad Examples](#27-bad-examples)
28. [Review Heuristics](#28-review-heuristics)
29. [Refactoring Guidelines](#29-refactoring-guidelines)
30. [Development Workflow Expectations](#30-development-workflow-expectations)
31. [Validation Checklist](#31-validation-checklist)
32. [Expected Quality Standards](#32-expected-quality-standards)

---

## 1. Purpose

This document establishes the authoritative engineering standards for EduSystem backend development. It provides prescriptive pattern guidance for building scalable, maintainable, and secure NestJS backend services within a multi-tenant SaaS educational management platform.

The document serves three primary objectives:

1. **Consistency** — Ensure all backend code follows uniform patterns regardless of author
2. **Maintainability** — Establish clear boundaries that prevent architectural drift over time
3. **Scalability** — Define patterns that support horizontal scaling and operational growth

Every engineer and AI coding agent working on EduSystem backend code MUST internalize these patterns. Deviation from these standards requires explicit architectural justification and review.

---

## 2. Scope

This document governs all backend code within the `backend/` directory of the EduSystem repository, including:

- **NestJS Modules** — All feature modules under `src/modules/`
- **Services** — Business logic layer and orchestration
- **Controllers** — HTTP transport layer
- **DTOs** — Data transfer objects and validation schemas
- **Guards** — Authorization and authentication enforcement
- **Middleware** — Request/response processing
- **Queue Processors** — BullMQ background job handlers
- **Prisma Queries** — Database access patterns
- **Error Handling** — Exception management and propagation
- **Logging** — Observability and diagnostics

This document does NOT govern:
- Frontend code (Next.js, React)
- DevOps/infrastructure provisioning
- Database schema design (governed by DATABASE.md)
- CI/CD pipeline configuration
- Third-party integrations beyond API contracts

---

## 3. Non-Goals

This document deliberately excludes:

- **Frontend patterns** — Covered by separate frontend engineering standards
- **Database schema design** — Defined in `docs/DATABASE.md`
- **Infrastructure provisioning** — Defined in `docs/INFRASTRUCTURE.md`
- **Migration strategies** — Defined in `docs/DATABASE.md`
- **Testing frameworks** — Defined in AGENTS.md testing expectations
- **Code formatting (linting)** — Enforced via ESLint/Prettier configuration
- **Version control workflows** — Defined in AGENTS.md

This document also does NOT serve as a tutorial for NestJS or TypeScript. It assumes familiarity with the framework and language.

---

## 4. Required Context

Before implementing any backend code in EduSystem, engineers and AI agents MUST read and understand the following documents:

| Document | Covers |
|----------|--------|
| `docs/ARCHITECTURE.md` | High-level system design, module responsibilities, request lifecycle |
| `docs/AUTH.md` | JWT authentication, refresh tokens, login/logout flows |
| `docs/DATABASE.md` | Prisma schema, migrations, soft-delete middleware, indexing strategy |
| `docs/MULTITENANCY.md` | Tenant scoping, institutionId propagation, tenant-aware queries, CASL integration |
| `docs/WORKERS.md` | BullMQ topology, queue definitions, processor patterns, retry strategies |
| `docs/INFRASTRUCTURE.md` | Docker Compose, Redis, MinIO, deployment configuration |
| `AGENTS.md` | AI agent behavioral rules, development workflow, PR expectations |

These documents are the authoritative sources for architectural decisions. This patterns document complements them with code-level guidance.

---

## 5. Core Backend Architectural Principles

EduSystem backend follows a strict layered architecture with clear separation of concerns. These principles are non-negotiable.

### 5.1 Thin Controllers

Controllers MUST be thin transport layers that delegate all business logic to services. A controller's responsibility is limited to:

- Route definition and HTTP method mapping
- Request validation via `ZodPipe`
- Parameter extraction (`@InstitutionId()`, `@CurrentUser()`)
- Authorization check via `@CheckAbility()` decorator
- Service delegation and response passthrough

Controllers MUST NOT contain:
- Business logic or domain rules
- Direct Prisma queries
- Authorization logic (beyond CASL decorators)
- Complex orchestration or coordination
- Transaction management

### 5.2 Orchestration-Focused Services

Services MUST be the orchestration layer where all business logic resides. A service's responsibility includes:

- Business rule validation and enforcement
- Prisma query composition
- Transaction management
- Queue job dispatching
- Authorization context evaluation
- Cross-service coordination

Services MUST NOT:
- Handle HTTP request/response directly
- Duplicate business logic that exists elsewhere
- Have hidden side effects
- Exceed 500 lines (architectural smell indicating need for decomposition)

### 5.3 Validation-First Architecture

All input MUST be validated at the controller boundary using Zod schemas via `ZodPipe`. Services MUST assume all input is already validated and types are correct.

The validation-first approach means:
- DTOs define the contract between client and server
- Zod schemas provide runtime validation with compile-time type inference
- Services never re-validate input that has passed through the controller

### 5.4 Queue-Based Heavy Processing

Operations that are latency-sensitive at the API level MUST be offloaded to background workers via BullMQ:

- Push notifications (FCM)
- Audit log persistence
- Grade average recalculation
- PDF report generation
- Bulk data exports

Services dispatch jobs after database commits complete. The API response MUST NOT wait for worker processing to finish.

### 5.5 Tenant-Aware Logic

Every query, mutation, and job MUST be aware of its tenant context. The `institutionId` is the fundamental filtering mechanism for all tenant-scoped operations.

Services MUST:
- Accept `institutionId` as a parameter or derive it from `RequestUser`
- Include `institutionId` in every Prisma query on tenant-scoped models
- Include `institutionId` in every BullMQ job payload

---

## 6. NestJS Module Organization Rules

### 6.1 Feature-Based Module Structure

Every feature in EduSystem lives in its own module directory under `src/modules/`. The module structure MUST follow this pattern:

```
modules/[feature-name]/
├── [feature-name].module.ts      # Module definition
├── [feature-name].controller.ts  # HTTP endpoints
├── [feature-name].service.ts     # Business logic
└── dto/
    ├── create.[feature-name].dto.ts
    ├── update.[feature-name].dto.ts
    └── query.[feature-name].dto.ts
```

### 6.2 Provider Encapsulation

Modules MUST only expose what is necessary. Internal providers MUST NOT leak to other modules unless explicitly designed as shared services.

When a service needs functionality from another module:
- Import the other module's service via dependency injection
- Do NOT replicate the functionality locally

### 6.3 Dependency Boundaries

Dependencies MUST flow in one direction: Controllers → Services → PrismaService/OtherServices.

Circular dependencies between modules are STRICTLY FORBIDDEN. If circular dependencies exist, refactor by extracting shared logic into a third module.

### 6.4 Global Module Restrictions

Only the following modules MAY be marked `@Global()`:

- `PrismaModule` — Database access
- `ConfigModule` — Environment configuration
- `CaslModule` — Authorization factory
- `QueuesModule` — BullMQ queue registration

No other module should be global without explicit architectural approval.

### 6.5 Shared Module Discipline

Avoid creating "shared" modules that accumulate unrelated functionality. Instead, create focused modules that serve a single domain.

---

## 7. Controller Design Rules

Controllers are the thinnest layer in EduSystem. They delegate almost everything to services.

### 7.1 Required Controller Elements

Every controller route MUST include:

```typescript
@Controller('resource')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
export class ResourceController {
  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Resource' })
  create(
    @Body(new ZodPipe(CreateResourceSchema)) dto: CreateResourceDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.resourceService.create(dto, institutionId, user);
  }
}
```

### 7.2 Request Validation

Controllers MUST use `ZodPipe` on every `@Body()` for POST, PUT, and PATCH requests:

- `new ZodPipe(CreateResourceSchema)` validates and transforms input
- The validated DTO is passed to the service as a typed object

### 7.3 Parameter Extraction

Controllers MUST use decorators to extract request context:

- `@InstitutionId()` — Tenant identifier from JWT
- `@CurrentUser()` — Authenticated user object
- `@Param()` — URL path parameters
- `@Query()` — URL query parameters

### 7.4 Authorization Delegation

Controllers MUST use `@CheckAbility()` decorator on every route. The decorator enables CASL guard enforcement based on the defined action and subject.

### 7.5 Forbidden Controller Patterns

Controllers MUST NOT:

```typescript
// BAD: Business logic in controller
@Post()
async create(@Body() dto: any) {
  // NEVER do this
  const data = validateInput(dto);
  const result = await this.prisma.resource.create({ ... });
  await this.notificationService.send(...);
  return result;
}

// BAD: Direct Prisma access in controller
@Post()
async create(@Body() dto: CreateDto) {
  // NEVER do this
  return this.prisma.resource.create({ data: { ...dto, institutionId } });
}

// BAD: Authorization logic in controller
@Post()
async create(@Body() dto: CreateDto, @CurrentUser() user: User) {
  // NEVER do this - use @CheckAbility() instead
  if (user.role !== 'ADMIN') throw new ForbiddenException();
  return this.service.create(dto);
}
```

---

## 8. Service Layer Rules

Services are the orchestration layer. They own business logic, transactional consistency, and coordination with other services.

### 8.1 Service Responsibilities

A service MUST handle:

- Business rule validation (beyond DTO validation)
- Prisma query construction
- Transaction management
- Queue job dispatching
- Cross-service calls
- Authorization context evaluation (based on user role)

### 8.2 Dependency Injection

Services MUST inject dependencies via constructor:

```typescript
@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentSubjectsService: StudentCourseSubjectsService,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly notificationQueue: Queue,
    @InjectQueue(QUEUES.AUDIT) private readonly auditQueue: Queue,
    @InjectQueue(QUEUES.GRADES) private readonly gradeQueue: Queue,
  ) {}
}
```

The first dependency MUST always be `PrismaService`.

### 8.3 Queue Dispatching Pattern

Services MUST dispatch async jobs AFTER database operations complete successfully:

```typescript
async create(dto: CreateGradeDto, user: RequestUser, institutionId: string) {
  const grade = await this.prisma.grade.create({
    data: { ...dto, institutionId },
  });

  // Dispatch AFTER database commit
  await Promise.all([
    this.notificationQueue.add(
      JOBS.GRADE_CREATED,
      { gradeId: grade.id, studentId: dto.studentId, institutionId },
      JOB_OPTIONS.DEFAULT,
    ),
    this.auditQueue.add(
      JOBS.AUDIT_LOG,
      { institutionId, userId: user.id, action: 'CREATE', resource: 'Grade', resourceId: grade.id, after: grade },
      JOB_OPTIONS.CRITICAL,
    ),
  ]);

  return grade;
}
```

### 8.4 Tenant-Safe Querying

Every Prisma query in a service MUST include `institutionId` filter:

```typescript
async findAll(institutionId: string) {
  return this.prisma.student.findMany({
    where: { institutionId, deletedAt: null },
  });
}
```

### 8.5 Forbidden Service Patterns

Services MUST NOT:

- Handle HTTP requests/responses directly
- Duplicate business logic that exists in other services
- Have hidden side effects (e.g., modifying shared state)
- Exceed 500 lines (refactor into smaller, focused services)
- Call guards or interceptors directly

---

## 9. DTO & Validation Rules

All input validation in EduSystem uses Zod schemas. There is no class-validator.

### 9.1 Zod Schema Standards

DTOs MUST follow this pattern:

```typescript
import { z } from 'zod';

export const CreateGradeSchema = z.object({
  studentId: z.string().uuid(),
  courseSubjectId: z.string().uuid(),
  periodId: z.string().uuid(),
  score: z.number().min(0).max(10).multipleOf(0.01),
  type: z.enum(['EXAM', 'ASSIGNMENT', 'ORAL', 'PROJECT', 'PARTICIPATION']),
  description: z.string().max(200).optional(),
  date: z.string().date(),
});
export type CreateGradeDto = z.infer<typeof CreateGradeSchema>;
```

### 9.2 Update DTO Pattern

Update schemas MUST make all fields optional:

```typescript
export const UpdateGradeSchema = z.object({
  score: z.number().min(0).max(10).multipleOf(0.01).optional(),
  type: z.enum(['EXAM', 'ASSIGNMENT', 'ORAL', 'PROJECT', 'PARTICIPATION']).optional(),
  description: z.string().max(200).optional(),
  date: z.string().date().optional(),
});
export type UpdateGradeDto = z.infer<typeof UpdateGradeSchema>;
```

### 9.3 Query DTO Pattern

Query schemas MUST use `z.coerce` for numeric pagination:

```typescript
export const GradeQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  courseSubjectId: z.string().uuid().optional(),
  periodId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});
export type GradeQueryDto = z.infer<typeof GradeQuerySchema>;
```

### 9.4 Validation Messages

Zod schemas MUST include descriptive error messages:

```typescript
z.string().min(1, 'Requerido')
z.string().email('Formato de email inválido')
z.number().min(0, 'La nota no puede ser negativa')
```

### 9.5 Strict Mode

Zod schemas that MUST reject unknown fields MUST use `.strict()`:

```typescript
export const CreateStudentSchema = z.object({ ... }).strict();
```

### 9.6 Forbidden Validation Patterns

DTOs MUST NOT:

- Use class-validator decorators
- Trust raw input without validation
- Use `any` type for payload fields
- Skip `.optional()` for nullable fields

---

## 10. Authorization & Guard Rules

EduSystem implements defense-in-depth authorization with three complementary layers.

### 10.1 JwtAuthGuard

`JwtAuthGuard` is registered as a global `APP_GUARD`. It verifies JWT signature and expiry on every request unless the route is marked `@Public()`.

Services MUST NOT bypass JwtAuthGuard. All authenticated endpoints require a valid JWT.

### 10.2 CASL Authorization

CASL provides ABAC (Attribute-Based Access Control) via `@CheckAbility()` decorator:

```typescript
@CheckAbility({ action: Action.Read, subject: 'Student' })
findAll() { ... }

@CheckAbility({ action: Action.Create, subject: 'Student' })
create() { ... }
```

The CASL ability factory evaluates permissions based on:
- User role (SUPER_ADMIN, ADMIN, DIRECTOR, SECRETARY, PRECEPTOR, TEACHER, GUARDIAN)
- User-level roles (per educational level)
- Resource attributes (e.g., teacher's own course subjects)

### 10.3 OnLeaveGuard

`OnLeaveGuard` is a global guard that blocks all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) for users with `status === ON_LEAVE`.

This guard operates independently of CASL. Even authorized users cannot mutate data while on leave.

### 10.4 Guard Ordering

The execution order is fixed in `app.module.ts`:

1. `TenantMiddleware` — Injects tenant context
2. `JwtAuthGuard` — Verifies JWT
3. `OnLeaveGuard` — Checks user status
4. `CaslGuard` — Evaluates CASL permissions

### 10.5 Permission-Aware Service Design

Services MUST evaluate authorization context when returning data:

```typescript
async findAll(user: RequestUser, institutionId: string, query: GradeQueryDto) {
  // TEACHER: Only their own course subjects
  if (user.role === 'TEACHER') {
    const courseSubjectIds = await this.getTeacherCourseSubjectIds(user.id);
    where.courseSubjectId = { in: courseSubjectIds };
  }

  // GUARDIAN: Only their children's grades
  if (user.role === 'GUARDIAN') {
    const childrenIds = await this.getGuardianChildrenIds(user.id, institutionId);
    where.studentId = { in: childrenIds };
  }
}
```

### 10.6 Forbidden Authorization Patterns

Services MUST NOT:

- Trust frontend authorization decisions
- Skip `@CheckAbility()` decorators on controller routes
- Bypass guards via `@Public()` without justification
- Hard-code role checks instead of using CASL

---

## 11. Multi-Tenancy Backend Rules

EduSystem uses shared-database, shared-schema multi-tenancy with isolation enforced at the application layer.

### 11.1 Tenant Identification

Tenant context is derived from the JWT via `TenantMiddleware`:

```typescript
// TenantMiddleware extracts from JWT payload
req.institutionId = decodedToken.institutionId;
req.userId = decodedToken.sub;
req.userRole = decodedToken.role;
```

### 11.2 institutionId Propagation

Services MUST receive `institutionId` via:

1. **Parameter** — Most common, passed from controller via `@InstitutionId()` decorator
2. **RequestUser** — For GUARDIAN queries, `user.institutionId` is used to scope to their children's institution
3. **SUPER_ADMIN handling** — When `user.role === 'SUPER_ADMIN'`, `institutionId` may be `null` (sees all tenants)

### 11.3 Tenant-Aware Queries

Every Prisma query on tenant-scoped models MUST include `institutionId`:

```typescript
// CORRECT: Tenant-scoped query
const students = await this.prisma.student.findMany({
  where: { institutionId, deletedAt: null },
});

// FORBIDDEN: Unscoped query
const students = await this.prisma.student.findMany(); // Missing institutionId!
```

### 11.4 SUPER_ADMIN Handling

Services MUST handle the SUPER_ADMIN case explicitly:

```typescript
async findAll(institutionId: string | null, user: RequestUser) {
  if (user.role === 'SUPER_ADMIN') {
    // SUPER_ADMIN sees all institutions - no institutionId filter
    return this.prisma.student.findMany({ where: { deletedAt: null } });
  }
  return this.prisma.student.findMany({ where: { institutionId, deletedAt: null } });
}
```

### 11.5 Tenant-Aware Workers

BullMQ jobs MUST include `institutionId` in their payload:

```typescript
await this.notificationQueue.add(
  JOBS.GRADE_CREATED,
  { gradeId: grade.id, studentId: dto.studentId, institutionId }, // institutionId REQUIRED
  JOB_OPTIONS.DEFAULT,
);
```

Workers are stateless and tenant-agnostic; they derive tenant context from the job payload.

### 11.6 Tenant-Aware File Storage

MinIO object paths MUST include `institutionId` as a path prefix:

```
avatars/{institutionId}/{userId}/{filename}
logos/{institutionId}/{filename}
reports/{institutionId}/{date}/{filename}.pdf
```

### 11.7 Forbidden Multi-Tenancy Patterns

Services MUST NOT:

- Query tenant-scoped models without `institutionId` filter
- Trust client-provided `institutionId` (must come from JWT)
- Allow cross-tenant data access
- Dispatch jobs without `institutionId` in payload

---

## 12. Prisma Usage Rules

Prisma is the sole database access layer. Raw SQL is forbidden except for documented exceptions.

### 12.1 PrismaService Boundaries

All Prisma queries MUST go through `PrismaService`:

```typescript
@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(institutionId: string) {
    return this.prisma.student.findMany({
      where: { institutionId, deletedAt: null },
    });
  }
}
```

### 12.2 Soft-Delete Awareness

Four models have soft delete: `Institution`, `User`, `Student`, `Announcement`. The PrismaService middleware automatically injects `deletedAt: null` into `findMany` and `findFirst` queries.

Services MUST NOT manually filter `deletedAt` unless explicitly restoring a soft-deleted record.

### 12.3 Relation Loading

Use `include` to load related entities:

```typescript
const student = await this.prisma.student.findUnique({
  where: { id },
  include: { guardians: true, enrollments: true },
});
```

Use `select` to limit returned fields when full entities are not needed:

```typescript
const courseSubjects = await this.prisma.courseSubject.findMany({
  where: { teacherId: user.id },
  select: { id: true },
});
```

### 12.4 Pagination

All list queries MUST support pagination via `take` and `skip`:

```typescript
const students = await this.prisma.student.findMany({
  where: { institutionId },
  take: query.limit || 20,
  skip: ((query.page || 1) - 1) * (query.limit || 20),
});
```

Default limit: 100, max limit: 100.

### 12.5 N+1 Prevention

Services MUST avoid N+1 query patterns. Use `include` or batch queries:

```typescript
// BAD: N+1 queries
const grades = await this.prisma.grade.findMany({ where: { ... } });
for (const grade of grades) {
  const student = await this.prisma.student.findUnique({ where: { id: grade.studentId } }); // N+1!
}

// GOOD: Include relations
const grades = await this.prisma.grade.findMany({
  where: { ... },
  include: { student: true },
});
```

### 12.6 Forbidden Prisma Patterns

Services MUST NOT:

- Use unsafe raw SQL (`$queryRaw` without documented justification)
- Create N+1 query patterns
- Use unbounded `include` statements
- Query without `institutionId` on tenant-scoped models
- Bypass Prisma abstractions unnecessarily

---

## 13. Database Transaction Rules

Transactions ensure atomicity for multi-step operations that write to multiple models.

### 13.1 Transaction Boundaries

Use `prisma.$transaction()` for atomic multi-model writes:

```typescript
await this.prisma.$transaction(async (tx) => {
  await tx.attendance.create({ data: attendanceData });
  await tx.justification.create({ data: { attendanceId: attendance.id, ...justificationData } });
});
```

### 13.2 Service Transaction Wrapper

PrismaService provides a typed transaction helper:

```typescript
async runTransaction<T>(fn: (prisma: PrismaService) => Promise<T>): Promise<T> {
  return this.$transaction((tx) => fn(tx as unknown as PrismaService));
}
```

Services can use this wrapper for cleaner transaction code.

### 13.3 Consistency Guarantees

Transactions MUST:

- Complete within reasonable time (seconds, not minutes)
- Not exceed 50 database operations per transaction
- Avoid long-running operations (bulk inserts should batch)

### 13.4 Async Consistency

When dispatching BullMQ jobs after transactions, ensure the transaction has committed:

```typescript
// CORRECT: Dispatch after transaction completes
await this.prisma.$transaction(async (tx) => {
  await tx.grade.create({ data: gradeData });
});
// Transaction committed - safe to dispatch
await this.notificationQueue.add(JOBS.GRADE_CREATED, { ... });
```

### 13.5 Forbidden Transaction Patterns

Services MUST NOT:

- Create oversized transactions with hundreds of operations
- Hold transactions open while waiting for external calls
- Use transactions inside loops
- Mix transaction and non-transaction writes to related data

---

## 14. Queue & Worker Integration Rules

BullMQ handles all async processing. The API MUST NOT block on heavy operations.

### 14.1 Queue Topology

EduSystem uses four queues:

| Queue | Processor | Purpose |
|-------|-----------|---------|
| `notifications` | `NotificationProcessor` | Push notifications, in-app notifications |
| `audit-log` | `AuditProcessor` | Audit log persistence |
| `grade-processing` | `GradeProcessor` | Grade average recalculation |
| `pdf-generation` | `ReportsProcessor` | PDF report generation |

### 14.2 Job Payload Requirements

Every job payload MUST include:

- `institutionId` — For tenant isolation
- All data required to process the job independently

```typescript
// CORRECT: Complete payload
await this.notificationQueue.add(
  JOBS.GRADE_CREATED,
  { gradeId: grade.id, studentId: dto.studentId, institutionId },
  JOB_OPTIONS.DEFAULT,
);

// INCOMPLETE: Missing institutionId - FORBIDDEN
await this.notificationQueue.add(
  JOBS.GRADE_CREATED,
  { gradeId: grade.id },
  JOB_OPTIONS.DEFAULT,
);
```

### 14.3 Job Options

Use standardized job options:

```typescript
export const JOB_OPTIONS = {
  DEFAULT: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
  CRITICAL: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
  LOW_PRIORITY: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    priority: 10,
    removeOnComplete: 50,
    removeOnFail: 100,
  },
};
```

- `DEFAULT`: Normal jobs (notifications, audit)
- `CRITICAL`: Data integrity jobs (audit logs)
- `LOW_PRIORITY`: Heavy jobs (PDF generation)

### 14.4 Idempotent Processors

Workers MUST be idempotent - processing the same job twice must not cause duplicate side effects:

```typescript
@Process(JOBS.GRADE_CREATED)
async handleGradeCreated(job: Job<GradeCreatedPayload>) {
  const { gradeId, institutionId } = job.data;

  // Idempotency check: skip if already processed
  const existing = await this.prisma.notification.findFirst({
    where: {
      type: 'GRADE',
      data: { gradeId } as any,
      institutionId,
    },
  });
  if (existing) return; // Already processed

  // ... send notifications
}
```

### 14.5 Forbidden Queue Patterns

Workers MUST NOT:

- Dispatch nested BullMQ jobs from processors
- Use `Promise.all()` for bulk PDF processing (causes browser exhaustion)
- Store sensitive credentials in job payloads
- Process jobs that lack `institutionId`

---

## 15. Async Workflow Rules

EduSystem follows an event-driven pattern where domain events translate directly into BullMQ jobs.

### 15.1 Event-Driven Pattern

```
Domain Event (Grade Created)
    → Service Layer calls NotificationQueueService.notify()
    → BullMQ Producer enqueues job
    → Worker Process dequeues and executes
```

### 15.2 Queue-First Heavy Workflows

All latency-sensitive operations MUST use queues:

| Operation | Why Queue |
|-----------|----------|
| Push notifications | FCM has non-deterministic latency |
| Audit logging | Must not block API response |
| Grade recalculation | Non-critical computation |
| PDF generation | Puppeteer has 30+ second startup |

### 15.3 API Non-Blocking

The API response MUST return before async jobs complete:

```typescript
// CORRECT: Return immediately, process async
@Post()
async create(@Body() dto: CreateGradeDto) {
  const grade = await this.prisma.grade.create({ ... });
  // Dispatch async, don't wait
  this.notificationQueue.add(JOBS.GRADE_CREATED, { gradeId: grade.id, ... });
  return grade; // Response sent immediately
}

// FORBIDDEN: Wait for async processing
@Post()
async create(@Body() dto: CreateGradeDto) {
  const grade = await this.prisma.grade.create({ ... });
  await this.notificationQueue.add(JOBS.GRADE_CREATED, { gradeId: grade.id });
  await this.gradeQueue.add(JOBS.RECALCULATE_AVERAGE, { studentId: dto.studentId });
  // WAITING blocks the response - DO NOT DO THIS
  await this.processGradeJob(grade.id);
  return grade;
}
```

### 15.4 Retry-Safe Processing

Jobs MUST handle transient failures via BullMQ's built-in retry:

- Exponential backoff for transient errors
- Non-transient errors should fail immediately
- Log errors at point of origin, don't re-throw

### 15.5 Forbidden Async Patterns

Services MUST NOT:

- Block HTTP responses on async processing
- Use synchronous processing for heavy operations
- Create hidden async side effects (e.g., firing jobs without awaiting)
- Implement fragile retry logic instead of using BullMQ

---

## 16. Error Handling Rules

EduSystem uses a consistent exception handling strategy via `GlobalExceptionFilter`.

### 16.1 Exception Types

Use standard NestJS exceptions:

```typescript
throw new BadRequestException('Validation failed');
throw new NotFoundException('Student not found');
throw new ForbiddenException('No permission to perform this action');
throw new ConflictException('Student already enrolled in this course');
```

### 16.2 Prisma Error Transformation

Transform Prisma errors into domain-specific exceptions:

```typescript
try {
  await this.prisma.student.create({ data });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      throw new ConflictException('Student with this document number already exists');
    }
    if (err.code === 'P2025') {
      throw new NotFoundException('Course not found');
    }
  }
  this.logger.error('Error creating student', err);
  throw err;
}
```

### 16.3 Error Response Format

`GlobalExceptionFilter` normalizes all errors:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "timestamp": "2026-05-18T14:00:00.000Z",
  "path": "/api/v1/grades"
}
```

### 16.4 Safe Error Exposure

Error messages MUST NOT expose internal details:

```typescript
// BAD: Leaking internal details
throw new InternalServerErrorException(`Database connection failed: ${err.message}`);

// GOOD: Safe generic message
throw new InternalServerErrorException('An unexpected error occurred');
```

### 16.5 Error Logging

All exceptions MUST be logged by `GlobalExceptionFilter`:

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error(
      `${request.method} ${request.url} ${status}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(...);
  }
}
```

### 16.6 Forbidden Error Patterns

Services MUST NOT:

- Swallow exceptions silently
- Expose internal error details in responses
- Create inconsistent error formats
- Fail silently without logging

---

## 17. Logging & Observability Rules

EduSystem uses NestJS built-in `Logger` for all logging.

### 17.1 Structured Logging

Log with appropriate levels:

```typescript
this.logger.log(`Student ${student.id} enrolled in course ${courseId}`);
this.logger.error('Failed to send FCM notification', err);
this.logger.warn('Slow query detected', { query: 'SELECT ...', duration: 1200 });
```

### 17.2 Tenant-Aware Logging

Include tenant context in logs:

```typescript
this.logger.log(`Grade created: ${grade.id}`, { institutionId, userId });
```

### 17.3 What to Log

Log the following:
- Operation start/end with entity IDs
- Non-recoverable errors with stack traces
- Security-relevant events (login failures, authorization denials)
- Performance metrics for slow operations (>500ms)

### 17.4 What NOT to Log

NEVER log:
- Passwords or password hashes
- JWT access tokens
- Refresh tokens
- Personal identifying information (PII)
- Secret credentials

### 17.5 Async Observability

Jobs MUST log their processing:

```typescript
@Process(JOBS.GRADE_CREATED)
async handleGradeCreated(job: Job<GradeCreatedPayload>) {
  this.logger.log(`Processing grade created job ${job.id}`, {
    gradeId: job.data.gradeId,
    institutionId: job.data.institutionId,
  });

  try {
    // ... processing
    this.logger.log(`Grade created job ${job.id} completed`);
  } catch (err) {
    this.logger.error(`Grade created job ${job.id} failed`, err);
    throw err; // Let BullMQ handle retry
  }
}
```

### 17.6 Forbidden Logging Patterns

Services MUST NOT:

- Log secrets, tokens, or credentials
- Log inconsistent levels (mixing log/warn/error without cause)
- Skip logging for operations that should be observable
- Use console.log/console.error (use Logger)

---

## 18. File & Storage Rules

EduSystem uses MinIO (S3-compatible) for all file storage.

### 18.1 Upload Flow

1. Frontend requests presigned URL from `StorageModule`
2. Frontend uploads directly to MinIO (bypasses API)
3. Frontend notifies API of completed upload
4. API stores object key in database

### 18.2 Storage Paths

Object paths MUST follow the pattern:

| Asset Type | Path Pattern |
|------------|--------------|
| User Avatars | `avatars/{institutionId}/{userId}.{ext}` |
| Institution Logos | `logos/{institutionId}/{filename}` |
| PDF Reports | `reports/{institutionId}/{date}/{filename}.pdf` |
| Justification Files | `justifications/{institutionId}/{justificationId}/{filename}` |

### 18.3 StorageService Usage

Use `StorageService` for all storage operations:

```typescript
constructor(private readonly storageService: StorageService) {}

async uploadAvatar(file: Express.Multer.File, userId: string, institutionId: string) {
  const key = `avatars/${institutionId}/${userId}.${path.extname(file.originalname)}`;
  return this.storageService.upload(key, file.buffer, file.mimetype);
}

async getPresignedUrl(key: string) {
  return this.storageService.getPresignedGetUrl(key, 300); // 5 minutes
}
```

### 18.4 Upload Validation

StorageService MUST validate:
- File size (max 5MB for avatars, 10MB for documents)
- MIME type (images only for avatars, PDFs/images for documents)
- File extension whitelist

### 18.5 Forbidden Storage Patterns

Services MUST NOT:

- Allow unrestricted uploads (no size/type validation)
- Use tenant-unaware object paths
- Store files on local filesystem (use MinIO)
- Generate public URLs without presigned expiration

---

## 19. API Design Rules

EduSystem follows REST conventions with consistent response shapes.

### 19.1 REST Conventions

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/resources` | List (paginated) |
| GET | `/resources/:id` | Single resource |
| POST | `/resources` | Create |
| PUT | `/resources/:id` | Full replace |
| PATCH | `/resources/:id` | Partial update |
| DELETE | `/resources/:id` | Soft delete |

### 19.2 Response Format

Single resources return the object directly:

```json
{
  "id": "uuid",
  "firstName": "John",
  "lastName": "Doe",
  ...
}
```

Lists return arrays directly (not wrapped):

```json
[
  { "id": "uuid", "firstName": "John", ... },
  { "id": "uuid", "firstName": "Jane", ... }
]
```

### 19.3 Pagination

List endpoints support pagination via query params:

```
GET /grades?page=1&limit=20
GET /students?page=2&limit=50
```

Default: page 1, limit 20. Max limit: 100.

### 19.4 HTTP Status Codes

| Status | Usage |
|--------|-------|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (created) |
| 204 | Successful DELETE (no body) |
| 400 | Validation error (Zod failures) |
| 401 | Unauthorized (invalid/expired JWT) |
| 403 | Forbidden (CASL denial or ON_LEAVE) |
| 404 | Resource not found |
| 409 | Conflict (unique constraint) |
| 500 | Internal server error |

### 19.5 Route Ordering

More specific routes MUST be defined before parameterized routes:

```typescript
// CORRECT: Specific route first
@Get('my-subjects')
getMySubjects() { ... }

@Get(':id')
getOne(@Param('id') id: string) { ... }

// FORBIDDEN: Parameterized route first (will match "my-subjects" as :id)
@Get(':id')
getOne(@Param('id') id: string) { ... }

@Get('my-subjects')
getMySubjects() { ... } // Never reached!
```

### 19.6 Forbidden API Patterns

Services MUST NOT:

- Return inconsistent response shapes
- Leak internal database models directly
- Use weak typing for API responses
- Have implicit endpoint behavior

---

## 20. TypeScript Standards

EduSystem enforces strict TypeScript typing throughout the codebase.

### 20.1 Explicit Types

All function parameters and return types MUST be explicitly typed:

```typescript
// CORRECT: Explicit types
function findAll(institutionId: string, user: RequestUser, query: GradeQueryDto): Promise<Grade[]> {
  // ...
}

// FORBIDDEN: Implicit return type
function findAll(institutionId, user, query) {
  return this.prisma.grade.findMany({ ... }); // No explicit return type!
}
```

### 20.2 No `any`

The `any` type is STRICTLY FORBIDDEN except:
- When the type is truly indeterminate, use `unknown` and narrow with type guards
- Third-party library callbacks with untyped parameters

```typescript
// FORBIDDEN: Using any
const data: any = response.data;

// CORRECT: Use unknown with type narrowing
const data: unknown = response.data;
if (isGradeResponse(data)) {
  // use data
}
```

### 20.3 Interface Naming

Use consistent naming:
- `PascalCase` for interfaces and types: `CreateStudentDto`, `GradeResponse`
- `SCREAMING_SNAKE_CASE` for enums: `Role`, `GradeType`
- `camelCase` for variables and functions: `institutionId`, `findAll`

### 20.4 Type Safety

Avoid type assertions (`as`) unless the type is verified:

```typescript
// BAD: Unverified assertion
const student = data as Student;

// GOOD: Verified via type guard or Zod parse
const student = studentSchema.parse(data);
```

### 20.5 Return Types

Async functions MUST have explicit Promise return types:

```typescript
// CORRECT: Explicit Promise return type
async findAll(institutionId: string): Promise<Student[]> { ... }

// CORRECT: Void for non-async operations
function validateInput(dto: CreateStudentDto): void { ... }
```

### 20.6 Forbidden TypeScript Patterns

Services MUST NOT:

- Use excessive `any` types
- Create unsafe type assertions
- Skip explicit return types on async functions
- Use loose typing for API contracts

---

## 21. Scalability Considerations

EduSystem is designed to scale horizontally at the container level.

### 21.1 Horizontal Scaling

- **API containers**: Stateless, scale by adding replicas behind a load balancer
- **Worker containers**: Stateless, scale by adding replicas. BullMQ handles job distribution
- **Database**: Single PostgreSQL instance; consider read replicas at higher scale

### 21.2 Queue-Driven Scalability

Heavy processing runs in workers, not API. This allows:
- API containers to scale independently from worker containers
- Worker containers to scale based on queue depth
- API response times to remain low and predictable

### 21.3 Database Scalability

- Use indexes on `institutionId` and foreign keys
- Use `select` to limit returned fields
- Avoid N+1 queries with `include`
- Use pagination for list endpoints

### 21.4 Memory Considerations

Avoid memory-heavy operations in API:
- Large file uploads stream directly to MinIO
- Bulk PDF generation runs in workers
- Large data exports run as async jobs

### 21.5 Connection Pooling

Prisma manages connection pooling. Monitor:
- Query latency under load
- Connection pool exhaustion
- Add PgBouncer at higher scale

### 21.6 Forbidden Scalability Patterns

Services MUST NOT:

- Block HTTP requests with heavy processing
- Load unbounded data into memory
- Create unbounded queries without pagination
- Implement blocking synchronous operations

---

## 22. Security Considerations

EduSystem implements defense-in-depth security across all layers.

### 22.1 Authentication

- JWT access tokens (15-minute expiry)
- Refresh token rotation (7-day expiry)
- Refresh tokens stored as bcrypt hashes in database

### 22.2 Authorization

- CASL for ABAC permissions
- Role hierarchy: SUPER_ADMIN > ADMIN > DIRECTOR > SECRETARY > PRECEPTOR > TEACHER > GUARDIAN
- OnLeaveGuard blocks mutations for ON_LEAVE users

### 22.3 Input Validation

- All input validated via Zod schemas
- Strict mode rejects unknown fields
- Error messages do not expose internal details

### 22.4 SQL Injection Prevention

- Prisma parameterizes all queries
- Raw SQL forbidden except documented exceptions
- Never concatenate user input into queries

### 22.5 Tenant Isolation

- Every query on tenant-scoped models includes `institutionId`
- Super_admin explicitly handled to bypass tenant filter
- Cross-tenant access strictly forbidden

### 22.6 File Upload Security

- MIME type validation
- File size limits
- Presigned URLs with expiration (not permanent public URLs)

### 22.7 Secrets Management

- All secrets via environment variables
- JWT_SECRET, JWT_REFRESH_SECRET, NEXTAUTH_SECRET minimum 32 characters
- Never commit secrets to repository

### 22.8 Forbidden Security Patterns

Services MUST NOT:

- Handle tokens insecurely (log tokens, store plaintext)
- Bypass authentication/authorization boundaries
- Use unsafe dynamic execution (eval, new Function)
- Leak sensitive data in responses or logs

---

## 23. Maintainability Standards

EduSystem code must be readable, modular, and simple.

### 23.1 Readability

- Clear, descriptive names for functions, variables, and types
- Single responsibility per function
- Avoid clever tricks that obscure intent
- Comment complex business logic, not obvious code

### 23.2 Modularity

- Feature-based module organization
- Small, focused services (under 500 lines)
- Clear dependency boundaries
- No circular dependencies

### 23.3 Simplicity Over Cleverness

- Prefer obvious patterns over complex abstractions
- Avoid speculative abstractions (you aren't going to need it)
- Use existing patterns rather than inventing new ones

### 23.4 Explicit Architecture

- Clear separation: Controllers → Services → Prisma
- Explicit tenant context in every query
- Explicit authorization via decorators
- Explicit async via queue dispatch

### 23.5 Duplication Prevention

- Extract shared logic into reusable services
- Don't copy-paste business logic
- DTOs should be reusable across modules where appropriate

### 23.6 Forbidden Maintainability Patterns

Services MUST NOT:

- Create giant files (modules, services over 500 lines)
- Add speculative abstractions
- Duplicate business logic
- Introduce tight coupling between modules
- Hide side effects

---

## 24. Preferred Patterns

These are the recommended patterns for EduSystem backend development:

### 24.1 Thin Controllers

Controllers delegate to services, use decorators for context, and validate via ZodPipe.

### 24.2 Orchestration Services

Services own business logic, manage transactions, and dispatch async jobs.

### 24.3 Validation-First

All input validated at controller boundary via Zod schemas.

### 24.4 Tenant-Aware Queries

Every query on tenant-scoped models includes `institutionId` filter.

### 24.5 Queue-First Heavy Processing

Notifications, audit logs, PDF generation run async via BullMQ.

### 24.6 Idempotent Processors

Workers check for existing records to prevent duplicate processing.

### 24.7 Explicit Authorization

CASL decorators on every endpoint, role-aware query filtering in services.

### 24.8 Strongly Typed APIs

Explicit return types, no `any`, type-safe DTOs.

### 24.9 Modular Architecture

Feature-based modules with clear dependency boundaries.

### 24.10 Operational Simplicity

Queue-driven async, predictable patterns, consistent error handling.

### 24.11 Tenant Validation Through Ownership Chains

When a model has no direct `institutionId` column, validate tenant ownership through relation joins before any mutation.

**Ownership chains in the codebase:**

```
Indicator               → Subject          → institutionId
StudentObservation      → Course           → institutionId
IndicatorEvaluation     → Indicator        → Subject → institutionId
```

```typescript
// CORRECT: Validate tenant via join before mutation
private async assertIndicatorBelongsToInstitution(
  indicatorId: string,
  institutionId: string,
): Promise<Indicator> {
  const indicator = await this.prisma.indicator.findFirst({
    where: {
      id: indicatorId,
      subject: { institutionId },  // Join through Subject → Institution
    },
  });
  if (!indicator) throw new NotFoundException('Indicator not found');
  return indicator;
}
```

**Rules:**
1. Always validate in the service layer **before** any read or mutation.
2. Use `findFirst` with a relation `where` filter (never `findUnique` which bypasses the join).
3. Validate ALL items in bulk operations before performing batch writes — reject the entire batch if any item fails.
4. Extract a private helper method per chain for reuse across service methods.
5. Throw `NotFoundException` when the entity does not belong to the tenant (avoid leaking existence information).

---



## 25. Forbidden Patterns

These patterns are strictly prohibited in EduSystem backend:

### 25.1 Business Logic in Controllers

Controllers MUST NOT contain business logic, Prisma queries, or orchestration.

### 25.2 Tenant-Unaware Queries

Queries without `institutionId` on tenant-scoped models are forbidden.

### 25.3 Giant Services

Services exceeding 500 lines indicate need for decomposition.

### 25.4 Blocking HTTP Requests

Heavy processing MUST NOT block HTTP responses.

### 25.5 Duplicated Business Logic

Copy-pasted logic across services indicates need for extraction.

### 25.6 Unsafe Raw SQL

Raw SQL is forbidden except documented exceptions.

### 25.7 Speculative Abstractions

Don't build frameworks you aren't going to need.

### 25.8 Excessive `any` Usage

Weak typing creates runtime errors and reduces maintainability.

### 25.9 Hidden Side Effects

Services MUST NOT have undocumented side effects.

### 25.10 Insecure Async Workflows

Never call FcmService directly; always use NotificationQueueService.

---

## 26. Good Examples

These examples demonstrate proper implementation of EduSystem patterns:

### 26.1 Proper Controller Delegation

```typescript
@Controller('grades')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  findAll(
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(GradeQuerySchema)) query: GradeQueryDto,
  ) {
    return this.gradesService.findAll(institutionId, user, query);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Grade' })
  create(
    @Body(new ZodPipe(CreateGradeSchema)) dto: CreateGradeDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.gradesService.create(dto, user, institutionId);
  }
}
```

### 26.2 Service Orchestration with Queue Dispatch

```typescript
@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly notificationQueue: Queue,
    @InjectQueue(QUEUES.AUDIT) private readonly auditQueue: Queue,
  ) {}

  async create(dto: CreateGradeDto, user: RequestUser, institutionId: string) {
    const grade = await this.prisma.grade.create({
      data: { ...dto, institutionId },
    });

    await Promise.all([
      this.notificationQueue.add(
        JOBS.GRADE_CREATED,
        { gradeId: grade.id, studentId: dto.studentId, institutionId },
        JOB_OPTIONS.DEFAULT,
      ),
      this.auditQueue.add(
        JOBS.AUDIT_LOG,
        { institutionId, userId: user.id, action: 'CREATE', resource: 'Grade', resourceId: grade.id, after: grade },
        JOB_OPTIONS.CRITICAL,
      ),
    ]);

    return grade;
  }
}
```

### 26.3 Tenant-Safe Prisma Queries

```typescript
async findAll(institutionId: string, user: RequestUser, query: GradeQueryDto) {
  const where: Prisma.GradeWhereInput = {};

  if (query.studentId) where.studentId = query.studentId;
  if (query.periodId) where.periodId = query.periodId;
  if (query.courseSubjectId) where.courseSubjectId = query.courseSubjectId;

  // Role-based filtering
  if (user.role === 'TEACHER') {
    const courseSubjectIds = await this.getTeacherCourseSubjectIds(user.id);
    where.courseSubjectId = { in: courseSubjectIds };
  }

  if (user.role === 'GUARDIAN') {
    const childrenIds = await this.getGuardianChildrenIds(user.id, institutionId);
    where.studentId = { in: childrenIds };
  }

  return this.prisma.grade.findMany({
    where,
    include: { student: true, courseSubject: { include: { subject: true } } },
    orderBy: { date: 'desc' },
  });
}
```

### 26.4 DTO Validation with Zod

```typescript
export const CreateGradeSchema = z.object({
  studentId: z.string().uuid('ID de estudiante inválido'),
  courseSubjectId: z.string().uuid('ID de materia inválido'),
  periodId: z.string().uuid('ID de período inválido'),
  score: z.number().min(0, 'La nota no puede ser negativa').max(10, 'La nota no puede superar 10').multipleOf(0.01),
  type: z.enum(['EXAM', 'ASSIGNMENT', 'ORAL', 'PROJECT', 'PARTICIPATION']),
  description: z.string().max(200).optional(),
  date: z.string().date('Fecha inválida'),
});
export type CreateGradeDto = z.infer<typeof CreateGradeSchema>;
```

### 26.5 Idempotent Queue Processor

```typescript
@Processor(QUEUES.NOTIFICATIONS)
export class NotificationProcessor {
  constructor(private readonly prisma: PrismaService) {}

  @Process(JOBS.GRADE_CREATED)
  async handleGradeCreated(job: Job<GradeCreatedPayload>) {
    const { gradeId, studentId, institutionId } = job.data;

    // Idempotency check
    const existing = await this.prisma.notification.findFirst({
      where: {
        type: 'GRADE_CREATED',
        data: { gradeId } as any,
        institutionId,
      },
    });
    if (existing) {
      this.logger.log(`Skipping duplicate grade notification for ${gradeId}`);
      return;
    }

    // Process notification
    const grade = await this.prisma.grade.findUnique({
      where: { id: gradeId },
      include: { student: { include: { guardians: true } } },
    });

    if (!grade) {
      this.logger.warn(`Grade ${gradeId} not found`);
      return;
    }

    // Send notifications...
  }
}
```

---

## 27. Bad Examples

These examples demonstrate anti-patterns that must be avoided:

### 27.1 Fat Controller with Business Logic

```typescript
// FORBIDDEN: Business logic in controller
@Controller('grades')
export class GradesController {
  @Post()
  async create(@Body() dto: any, @CurrentUser() user: RequestUser) {
    // BAD: Validation in controller
    if (!dto.score || dto.score < 0 || dto.score > 10) {
      throw new BadRequestException('Invalid score');
    }

    // BAD: Prisma in controller
    const grade = await this.prisma.grade.create({
      data: {
        studentId: dto.studentId,
        courseSubjectId: dto.courseSubjectId,
        score: dto.score,
        institutionId: user.institutionId,
      },
    });

    // BAD: Direct FCM call
    await this.fcmService.sendPush(...);

    return grade;
  }
}
```

### 27.2 Giant Service with Mixed Responsibilities

```typescript
// FORBIDDEN: Service over 500 lines with mixed responsibilities
@Injectable()
export class AllTheThingsService {
  // Student operations...
  // Grade operations...
  // Attendance operations...
  // Notification logic...
  // Report generation...
  // Export functionality...
  // 600+ lines of mixed logic
}
```

### 27.3 Unscoped Query Missing institutionId

```typescript
// FORBIDDEN: Missing institutionId filter
async findAll() {
  return this.prisma.student.findMany(); // Cross-tenant leak!
}

// CORRECT: Include institutionId
async findAll(institutionId: string) {
  return this.prisma.student.findMany({ where: { institutionId } });
}
```

### 27.4 Synchronous Heavy Processing Blocking API

```typescript
// FORBIDDEN: Blocking API on heavy processing
@Post('generate-report')
async generateReport(@Body() dto: ReportDto) {
  // BAD: Synchronous PDF generation blocks response
  const pdf = await this.pdfService.generate(dto);
  await this.fcmService.notifyUser(dto.userId, 'Report ready');
  return pdf;
}

// CORRECT: Queue-based async processing
@Post('generate-report')
async generateReport(@Body() dto: ReportDto) {
  await this.reportQueue.add(JOBS.PDF_GENERATE, { ...dto });
  return { message: 'Report generation started' };
}
```

### 27.5 Weak Typing with any

```typescript
// FORBIDDEN: Using any
@Post()
async create(@Body() data: any) {
  const result = await this.prisma.resource.create({ data });
  return result;
}

// CORRECT: Strongly typed DTO
@Post()
async create(@Body(new ZodPipe(CreateResourceSchema)) dto: CreateResourceDto) {
  return this.resourceService.create(dto);
}
```

### 27.6 Hidden Side Effects in Service

```typescript
// FORBIDDEN: Hidden side effect
@Injectable()
export class StudentService {
  private notificationHandler: NotificationHandler; // Hidden dependency

  async create(dto: CreateStudentDto, institutionId: string) {
    const student = await this.prisma.student.create({ ... });

    // BAD: Silent side effect via module-level handler
    this.notificationHandler.onStudentCreated(student);

    return student;
  }
}

// CORRECT: Explicit dependency injection
constructor(
  private readonly prisma: PrismaService,
  @InjectQueue(QUEUES.NOTIFICATIONS) private readonly notificationQueue: Queue,
) {}

async create(dto: CreateStudentDto, institutionId: string) {
  const student = await this.prisma.student.create({ ... });
  await this.notificationQueue.add(JOBS.STUDENT_CREATED, { studentId: student.id, institutionId });
  return student;
}
```

---

## 28. Review Heuristics

These heuristics help reviewers identify architectural drift and pattern violations:

### 28.1 Controller Review

- [ ] Does the controller only delegate to services?
- [ ] Are ZodPipe and DTOs used for validation?
- [ ] Is @CheckAbility() on every route?
- [ ] Are @InstitutionId() and @CurrentUser() used for context?
- [ ] Is there any business logic in the controller?

### 28.2 Service Review

- [ ] Is business logic contained in services?
- [ ] Are Prisma queries tenant-scoped with institutionId?
- [ ] Are queue jobs dispatched after database operations?
- [ ] Is the service under 500 lines?
- [ ] Is there duplicated logic from other services?

### 28.3 Multi-Tenancy Review

- [ ] Does every tenant-scoped query include institutionId?
- [ ] Are job payloads tenant-aware?
- [ ] Does SUPER_ADMIN case handled explicitly?
- [ ] Are file storage paths tenant-prefixed?

### 28.4 Async Workflow Review

- [ ] Are heavy operations queued instead of blocking?
- [ ] Are queue processors idempotent?
- [ ] Is FcmService accessed via NotificationQueueService?
- [ ] Are retry strategies appropriate for job type?

### 28.5 Type Safety Review

- [ ] Are explicit return types on all functions?
- [ ] Is there any `any` type usage?
- [ ] Are DTOs strongly typed via Zod inference?
- [ ] Are type assertions verified?

### 28.6 Security Review

- [ ] Is JWT verified on every authenticated route?
- [ ] Are authorization checks via CASL?
- [ ] Are error messages safe (no internal details)?
- [ ] Are secrets logged?

---

## 29. Refactoring Guidelines

Refactoring must preserve architectural invariants and operational guarantees.

### 29.1 When to Refactor

Refactor when:
- A service exceeds 500 lines
- Logic is duplicated across services
- Coupling between modules is excessive
- Business logic has migrated to controllers
- Tenant safety guarantees are violated

### 29.2 Safe Refactoring Practices

1. **Preserve tenant safety** — Ensure all queries maintain institutionId filtering
2. **Preserve async guarantees** — Don't convert queued operations to synchronous
3. **Preserve authorization** — Maintain CASL decorator coverage
4. **Preserve validation** — Keep ZodPipe on controller boundaries
5. **Preserve types** — Don't introduce `any` or weaken types

### 29.3 Avoid Unnecessary Rewrites

Don't refactor:
- Working code that follows patterns correctly
- Code that needs features, not restructuring
- Stable modules for theoretical improvements
- Code without test coverage (add tests first)

### 29.4 Incremental Changes

Refactor in small, focused steps:
1. Extract duplicate logic into shared service
2. Break giant service into focused services
3. Add tenant scoping to unscoped queries
4. Move business logic from controller to service

### 29.5 Verification

After refactoring:
- Run lint and typecheck
- Verify existing tests pass
- Review for tenant safety
- Check for new patterns introduced

---

## 30. Development Workflow Expectations

Before implementing any feature, engineers and AI agents MUST follow this workflow:

### 30.1 Analyze Existing Patterns

Before writing code:
1. Find 2-3 similar existing modules
2. Understand the established patterns
3. Identify the constraint chain (guards, decorators, middleware)
4. Plan the full change (controller + service + DTO + module registration + CASL + queue)

### 30.2 Preserve Architectural Consistency

- Follow existing patterns exactly
- Don't introduce stylistic variation
- Use existing services and utilities
- Match naming conventions

### 30.3 Preserve Tenant Isolation

- Every query includes institutionId
- Every job includes institutionId
- Every file path includes institutionId
- Test with different tenant contexts

### 30.4 Preserve Async Guarantees

- Heavy processing goes to queues
- Don't block HTTP responses
- Use existing queue patterns
- Verify idempotent processors

### 30.5 Avoid Speculative Abstractions

- Don't build features you aren't going to need
- Don't create generic frameworks
- Use existing patterns instead of inventing new ones

### 30.6 Explain Architecture-Impacting Changes

For changes that:
- Add or modify institutionId scoping logic
- Change authentication or authorization
- Add new BullMQ queue or processor
- Modify Prisma schema
- Introduce new library or service dependency

You MUST explain the reasoning before implementing and wait for confirmation.

### 30.7 Reuse Existing Patterns

- Find similar implementations before creating new code
- Use shared services (NotificationQueueService, StorageService)
- Follow established module structure
- Match existing code style

---

## 31. Validation Checklist

Before submitting any backend code, verify:

### Controllers
- [ ] Controllers only delegate to services (no business logic)
- [ ] ZodPipe used on every @Body() for POST/PUT/PATCH
- [ ] @CheckAbility() on every route
- [ ] @InstitutionId() used for tenant context
- [ ] @CurrentUser() used when user object needed
- [ ] Specific routes before parameterized routes

### Services
- [ ] All business logic in services
- [ ] Prisma queries include institutionId on tenant-scoped models
- [ ] Queue jobs dispatched after database operations
- [ ] Transaction used for multi-model writes
- [ ] Service under 500 lines

### DTOs & Validation
- [ ] Zod schemas for all DTOs
- [ ] Update schemas have optional fields
- [ ] Query schemas use z.coerce for pagination
- [ ] Validation messages included

### Authorization
- [ ] CASL guards on all authenticated routes
- [ ] Role-based filtering in services
- [ ] OnLeaveGuard not bypassed

### Multi-Tenancy
- [ ] Every query includes institutionId filter
- [ ] Every job payload includes institutionId
- [ ] SUPER_ADMIN case handled explicitly
- [ ] File paths include institutionId prefix

### Async & Queues
- [ ] Heavy operations queued (not blocking)
- [ ] Jobs include institutionId
- [ ] Processors idempotent
- [ ] FcmService accessed via NotificationQueueService

### TypeScript
- [ ] Explicit return types on all functions
- [ ] No excessive any usage
- [ ] Type-safe DTOs via Zod inference
- [ ] Strong typing for API contracts

### Error Handling
- [ ] NestJS exceptions used (BadRequestException, NotFoundException, etc.)
- [ ] Error messages don't expose internals
- [ ] Prisma errors transformed to domain exceptions
- [ ] Errors logged appropriately

### Security
- [ ] JWT verified on authenticated routes
- [ ] No secrets logged
- [ ] Input validation on all endpoints
- [ ] Tenant isolation enforced

---

## 32. Expected Quality Standards

All EduSystem backend code MUST meet these quality standards:

### Functional Requirements
- All endpoints work as specified in API contract
- Multi-tenancy isolation never violated
- Authorization correctly enforced on every route
- Async workflows complete reliably
- Error handling consistent and informative

### Code Quality
- Thin controllers (under 150 lines each)
- Focused services (under 500 lines each)
- Strong typing throughout (no any)
- Consistent patterns with existing codebase
- No duplicated business logic

### Operational Requirements
- API response times low and predictable
- Queues handle async processing reliably
- Database queries optimized with proper indexing
- Logging provides observability
- Errors logged with appropriate context

### Security Requirements
- Tenant isolation never compromised
- Authentication verified on every request
- Authorization enforced via CASL
- Input validation on all endpoints
- No secrets exposed in logs or errors

### Maintainability Requirements
- Clear module boundaries
- Explicit patterns followed consistently
- Code readable and self-documenting
- Refactoring safe when needed
- Tests added for critical paths

---

## References

- `docs/ARCHITECTURE.md` — High-level system design
- `docs/AUTH.md` — Authentication and authorization
- `docs/DATABASE.md` — Prisma schema and migrations
- `docs/MULTITENANCY.md` — Tenant isolation patterns
- `docs/WORKERS.md` — BullMQ topology and processors
- `docs/INFRASTRUCTURE.md` — Deployment and infrastructure
- `AGENTS.md` — AI agent behavioral rules

---

*This document is the authoritative backend engineering standards reference for EduSystem. It complements existing architectural documentation with code-level pattern guidance.*