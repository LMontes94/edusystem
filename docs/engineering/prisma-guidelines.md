# EduSystem — Prisma ORM Engineering Guidelines

> **Version:** 1.0
> **Last Updated:** 2026-05-18
> **Classification:** Internal Technical Documentation
> **Audience:** Backend Engineers, AI Coding Agents, Technical Reviewers, Database Architects

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Non-Goals](#3-non-goals)
4. [Required Context](#4-required-context)
5. [Core Prisma Architectural Principles](#5-core-prisma-architectural-principles)
6. [Prisma Service Rules](#6-prisma-service-rules)
7. [Tenant-Aware Query Rules](#7-tenant-aware-query-rules)
8. [Query Composition Rules](#8-query-composition-rules)
9. [Relation Loading Rules](#9-relation-loading-rules)
10. [Pagination Rules](#10-pagination-rules)
11. [Transaction Rules](#11-transaction-rules)
12. [Soft Delete Rules](#12-soft-delete-rules)
13. [Migration Rules](#13-migration-rules)
14. [Schema Design Rules](#14-schema-design-rules)
15. [Indexing & Performance Rules](#15-indexing--performance-rules)
16. [Async Consistency Rules](#16-async-consistency-rules)
17. [Queue & Worker Database Rules](#17-queue--worker-database-rules)
18. [Security Rules](#18-security-rules)
19. [Error Handling Rules](#19-error-handling-rules)
20. [Logging & Observability Rules](#20-logging--observability-rules)
21. [TypeScript & Prisma Typing Rules](#21-typescript--prisma-typing-rules)
22. [Scalability Considerations](#22-scalability-considerations)
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

This document establishes the authoritative Prisma ORM engineering standards for EduSystem backend development. It defines operational rules, patterns, and quality expectations for all database access layer code.

**Why This Document Exists:**

- Ensures consistent Prisma usage across 20+ feature modules
- Prevents tenant isolation violations (cross-tenant data leaks)
- Establishes predictable query behavior for AI coding agents
- Defines maintainable patterns for long-term codebase health

**Authority:** This document is the primary reference for all database-related work. All AGENTS.md database rules reference this document as the authoritative source.

---

## 2. Scope

This document governs:

- All Prisma queries in NestJS services (`src/modules/*/`)
- PrismaService lifecycle and middleware behavior
- Transaction boundaries and patterns
- Relation loading strategies (`include` / `select`)
- Pagination and query limiting
- Soft-delete awareness
- Queue-driven async persistence

**Out of Scope:**

- Frontend database access (React Query patterns — see `docs/engineering/frontend-patterns.md`)
- Migration scripts themselves (governed by `docs/DATABASE.md`)
- Raw SQL in migrations (`prisma/init.sql`, `prisma/seed.ts`)

---

## 3. Non-Goals

This document does **not** define:

- **Prisma schema design** — See `docs/DATABASE.md` for schema conventions, model definitions, and relationship patterns
- **Authentication flows** — See `docs/AUTH.md` for JWT, refresh tokens, and session management
- **Multi-tenancy architecture** — See `docs/MULTITENANCY.md` for tenant isolation strategy, TenantMiddleware, and JWT propagation
- **Queue topology** — See `docs/WORKERS.md` for BullMQ queues, processors, and job patterns
- **Infrastructure configuration** — See `docs/INFRASTRUCTURE.md` for Docker, PostgreSQL, Redis setup

---

## 4. Required Context

Before making any database-related changes, engineers and AI systems **must** read:

| Document | Coverage |
|----------|----------|
| `docs/ARCHITECTURE.md` | System design, module structure, request lifecycle |
| `docs/DATABASE.md` | Full schema, soft-delete, indexing strategy, naming conventions |
| `docs/MULTITENANCY.md` | Tenant isolation specifics, institutionId enforcement |
| `docs/WORKERS.md` | Queue topology, processor patterns, async consistency |
| `docs/INFRASTRUCTURE.md` | Docker, PostgreSQL, Redis configuration |
| `AGENTS.md` | AI agent behavioral rules, development workflow |

**Key Cross-References:**

- PrismaService implementation: `backend/src/prisma/prisma.service.ts:62-82` (soft-delete middleware)
- Tenant filtering examples: `backend/src/modules/grades/grades.service.ts:24-150` (role-based querying)
- Transaction patterns: `backend/src/modules/institutions/institutions.service.ts:31-66` (complex transaction)

---

## 5. Core Prisma Architectural Principles

### 5.1 Tenant-Safety as Non-Negotiable

Every query on a tenant-scoped model must include `institutionId` in the `where` clause. This is not a recommendation — it is a security requirement.

```typescript
// ✅ CORRECT: Explicit institutionId filter
const students = await this.prisma.student.findMany({
  where: { institutionId },
});

// ❌ WRONG: Missing institutionId — potential cross-tenant leak
const students = await this.prisma.student.findMany();
```

### 5.2 PrismaService as Singleton

The `PrismaService` is the **only** PrismaClient instance in the application. It is registered as a global module and injected into all services.

```typescript
// backend/src/prisma/prisma.module.ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Rules:**

- Never create a new `PrismaClient` instance in services
- Never use `PrismaClient` directly — always inject `PrismaService`
- All queries flow through the singleton for middleware consistency

### 5.3 Soft-Delete Transparency

The PrismaService middleware automatically injects `deletedAt: null` into all `findMany` and `findFirst` queries for soft-delete-enabled models. Services **must not** manually add this filter.

```typescript
// backend/src/prisma/prisma.service.ts:62-82
this.$use(async (params, next) => {
  const modelsWithSoftDelete = ['User', 'Student', 'Announcement', 'Institution'];
  if (
    params.model &&
    modelsWithSoftDelete.includes(params.model) &&
    (params.action === 'findMany' || params.action === 'findFirst')
  ) {
    params.args.where = { ...params.args.where, deletedAt: null };
  }
  return next(params);
});
```

### 5.4 Service Encapsulation

All database logic resides in services. Controllers delegate to services; they never construct Prisma queries directly.

```typescript
// ✅ CORRECT: Controller delegates to service
@Controller('students')
export class StudentsController {
  @Get()
  findAll(@InstitutionId() institutionId: string) {
    return this.studentsService.findAll(institutionId);
  }
}

// ❌ WRONG: Database logic in controller
@Controller('students')
export class StudentsController {
  @Get()
  findAll(@InstitutionId() institutionId: string) {
    return this.prisma.student.findMany({ where: { institutionId } }); // Never do this
  }
}
```

---

## 6. Prisma Service Rules

### 6.1 Singleton Expectations

The PrismaService must be the **only** database access point. Services receive it via constructor injection:

```typescript
@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}
}
```

### 6.2 Lifecycle Management

The PrismaService manages its own lifecycle via `OnModuleInit` and `OnModuleDestroy`:

```typescript
async onModuleInit() {
  await this.$connect();
  this.logger.log('Conectado a PostgreSQL');
}

async onModuleDestroy() {
  await this.$disconnect();
  this.logger.log('Desconectado de PostgreSQL');
}
```

### 6.3 Transaction Helper

Use the `runTransaction` helper for atomic multi-step operations:

```typescript
async runTransaction<T>(
  fn: (prisma: PrismaService) => Promise<T>,
): Promise<T> {
  return this.$transaction((tx) => fn(tx as unknown as PrismaService));
}
```

Usage in services:

```typescript
return this.prisma.$transaction(async (tx) => {
  const institution = await tx.institution.create({ data: {...} });
  const admin = await tx.user.create({ data: { institutionId: institution.id, ... } });
  return { institution, admin };
});
```

### 6.4 Query Ownership

Each service owns its queries. Database logic must not leak across service boundaries.

---

## 7. Tenant-Aware Query Rules

### 7.1 institutionId Enforcement

Every query on a tenant-scoped model **must** include `institutionId` in the `where` clause.

```typescript
// ✅ CORRECT: Tenant-scoped query
async findAll(institutionId: string, query: GradeQueryDto) {
  const where: any = { course: { institutionId } };
  if (query.studentId) where.studentId = query.studentId;

  return this.prisma.grade.findMany({
    where,
    include: this.gradeIncludes(),
  });
}
```

Reference: `backend/src/modules/grades/grades.service.ts:24-54`

### 7.2 Tenant-Scoped Filtering

For role-based filtering, always nest tenant context:

```typescript
// GUARDIAN: only their children
if (user.role === 'GUARDIAN') {
  const childrenIds = await this.getGuardianChildrenIds(user.id, institutionId);
  where.studentId = { in: childrenIds };
}

// TEACHER: only their courses
if (user.role === 'TEACHER') {
  const courseIds = await this.getTeacherCourseIds(user.id, institutionId);
  where.courseId = { in: courseIds };
}
```

Reference: `backend/src/modules/attendance/attendance.service.ts:37-47`

### 7.3 Tenant-Safe Relation Loading

When loading relations, ensure the relation path includes tenant filtering:

```typescript
// ✅ CORRECT: Nested tenant filtering
await this.prisma.grade.findMany({
  where: { courseSubject: { course: { institutionId } } },
});

// ❌ WRONG: Missing tenant filter in relation
await this.prisma.grade.findMany({
  where: { courseSubject: { teacherId: user.id } }, // Missing institutionId!
});
```

### 7.4 Never Trust Client-Provided institutionId

Always derive `institutionId` from `req.institutionId` (injected by TenantMiddleware) — never from request body or query parameters:

```typescript
// ✅ CORRECT: Use decorator-injected institutionId
async create(dto: CreateGradeDto, @InstitutionId() institutionId: string) {
  const courseSubject = await this.prisma.courseSubject.findFirst({
    where: { id: dto.courseSubjectId, course: { institutionId } }, // From decorator
  });
}

// ❌ WRONG: Trusting client-provided institutionId
async create(dto: CreateGradeDto) {
  const courseSubject = await this.prisma.courseSubject.findFirst({
    where: { id: dto.courseSubjectId, course: { institutionId: dto.institutionId } }, // Never trust client!
  });
}
```

### 7.5 SUPER_ADMIN Exception

SUPER_ADMIN has `institutionId: null` and can access all institutions. Handle this explicitly:

```typescript
async findAll(institutionId: string | null, user: RequestUser) {
  if (user.role === 'SUPER_ADMIN') {
    // SUPER_ADMIN sees all — no institutionId filter
    return this.prisma.student.findMany({ where: { deletedAt: null } });
  }
  return this.prisma.student.findMany({ where: { institutionId, deletedAt: null } });
}
```

---

## 8. Query Composition Rules

### 8.1 Explicit Where Clauses

Always construct explicit `where` objects rather than relying on dynamic query building that could omit critical filters:

```typescript
// ✅ CORRECT: Explicit where construction
const where: any = { course: { institutionId } };
if (query.studentId) where.studentId = query.studentId;
if (query.periodId) where.periodId = query.periodId;
if (query.courseSubjectId) where.courseSubjectId = query.courseSubjectId;

return this.prisma.grade.findMany({ where });
```

Reference: `backend/src/modules/grades/grades.service.ts:29-55`

### 8.2 Reusable Query Patterns

Extract common filtering logic into private methods:

```typescript
private async getGuardianChildrenIds(userId: string, institutionId: string): Promise<string[]> {
  const guardians = await this.prisma.guardian.findMany({
    where: { userId, student: { institutionId } },
    select: { studentId: true },
  });
  return guardians.map((g) => g.studentId);
}

private async getTeacherCourseIds(teacherId: string, institutionId: string): Promise<string[]> {
  const courseSubjects = await this.prisma.courseSubject.findMany({
    where: { teacherId, course: { institutionId } },
    select: { courseId: true },
  });
  return [...new Set(courseSubjects.map((cs) => cs.courseId))];
}
```

Reference: `backend/src/modules/grades/grades.service.ts:345-351`

### 8.3 Filtering Discipline

Never construct queries with optional filters that could result in unintended data exposure:

```typescript
// ✅ CORRECT: Always apply base tenant filter
const students = await this.prisma.student.findMany({
  where: { institutionId }, // Base filter always present
  ...(query.search && { firstName: { contains: query.search } }),
});

// ❌ WRONG: Base filter might be omitted
const students = await this.prisma.student.findMany({
  where: query.institutionId ? { institutionId: query.institutionId } : {}, // Unsafe!
});
```

---

## 9. Relation Loading Rules

### 9.1 Selective Relation Loading

Use `select` inside `include` to fetch only required fields — avoid over-fetching:

```typescript
// ✅ CORRECT: Selective relation loading
private gradeIncludes() {
  return {
    student: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
    period: { select: { id: true, name: true, type: true } },
    courseSubject: {
      select: {
        id: true,
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    },
  };
}
```

Reference: `backend/src/modules/grades/grades.service.ts:353-365`

### 9.2 Avoid Excessive Nested Includes

Limit nested relation depth to 2 levels. Deeper nesting creates N+1 query risks:

```typescript
// ✅ ACCEPTABLE: 2-level nesting
return this.prisma.grade.findMany({
  include: {
    student: true,
    courseSubject: {
      include: { subject: true, teacher: true },
    },
  },
});

// ❌ WRONG: 3+ level nesting (use select instead)
return this.prisma.grade.findMany({
  include: {
    courseSubject: {
      include: {
        subject: { include: { indicators: true } }, // Too deep!
      },
    },
  },
});
```

### 9.3 N+1 Prevention

When querying multiple entities that share a relation, use `select` to avoid N+1:

```typescript
// ✅ CORRECT: Select specific fields, avoiding unnecessary includes
const grades = await this.prisma.grade.findMany({
  where: { studentId, periodId },
  select: {
    score: true,
    type: true,
    courseSubject: { select: { subject: { select: { name: true } } } },
  },
});

// ❌ WRONG: Full include causes N+1 queries
const grades = await this.prisma.grade.findMany({
  where: { studentId, periodId },
  include: { courseSubject: { include: { subject: true } } },
});
```

Reference: `backend/src/modules/grades/grades.service.ts:309-311`

### 9.4 Relation Path Tenant Safety

When using nested `where` in includes, always include tenant filtering:

```typescript
// ✅ CORRECT: Tenant filter in nested where
const grade = await this.prisma.grade.findUnique({
  where: { id },
  include: {
    courseSubject: {
      include: {
        subject: true,
        teacher: { select: { id: true, firstName: true, lastName: true } },
        course: { select: { id: true, name: true, grade: true, division: true } },
      },
    },
  },
});
```

---

## 10. Pagination Rules

### 10.1 Pagination-First APIs

All list endpoints must support pagination. Default `take` is 20, maximum is 100.

```typescript
// ✅ CORRECT: Pagination with explicit take
async findAll(institutionId: string, query: StudentQueryDto) {
  return this.prisma.student.findMany({
    where: { institutionId, deletedAt: null },
    take: query.limit || 20,
    skip: query.page ? (query.page - 1) * (query.limit || 20) : 0,
    orderBy: { createdAt: 'desc' },
  });
}
```

### 10.2 Always Apply take Limit

Never expose unbounded `findMany` to API endpoints:

```typescript
// ✅ CORRECT: Explicit take limit
const students = await this.prisma.student.findMany({
  where: { institutionId },
  take: 20,
});

// ❌ WRONG: Unbounded query — memory exhaustion risk
const students = await this.prisma.student.findMany({
  where: { institutionId },
  // No take — returns ALL students!
});
```

Reference: `backend/src/modules/students/students.service.ts:55` — `take: 20`

### 10.3 Cursor vs Offset Pagination

**Offset pagination** (page/skip) is suitable for:

- User-facing list views with page numbers
- Where users need to jump to specific pages

**Cursor pagination** (cursor/until) is suitable for:

- Infinite scroll / load-more patterns
- Large datasets where offset becomes slow

```typescript
// Offset pagination (standard)
findMany({
  where: { institutionId },
  take: 20,
  skip: (page - 1) * 20,
});

// Cursor pagination (for large datasets)
findMany({
  where: { institutionId, createdAt: { lt: cursor } },
  take: 20,
  orderBy: { createdAt: 'desc' },
});
```

### 10.4 Payload-Size Discipline

Enforce maximum payload sizes. Return 404 if `skip` exceeds dataset:

```typescript
// ✅ CORRECT: Validate pagination bounds
async findAll(institutionId: string, query: PaginationQueryDto) {
  const limit = Math.min(query.limit || 20, 100); // Cap at 100
  const skip = Math.max(query.page - 1, 0) * limit;

  const [data, total] = await Promise.all([
    this.prisma.student.findMany({
      where: { institutionId },
      take: limit,
      skip,
    }),
    this.prisma.student.count({ where: { institutionId } }),
  ]);

  return { data, total, page: query.page || 1, limit };
}
```

---

## 11. Transaction Rules

### 11.1 Transaction Boundaries

Use `$transaction` for operations that write to multiple models atomically:

```typescript
// ✅ CORRECT: Transaction for multi-model writes
return this.prisma.$transaction(async (tx) => {
  const institution = await tx.institution.create({
    data: { name: dto.name, domain: dto.domain, ... },
  });

  const admin = await tx.user.create({
    data: {
      institutionId: institution.id,
      email: dto.adminEmail,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  return { institution, admin };
});
```

Reference: `backend/src/modules/institutions/institutions.service.ts:31-66`

### 11.2 When to Use Transactions

**Use transactions for:**

- Creating parent + child records (Institution + Admin user)
- Bulk updates that must succeed or fail together
- Operations with unique constraint dependencies

**Do NOT use transactions for:**

- Read-only operations (use `Promise.all` for parallel reads)
- Operations with external API calls (network inside transactions is unsafe)
- Long-running operations (transactions lock rows)

### 11.3 Retry-Safe Transactions

Transactions must be idempotent. Use upsert patterns within transactions:

```typescript
// ✅ CORRECT: Upsert inside transaction
return this.prisma.$transaction(async (tx) => {
  // Create or update — idempotent
  const grade = await tx.grade.upsert({
    where: {
      studentId_courseSubjectId_periodId_type_date: {
        studentId, courseSubjectId, periodId, type, date,
      },
    },
    create: { studentId, courseSubjectId, periodId, type, date, score },
    update: { score },
  });

  return grade;
});
```

### 11.4 Never Call External APIs Inside Transactions

```typescript
// ❌ WRONG: Network call inside transaction
return this.prisma.$transaction(async (tx) => {
  const grade = await tx.grade.create({ data });
  await this.externalApi.notify(grade.id); // Never do this inside transaction!
  return grade;
});

// ✅ CORRECT: External call AFTER transaction
const grade = await this.prisma.$transaction(async (tx) => {
  return tx.grade.create({ data });
});
await this.externalApi.notify(grade.id); // After transaction
```

### 11.5 Transaction Isolation Awareness

Prisma transactions use PostgreSQL's default isolation level (Read Committed). Do not assume serializable isolation.

---

## 12. Soft Delete Rules

### 12.1 Middleware Behavior

The PrismaService middleware automatically injects `deletedAt: null` for soft-delete models:

```typescript
// backend/src/prisma/prisma.service.ts:62-82
const modelsWithSoftDelete = ['User', 'Student', 'Announcement', 'Institution'];

if (
  params.model &&
  modelsWithSoftDelete.includes(params.model) &&
  (params.action === 'findMany' || params.action === 'findFirst')
) {
  params.args.where = { ...params.args.where, deletedAt: null };
}
```

**Affected models:** `User`, `Student`, `Announcement`, `Institution`

### 12.2 Query Filtering Expectations

Services must **not** manually add `deletedAt: null` — the middleware handles it:

```typescript
// ✅ CORRECT: Middleware handles filtering
const students = await this.prisma.student.findMany({
  where: { institutionId }, // deletedAt: null injected automatically
});

// ❌ WRONG: Redundant filter
const students = await this.prisma.student.findMany({
  where: { institutionId, deletedAt: null }, // Don't duplicate
});
```

### 12.3 Soft Delete Operations

**Soft delete** (set `deletedAt`):

```typescript
await this.prisma.student.update({
  where: { id },
  data: { deletedAt: new Date(), isActive: false },
});
```

Reference: `backend/src/modules/students/students.service.ts:102`

**Hard delete** (permanent removal):

```typescript
await this.prisma.grade.delete({ where: { id } }); // Only for non-soft-delete models
```

### 12.4 Restoration Workflow

To restore a soft-deleted record:

```typescript
await this.prisma.student.update({
  where: { id },
  data: { deletedAt: null, isActive: true },
});
```

### 12.5 Raw SQL Bypass

Raw SQL (`$queryRaw`) bypasses the soft-delete middleware. Use with caution:

```typescript
// Bypasses middleware — use only when necessary
const allStudents = await this.prisma.$queryRaw`
  SELECT id, first_name FROM students WHERE institution_id = ${institutionId}
`;
```

---

## 13. Migration Rules

### 13.1 Migration Safety Expectations

All schema changes must go through Prisma migrations:

```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

### 13.2 Backward Compatibility

Migrations must be backward-compatible:

- Add nullable columns without defaults (except where safe)
- Add new tables without breaking existing queries
- Never remove columns without deprecation period
- Never rename fields without migration path

### 13.3 Migration Review

Before applying migrations:

- Review schema changes in `prisma/migrations/`
- Test against production-like data volume
- Verify unique constraints work correctly
- Check for cascading side effects

### 13.4 Large Risky Migrations

For large schema changes:

1. Break into smaller, incremental migrations
2. Test migration duration on representative data
3. Plan rollback strategy
4. Schedule during low-traffic windows

---

## 14. Schema Design Rules

### 14.1 Naming Consistency

Follow Prisma naming conventions:

| Element | Convention | Example |
|---------|-----------|---------|
| Model | PascalCase, singular | `Student` |
| Field | camelCase | `firstName` |
| Enum value | SCREAMING_SNAKE_CASE | `ACTIVE` |
| Map name | snake_case | `@map("first_name")` |
| Index | Auto-generated | — |

### 14.2 Relation Design

Use explicit relations with `@relation`:

```prisma
model CourseSubject {
  id          String  @id @default(uuid())
  courseId    String  @map("course_id")
  subjectId   String  @map("subject_id")
  teacherId   String? @map("teacher_id")

  course    Course    @relation(fields: [courseId], references: [id])
  subject   Subject   @relation(fields: [subjectId], references: [id])
  teacher   User?     @relation(fields: [teacherId], references: [id])
}
```

### 14.3 Tenant-Aware Schema

Every tenant-scoped table includes `institutionId`:

```prisma
model Student {
  id            String   @id @default(uuid())
  institutionId String   @map("institution_id")
  firstName     String   @map("first_name")
  documentNumber String  @map("document_number")

  institution Institution @relation(fields: [institutionId], references: [id])

  @@unique([institutionId, documentNumber])
}
```

### 14.4 Audit-Aware Schema

For models requiring audit, include timestamps:

```prisma
model Grade {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  // ...
}
```

---

## 15. Indexing & Performance Rules

### 15.1 Critical Indexes

PostgreSQL automatically creates indexes for foreign keys and unique constraints. Additional indexes for:

- **Filtered fields:** `where` clauses on non-FK columns
- **Sorted fields:** `orderBy` on frequently sorted columns
- **Composite queries:** Multi-column `where` combinations

```prisma
model AuditLog {
  // ...
  @@index([institutionId, createdAt])
  @@index([userId])
  @@index([resource, resourceId])
}
```

### 15.2 Query-Plan Awareness

Understand query plans for slow queries:

```sql
EXPLAIN ANALYZE SELECT * FROM grades
WHERE student_id = 'uuid' AND period_id = 'uuid';
```

### 15.3 Avoid Missing Indexes

Common missing index patterns:

```typescript
// ❌ WRONG: No index on filtered non-FK column
where: { status: 'ACTIVE' } // No index on status

// ✅ CORRECT: Add index in schema
model Attendance {
  status String @map("status")
  @@index([status])
}
```

### 15.4 Performance-Sensitive Queries

For high-volume queries:

- Use `select` to limit returned fields
- Apply `take` limits
- Prefer indexed columns in `where` clauses
- Avoid `OR` conditions on unindexed columns

---

## 16. Async Consistency Rules

### 16.1 Queue-Driven Async

After successful mutations, dispatch jobs to BullMQ for async side effects:

```typescript
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
  this.gradeQueue.add(
    JOBS.RECALCULATE_AVERAGE,
    { studentId: dto.studentId, periodId: dto.periodId },
    JOB_OPTIONS.DEFAULT,
  ),
]);
```

Reference: `backend/src/modules/grades/grades.service.ts:225-241`

### 16.2 Retry-Safe Persistence

Async workers must use idempotent patterns:

```typescript
// ✅ CORRECT: Idempotent persistence
@Process(JOBS.GRADE_CREATED)
async handleGradeCreated(job: Job<GradeCreatedPayload>) {
  const { gradeId } = job.data;

  // Check if already processed
  const existing = await this.prisma.notification.findFirst({
    where: { userId: { in: guardians }, type: 'GRADE' },
  });
  if (existing) return; // Already exists — skip

  // Process
  await this.prisma.notification.create({ ... });
}
```

### 16.3 Eventual Consistency Expectations

Async workflows have eventual consistency:

- **Notification delivery:** May take 1-30 seconds
- **Audit logs:** May appear 1-10 seconds after mutation
- **Grade recalculation:** May update averages 1-60 seconds later

---

## 17. Queue & Worker Database Rules

### 17.1 Worker-Safe Queries

Workers use the same PrismaService. Queries must include tenant filtering:

```typescript
@Processor(QUEUES.NOTIFICATIONS)
export class NotificationProcessor {
  async handleGradeCreated(job: Job<GradeCreatedPayload>) {
    const { gradeId, institutionId } = job.data;

    // Always include institutionId for tenant isolation
    const grade = await this.prisma.grade.findUnique({
      where: { id: gradeId },
      include: { student: true },
    });

    // Query within tenant context
    const guardians = await this.prisma.guardian.findMany({
      where: { student: { institutionId } }, // Tenant filter!
    });
  }
}
```

### 17.2 Lightweight Async Payloads

Queue job payloads must be lightweight — include IDs, not full objects:

```typescript
// ✅ CORRECT: Lightweight payload
await this.notificationQueue.add(
  JOBS.GRADE_CREATED,
  { gradeId: grade.id, studentId: dto.studentId, institutionId },
);

// ❌ WRONG: Heavy payload — don't serialize full objects
await this.notificationQueue.add(
  JOBS.GRADE_CREATED,
  { grade: fullGradeObject, student: fullStudentObject }, // Never!
);
```

### 17.3 Idempotent Persistence

Workers must check for existing records before creating:

```typescript
// ✅ CORRECT: Check before create
const existing = await this.prisma.notification.findFirst({
  where: { userId, type: 'GRADE', data: { gradeId } as any },
});
if (existing) return;

// ❌ WRONG: Blind create — duplicate on retry
await this.prisma.notification.create({ data: { ... } }); // May duplicate on retry!
```

---

## 18. Security Rules

### 18.1 Tenant Isolation Guarantees

Every query must enforce tenant boundaries:

```typescript
// ✅ CORRECT: Explicit tenant boundary
async findOne(id: string, institutionId: string) {
  return this.prisma.student.findFirst({
    where: { id, institutionId },
  });
}

// ❌ WRONG: Missing tenant boundary
async findOne(id: string) {
  return this.prisma.student.findUnique({
    where: { id }, // No institutionId!
  });
}
```

### 18.2 Safe Raw SQL

Never use raw SQL with user input — use parameterized queries:

```typescript
// ✅ CORRECT: Parameterized query
const result = await this.prisma.$queryRaw`
  SELECT * FROM students WHERE institution_id = ${institutionId}
`;

// ❌ WRONG: String concatenation — SQL injection risk
const result = await this.prisma.$queryRaw`
  SELECT * FROM students WHERE institution_id = '${institutionId}'
`;
```

### 18.3 Defensive Query Design

Assume all user input is potentially malicious:

```typescript
// ✅ CORRECT: Validate and sanitize
const limit = Math.min(query.limit || 20, 100); // Cap at 100
const skip = Math.max(query.page - 1, 0) * limit;

// ✅ CORRECT: Type coercion via Prisma
const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
```

### 18.4 Sensitive Data Protection

Never log or return sensitive data (passwords, tokens):

```typescript
// ✅ CORRECT: Exclude sensitive fields
return this.prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, role: true }, // Excludes passwordHash
});

// ❌ WRONG: Return sensitive data
return this.prisma.user.findUnique({
  where: { id },
  include: { refreshTokens: true }, // Exposes token hashes!
});
```

---

## 19. Error Handling Rules

### 19.1 Prisma Error Normalization

Translate Prisma errors to domain exceptions:

```typescript
try {
  await this.prisma.student.create({ data });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      throw new ConflictException('El estudiante con este documento ya existe');
    }
    if (err.code === 'P2025') {
      throw new NotFoundException('Estudiante no encontrado');
    }
  }
  this.logger.error('Error creating student', err);
  throw err;
}
```

### 19.2 Predictable Failures

Define expected failure modes:

| Prisma Error | HTTP Status | Domain Message |
|--------------|-------------|----------------|
| P2002 (unique) | 409 Conflict | "Ya existe un registro con..." |
| P2025 (not found) | 404 Not Found | "Registro no encontrado" |
| P2003 (FK violation) | 400 Bad Request | "Referencia inválida" |

### 19.3 Never Swallow Errors

```typescript
// ❌ WRONG: Swallowed error
catch (err) {
  // Silently ignored
}

// ✅ CORRECT: Log and transform
catch (err) {
  this.logger.error('Failed to create grade', err);
  throw new InternalServerErrorException('Error al guardar la nota');
}
```

---

## 20. Logging & Observability Rules

### 20.1 Slow-Query Visibility

PrismaService logs queries > 500ms in development:

```typescript
// backend/src/prisma/prisma.service.ts:47-55
if (process.env.NODE_ENV === 'development') {
  this.$on('query', (e: { query: string; duration: number }) => {
    if (e.duration > 500) {
      this.logger.warn(`Query lenta (${e.duration}ms): ${e.query.slice(0, 120)}...`);
    }
  });
}
```

### 20.2 Structured Query Logging

Use NestJS Logger for structured logging:

```typescript
this.logger.log(`Grade created: ${grade.id}`, 'GradesService');
this.logger.error('Failed to notify guardians', err);
```

### 20.3 Tenant-Aware Diagnostics

Include tenant context in logs:

```typescript
this.logger.log(
  `Grade upserted: ${grade.id} for student ${dto.studentId} in institution ${institutionId}`,
);
```

### 20.4 Never Log Sensitive Data

```typescript
// ❌ WRONG: Log sensitive data
this.logger.log(`User login: ${email}, token: ${token}`);

// ✅ CORRECT: Log without sensitive data
this.logger.log(`User login attempt: ${email}`);
```

---

## 21. TypeScript & Prisma Typing Rules

### 21.1 Strict Typing Expectations

All Prisma queries must use explicit types:

```typescript
// ✅ CORRECT: Explicit return type
async findAll(institutionId: string): Promise<Student[]> {
  return this.prisma.student.findMany({
    where: { institutionId },
    select: { id: true, firstName: true, lastName: true },
  });
}

// ❌ WRONG: Implicit any
async findAll(institutionId: string) {
  return this.prisma.student.findMany({ where: { institutionId } });
}
```

### 21.2 Prisma-Generated Types

Use Prisma-generated types for DTOs and domain objects:

```typescript
import { Grade, Student, User } from '@prisma/client';

// ✅ CORRECT: Use generated types
async findOne(id: string): Promise<Grade | null> {
  return this.prisma.grade.findUnique({ where: { id } });
}
```

### 21.3 Avoid Unsafe Casting

```typescript
// ❌ WRONG: Unsafe any cast
const grade = await this.prisma.grade.upsert({
  where: { ... },
  create: { ... } as any, // Unsafe!
  update: { ... },
});

// ✅ CORRECT: Proper typing
const grade = await this.prisma.grade.upsert({
  where: { ... },
  create: { ... }, // Prisma validates types
  update: { ... },
});
```

### 21.4 Explicit Return Types

Always define return types for service methods:

```typescript
async findAll(institutionId: string, user: RequestUser, query: GradeQueryDto): Promise<Grade[]> {
  // Implementation
}
```

---

## 22. Scalability Considerations

### 22.1 Horizontal Scalability Awareness

The backend supports horizontal scaling via Docker:

```bash
docker compose up --scale api=3 --scale worker=2
```

PrismaService is stateless — safe for horizontal scaling.

### 22.2 Query Scalability

Design queries for scale:

- Always apply `take` limits
- Use cursor pagination for large datasets
- Index frequently filtered columns
- Avoid `ORDER BY random()` on large tables

### 22.3 Relation Scalability

Limit relation depth and size:

```typescript
// ✅ CORRECT: Shallow relation
const grades = await this.prisma.grade.findMany({
  where: { studentId },
  select: { id: true, score: true },
});

// ❌ WRONG: Deep relations on large datasets
const grades = await this.prisma.grade.findMany({
  where: { institutionId },
  include: { student: true, courseSubject: { include: { subject: true } } }, // Too deep!
});
```

### 22.4 Payload-Size Discipline

Enforce maximum API response sizes:

```typescript
// ✅ CORRECT: Payload size limit
const limit = Math.min(query.limit || 20, 100);
```

---

## 23. Maintainability Standards

### 23.1 Readable Query Construction

Prefer explicit queries over complex builders:

```typescript
// ✅ CORRECT: Explicit and readable
const where: any = { institutionId };
if (query.status) where.status = query.status;
if (query.search) {
  where.OR = [
    { firstName: { contains: query.search } },
    { lastName: { contains: query.search } },
  ];
}
return this.prisma.student.findMany({ where });
```

### 23.2 Reusable Patterns

Extract common logic into private methods:

```typescript
private gradeIncludes() {
  return {
    student: { select: { id: true, firstName: true, lastName: true } },
    courseSubject: { select: { id: true, subject: true } },
  };
}

// Reuse across methods
async findAll(...) { return this.prisma.grade.findMany({ include: this.gradeIncludes() }); }
async findOne(...) { return this.prisma.grade.findUnique({ include: this.gradeIncludes() }); }
```

Reference: `backend/src/modules/grades/grades.service.ts:353-365`

### 23.3 Operational Simplicity

Prefer simple, predictable patterns:

- Standard Prisma queries over raw SQL
- Explicit filters over dynamic query builders
- Synchronous transaction patterns over complex async orchestration

---

## 24. Preferred Patterns

### 24.1 Tenant-Safe Queries

```typescript
// Always include institutionId
await this.prisma.model.findMany({ where: { institutionId } });
```

### 24.2 Pagination-First

```typescript
// Always apply take limit
await this.prisma.model.findMany({ where: { institutionId }, take: 20 });
```

### 24.3 Selective Include

```typescript
// Use select inside include for specific fields
await this.prisma.grade.findMany({
  include: {
    student: { select: { id: true, firstName: true, lastName: true } },
  },
});
```

### 24.4 Upsert for Idempotent Operations

```typescript
// Upsert for grades, attendance — prevents duplicates on retry
await this.prisma.grade.upsert({
  where: { uniqueConstraint },
  create: { ... },
  update: { ... },
});
```

### 24.5 Async After Transaction

```typescript
// Queue dispatch AFTER successful transaction
const result = await this.prisma.$transaction(async (tx) => {
  return tx.grade.create({ data });
});
await this.queue.add(JOB, { ... }); // After commit
```

### 24.6 Typed Return Values

```typescript
async findAll(institutionId: string): Promise<Student[]> { ... }
```

---

## 25. Forbidden Patterns

### 25.1 Unscoped Queries

```typescript
// ❌ NEVER: Missing institutionId
await this.prisma.student.findMany();
```

### 25.2 Unsafe Raw SQL

```typescript
// ❌ NEVER: String concatenation in raw SQL
await this.prisma.$queryRaw`SELECT * FROM students WHERE name = '${input}'`;
```

### 25.3 Giant Nested Includes

```typescript
// ❌ NEVER: 3+ level deep includes
await this.prisma.grade.findMany({
  include: {
    courseSubject: {
      include: { subject: { include: { indicators: true } } },
    },
  },
});
```

### 25.4 Unbounded findMany

```typescript
// ❌ NEVER: No take limit on API endpoints
await this.prisma.student.findMany({ where: { institutionId } });
```

### 25.5 Transactions with Network Calls

```typescript
// ❌ NEVER: External API inside transaction
await this.prisma.$transaction(async (tx) => {
  await this.externalApi.call(); // Never!
});
```

### 25.6 Cross-Tenant Access

```typescript
// ❌ NEVER: Query without tenant filter
await this.prisma.grade.findMany({ where: { id: gradeId } }); // Missing institutionId!
```

### 25.7 Duplicated Query Logic

```typescript
// ❌ NEVER: Duplicate filtering logic in multiple services
// Each service should own its queries
```

### 25.8 Retry-Unsafe Persistence

```typescript
// ❌ NEVER: Non-idempotent worker writes
await this.prisma.notification.create({ ... }); // May duplicate on retry!
```

### 25.9 Weak Typing

```typescript
// ❌ NEVER: any types
const result: any = await this.prisma.$queryRaw`...`;
```

---

## 26. Good Examples

### 26.1 Tenant-Safe Query with Pagination

```typescript
// backend/src/modules/students/students.service.ts:20,55
async findAll(institutionId: string, query: StudentQueryDto) {
  return this.prisma.student.findMany({
    where: { institutionId, deletedAt: null },
    take: query.limit || 20,
    skip: query.page ? (query.page - 1) * (query.limit || 20) : 0,
    orderBy: { createdAt: 'desc' },
  });
}
```

### 26.2 Selective Include with Role Filtering

```typescript
// backend/src/modules/grades/grades.service.ts:68-74
if (user.role === 'GUARDIAN') {
  const childrenIds = await this.getGuardianChildrenIds(user.id, institutionId);
  where.studentId = { in: childrenIds };

  return this.prisma.grade.findMany({
    where,
    include: this.gradeIncludes(),
    orderBy: { date: 'desc' },
  });
}
```

### 26.3 Upsert for Idempotent Write

```typescript
// backend/src/modules/grades/grades.service.ts:199-223
const grade = await this.prisma.grade.upsert({
  where: {
    studentId_courseSubjectId_periodId_type_date: {
      studentId, courseSubjectId, periodId, type, date: new Date(dto.date),
    },
  },
  create: { studentId, courseSubjectId, periodId, score, type, description, date },
  update: { score, description },
  include: this.gradeIncludes(),
});
```

### 26.4 Transaction for Multi-Model Write

```typescript
// backend/src/modules/institutions/institutions.service.ts:31-66
return this.prisma.$transaction(async (tx) => {
  const institution = await tx.institution.create({
    data: { name: dto.name, domain: dto.domain, status: 'TRIAL', plan: 'FREE' },
  });

  const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
  const admin = await tx.user.create({
    data: { institutionId: institution.id, email: dto.adminEmail, passwordHash, role: 'ADMIN' },
  });

  return { institution, admin };
});
```

### 26.5 Async Queue Dispatch After Write

```typescript
// backend/src/modules/grades/grades.service.ts:225-241
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
```

### 26.6 Soft-Delete Aware Query

```typescript
// backend/src/modules/students/students.service.ts:20
// Middleware automatically adds deletedAt: null
const students = await this.prisma.student.findMany({
  where: { institutionId, deletedAt: null }, // Middleware handles this!
});
```

---

## 27. Bad Examples

### 27.1 Missing Tenant Filter

```typescript
// ❌ WRONG: Cross-tenant leak risk
async findAll() {
  return this.prisma.grade.findMany({}); // No institutionId!
}

// ✅ CORRECT
async findAll(institutionId: string) {
  return this.prisma.grade.findMany({ where: { course: { institutionId } } });
}
```

### 27.2 Unbounded Query

```typescript
// ❌ WRONG: Returns ALL records — memory exhaustion
async findAll(institutionId: string) {
  return this.prisma.student.findMany({ where: { institutionId } });
}

// ✅ CORRECT
async findAll(institutionId: string, query: QueryDto) {
  return this.prisma.student.findMany({
    where: { institutionId },
    take: Math.min(query.limit || 20, 100),
  });
}
```

### 27.3 Excessive Nested Include

```typescript
// ❌ WRONG: 3+ levels causes N+1 explosion
const grades = await this.prisma.grade.findMany({
  include: {
    courseSubject: {
      include: {
        subject: { include: { indicators: true } },
        course: { include: { schoolYear: true } },
      },
    },
  },
});

// ✅ CORRECT: Limit to 2 levels, use select
const grades = await this.prisma.grade.findMany({
  select: {
    id: true, score: true,
    courseSubject: {
      select: {
        subject: { select: { id: true, name: true } },
      },
    },
  },
});
```

### 27.4 Network Call Inside Transaction

```typescript
// ❌ WRONG: Network inside transaction — blocks transaction
await this.prisma.$transaction(async (tx) => {
  const grade = await tx.grade.create({ data });
  await this.fcmService.send(grade.id); // Blocks transaction!
});

// ✅ CORRECT: Network AFTER transaction
const grade = await this.prisma.$transaction(async (tx) => {
  return tx.grade.create({ data });
});
await this.fcmService.send(grade.id);
```

### 27.5 Non-Idempotent Worker Write

```typescript
// ❌ WRONG: Creates duplicate on retry
@Process(JOBS.NOTIFICATION)
async handleNotification(job: Job) {
  await this.prisma.notification.create({ data: { ... } }); // May duplicate!
}

// ✅ CORRECT: Check before create
@Process(JOBS.NOTIFICATION)
async handleNotification(job: Job) {
  const existing = await this.prisma.notification.findFirst({ where: { ... } });
  if (existing) return;
  await this.prisma.notification.create({ data: { ... } });
}
```

### 27.6 Weak Typing

```typescript
// ❌ WRONG: Using any
const result: any = await this.prisma.$queryRaw`SELECT * FROM grades`;

// ✅ CORRECT: Explicit typing
const result = await this.prisma.$queryRaw<Grade[]>`SELECT * FROM grades`;
```

---

## 28. Review Heuristics

### 28.1 Tenant Safety Checks

- [ ] All queries on tenant-scoped models include `institutionId` in `where`
- [ ] Relation paths include tenant filtering (e.g., `course: { institutionId }`)
- [ ] SUPER_ADMIN queries handle `institutionId: null` correctly
- [ ] No queries trust client-provided `institutionId`

### 28.2 Query Performance Checks

- [ ] All `findMany` calls have explicit `take` limits (max 100)
- [ ] No unbounded queries on API endpoints
- [ ] Relations loaded with `select` for specific fields
- [ ] No 3+ level nested includes

### 28.3 Transaction Safety Checks

- [ ] No network calls inside `$transaction`
- [ ] Transactions are used for multi-model writes
- [ ] Transactions include retry-safe patterns (upsert)

### 28.4 Soft-Delete Checks

- [ ] No manual `deletedAt: null` in queries (middleware handles it)
- [ ] Soft-delete models use `update` with `deletedAt` instead of `delete`
- [ ] Raw SQL queries are aware of soft-delete bypass

### 28.5 Async Consistency Checks

- [ ] Queue jobs dispatched AFTER successful transactions
- [ ] Job payloads include `institutionId` for tenant isolation
- [ ] Worker writes are idempotent (check before create)

### 28.6 Type Safety Checks

- [ ] All service methods have explicit return types
- [ ] No `any` types in Prisma queries
- [ ] DTOs use Zod for validation, not class-validator

---

## 29. Refactoring Guidelines

### 29.1 Safe Schema Evolution

When modifying schema:

1. Add migration before changing code
2. Verify migration is backward-compatible
3. Test queries against new schema
4. Update service return types if needed

### 29.2 Incremental Query Refactoring

When refactoring queries:

1. Preserve existing tenant safety guarantees
2. Add tests for edge cases
3. Run lint and typecheck after changes
4. Verify no N+1 regressions

### 29.3 Preserving Tenant Isolation

When refactoring services:

- Never remove `institutionId` filters
- Never add new queries without tenant context
- Preserve role-based filtering patterns

### 29.4 Avoiding Risky Persistence Rewrites

- Never change upsert to create+update separately (loses idempotency)
- Never remove transactions without analysis
- Never add network calls to existing transactions

---

## 30. Development Workflow Expectations

### 30.1 Pre-Coding Analysis

Before writing database code:

1. Read relevant documentation (`docs/DATABASE.md`, `docs/MULTITENANCY.md`)
2. Find similar patterns in existing services
3. Verify tenant isolation requirements
4. Check pagination and soft-delete requirements

### 30.2 Pattern Preservation

Maintain consistency with existing codebase:

- Use `include` + `select` patterns from `grades.service.ts`
- Use transaction patterns from `institutions.service.ts`
- Use role-based filtering from `attendance.service.ts`
- Use queue dispatch patterns from `grades.service.ts`

### 30.3 Architectural Review Triggers

Request architectural review when:

- Adding new Prisma models
- Changing tenant isolation logic
- Modifying transaction boundaries
- Introducing new async workflows

### 30.4 Explaining Schema-Impacting Changes

Before implementing schema changes:

1. Document the change rationale
2. Explain migration path
3. Verify backward compatibility
4. Test with representative data

---

## 31. Validation Checklist

Before submitting a PR with database changes:

### Tenant Safety

- [ ] All tenant-scoped queries include `institutionId` filter
- [ ] No unscoped queries on User, Student, Course, Grade, Attendance, etc.
- [ ] Relation paths include tenant filtering
- [ ] SUPER_ADMIN handling is correct

### Query Performance

- [ ] All `findMany` have `take` limits (max 100)
- [ ] No unbounded queries
- [ ] Relations use `select` for specific fields
- [ ] No 3+ level nested includes

### Transactions

- [ ] Multi-model writes use transactions
- [ ] No network calls inside transactions
- [ ] Transactions use retry-safe patterns

### Soft-Delete

- [ ] No manual `deletedAt: null` (middleware handles it)
- [ ] Soft-delete models use soft-delete pattern

### Async Consistency

- [ ] Queue jobs dispatched after transactions
- [ ] Job payloads include `institutionId`
- [ ] Worker writes are idempotent

### Type Safety

- [ ] All methods have explicit return types
- [ ] No `any` in Prisma queries
- [ ] Lint passes: `npm run lint`
- [ ] Typecheck passes: `npm run typecheck`

---

## 32. Expected Quality Standards

### Code Review Standards

- All database changes require review
- Focus on tenant isolation, query performance, transaction safety
- Verify examples match codebase patterns

### Lint & Typecheck

```bash
cd backend
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
```

Both must pass before merging.

### Documentation Updates

When adding new Prisma patterns:

- Update this document with examples
- Reference in `docs/DATABASE.md` if schema changes
- Update `AGENTS.md` if behavioral rules change

### Consistency with Existing Code

New code must match existing patterns:

- Use service patterns from `grades.service.ts`, `attendance.service.ts`
- Use transaction patterns from `institutions.service.ts`
- Use pagination patterns from `students.service.ts`

---

## Appendix A: Key File References

| Pattern | File:Line |
|---------|-----------|
| Soft-delete middleware | `backend/src/prisma/prisma.service.ts:62-82` |
| Tenant filtering | `backend/src/modules/grades/grades.service.ts:24-150` |
| Role-based filtering | `backend/src/modules/attendance/attendance.service.ts:37-47` |
| Upsert pattern | `backend/src/modules/grades/grades.service.ts:199-223` |
| Transaction | `backend/src/modules/institutions/institutions.service.ts:31-66` |
| Queue dispatch | `backend/src/modules/grades/grades.service.ts:225-241` |
| Pagination | `backend/src/modules/students/students.service.ts:55` |
| Selective include | `backend/src/modules/grades/grades.service.ts:353-365` |
| Guardian filtering | `backend/src/modules/grades/grades.service.ts:345-351` |

---

## Appendix B: Prisma Error Code Reference

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| P2000 | Column value too long | 400 |
| P2001 | Record not found | 404 |
| P2002 | Unique constraint violation | 409 |
| P2003 | Foreign key constraint failed | 400 |
| P2004 | Constraint failed | 400 |
| P2005 | Invalid value for field | 400 |
| P2006 | Invalid value for type | 400 |
| P2007 | Invalid data | 400 |
| P2025 | Record to update not found | 404 |
| P2026 | Multiple records to update | 400 |

---

*Document maintained alongside EduSystem codebase. Update when Prisma patterns evolve.*