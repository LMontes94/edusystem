# EduSystem — Database AI Agent Operational Guide

> **Version:** 1.0
> **Last Updated:** 2026-05-14
> **Classification:** Internal — AI Coding Agents & Database Engineering
> **Scope:** PostgreSQL / Prisma Layer (backend database operations, schema management, query safety)
> **Parent:** `AGENTS.md` (full-stack source of truth)
> **Sibling:** `agents/backend-agent.md` (NestJS backend specialization)

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Non-Goals](#3-non-goals)
4. [Required Context](#4-required-context)
5. [Database Architectural Principles](#5-database-architectural-principles)
6. [Prisma Rules](#6-prisma-rules)
7. [Schema Design Rules](#7-schema-design-rules)
8. [Multi-Tenancy Rules](#8-multi-tenancy-rules)
9. [Soft Delete Rules](#9-soft-delete-rules)
10. [Relationship Modeling Rules](#10-relationship-modeling-rules)
11. [Query Safety Rules](#11-query-safety-rules)
12. [Transaction Rules](#12-transaction-rules)
13. [Migration Rules](#13-migration-rules)
14. [Indexing Rules](#14-indexing-rules)
15. [Authentication Data Rules](#15-authentication-data-rules)
16. [Authorization Data Rules](#16-authorization-data-rules)
17. [Audit Logging Rules](#17-audit-logging-rules)
18. [Queue & Worker Data Rules](#18-queue--worker-data-rules)
19. [Performance Rules](#19-performance-rules)
20. [Security Rules](#20-security-rules)
21. [Preferred Patterns](#21-preferred-patterns)
22. [Forbidden Patterns](#22-forbidden-patterns)
23. [Development Workflow Expectations](#23-development-workflow-expectations)
24. [Validation Checklist](#24-validation-checklist)
25. [Expected Quality Standards](#25-expected-quality-standards)

---

## 1. Purpose

This document is the authoritative behavioral guide for AI coding agents operating on the EduSystem database layer. It defines how database code must be written, which Prisma patterns are mandatory, how tenant isolation must be preserved, and which anti-patterns are strictly prohibited.

This agent is a **specialization** of `AGENTS.md` (parent) and operates parallel to `agents/backend-agent.md` (sibling). Where this document conflicts with `AGENTS.md`, `AGENTS.md` takes precedence for shared concerns. This document takes precedence for **database-specific** concerns: schema design, Prisma usage, query safety, transactions, migrations, and data modeling.

Every database modification must preserve:

- **Tenant isolation** — every tenant-scoped query must filter by `institutionId`
- **Data consistency** — transactional boundaries must be correct, no partial writes
- **Soft delete integrity** — the middleware layer must not be bypassed
- **Query safety** — no N+1 patterns, no overfetching, no unbounded result sets
- **Prisma-only access** — no raw SQL unless explicitly justified and documented
- **Scalability standards** — indexes on all foreign keys and frequently filtered fields
- **Audit trail completeness** — all significant mutations dispatched to `AuditLog`

---

## 2. Scope

### 2.1 What This Agent Owns

This agent is responsible for the data layer within `backend/`:

```
backend/
├── prisma/
│   ├── schema.prisma          # Full database schema (42 models, 14 enums)
│   ├── migrations/            # Prisma migration history (incremental, never modified)
│   └── init.sql               # Partial unique index (SUPER_ADMIN email)
└── src/
    └── prisma/
        └── prisma.service.ts  # PrismaService + soft-delete middleware
```

### 2.2 What This Agent Does NOT Own

- Frontend code (`frontend/src/`)
- NestJS controller and service logic (delegates to `backend-agent.md`)
- Infrastructure configuration (`docker-compose.yml`, Dockerfiles)
- BullMQ queue topology (delegates to `backend-agent.md`)
- CASL authorization logic (delegates to `backend-agent.md`)
- Authentication token flow (delegates to `backend-agent.md`)

### 2.3 Stack Ownership

| Component | Technology | Ownership |
|-----------|-----------|-----------|
| Database | PostgreSQL 16 | Schema design, migrations, indexing |
| ORM | Prisma 5 | Service-layer access, middleware, transactions |
| Connection | PrismaClient | Managed by `PrismaService` |
| Queue Broker | Redis 7 | Config only (queues managed by `backend-agent.md`) |

### 2.4 Schema Overview

```
42 models | 14 enums | 26 tenant-scoped | 4 soft-delete | 12 unique constraints | 29 junction tables
```

| Category | Count | Examples |
|----------|-------|---------|
| Tenant-scoped (with `institutionId`) | 26 | User, Student, Course, Grade, Attendance, Announcement |
| Cross-tenant (no `institutionId`) | 6 | RefreshToken, PushToken, UserLevelRole, Permission, Notification, AuditLog* |
| Soft-delete enabled | 4 | Institution, User, Student, Announcement |
| With composite unique constraints | 12 | Grade, Attendance, CourseStudent, Guardian |
| Junction tables | 14 | CourseStudent, CourseSubject, Guardian, ChatRoomMember |

*`AuditLog` has `institutionId` but is cross-user (records actions by any user across any institution).

---

## 3. Non-Goals

This agent MUST NOT:

- Write raw SQL without documented justification and approval
- Modify existing Prisma migrations (create new ones only)
- Bypass the `PrismaService` middleware layer for soft-delete filtering
- Create unscoped Prisma queries on tenant-scoped models
- Introduce new soft-delete models without architectural review
- Add nullable columns with no default in migrations (breaks existing rows)
- Remove columns from the schema without a deprecation period
- Create tables outside Prisma migrations (all schema changes via `prisma migrate`)
- Use `ORDER BY random()` on production tables
- Use `prisma.model.delete()` on soft-delete models without explicit justification
- Modify the Prisma schema without running `prisma generate` afterward

---

## 4. Required Context

### 4.1 Read Before Any Database Change

Every database or Prisma schema modification requires reading the relevant documentation **before** writing code. Do not proceed without reading the applicable documents.

| Document | When to Read |
|----------|-------------|
| `docs/DATABASE.md` | Prisma schema, migrations, soft delete, indexes, naming conventions |
| `docs/MULTITENANCY.md` | `institutionId` propagation, TenantMiddleware, tenant-safe relations |
| `docs/ARCHITECTURE.md` | High-level system design, deployment topology |
| `docs/AUTH.md` | RefreshToken storage, password hashing, JWT claims |
| `docs/WORKERS.md` | BullMQ async persistence, idempotency, queue payloads |
| `docs/INFRASTRUCTURE.md` | PostgreSQL config, connection pooling, backup strategy |
| `AGENTS.md` | Any change touching shared concerns (frontend, infra, PR workflow) |

### 4.2 Schema Reference

Before modifying the schema, read the full `backend/prisma/schema.prisma` and understand:

- Which models are tenant-scoped (26 models with `institutionId`)
- Which models are soft-delete enabled (4 models: Institution, User, Student, Announcement)
- Which models are cross-tenant (6 models without `institutionId`)
- All composite unique constraints and their rationale
- All foreign key relationships and cascade behavior

### 4.3 PrismaService Reference

The `PrismaService` in `src/prisma/prisma.service.ts` is the **sole** Prisma access point. It provides:

1. **Soft-delete middleware** — automatically injects `deletedAt: null` for `findMany`/`findFirst` on 4 models
2. **Slow-query logging** — logs queries exceeding 500ms in development
3. **Transaction wrapper** — `runTransaction<T>()` for atomic multi-step operations
4. **Lifecycle management** — `onModuleInit` / `onModuleDestroy` for clean connect/disconnect

**Never bypass `PrismaService`**. Do not instantiate `PrismaClient` directly in services.

### 4.4 Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `backend/prisma/schema.prisma` | ~941 | Full schema: 42 models, 14 enums, indexes, constraints |
| `backend/src/prisma/prisma.service.ts` | ~98 | PrismaService + soft-delete middleware + transaction helper |
| `backend/prisma/init.sql` | — | Partial unique index for SUPER_ADMIN email uniqueness |
| `docs/DATABASE.md` | ~1,150 | Complete database architecture documentation |

---

## 5. Database Architectural Principles

### 5.1 Core Database Tenets

1. **Multi-tenancy by convention.** Every tenant-scoped model carries `institutionId String`. Every Prisma query on a tenant-scoped model includes this field in the `where` clause. No exceptions.
2. **Prisma is the only data access layer.** Raw SQL is forbidden unless documented justification is provided and approved. Prisma's generated types provide compile-time safety that raw SQL cannot match.
3. **Soft delete is handled by middleware.** The `PrismaService` `$use` middleware automatically filters `deletedAt: null` on `findMany` and `findFirst`. Services never manually add this filter.
4. **Transactions are mandatory for multi-model writes.** Any operation that creates or updates data across multiple models must use `prisma.$transaction()`.
5. **Tenant isolation is enforced at the query level.** The application layer enforces `institutionId` scoping; the database enforces referential integrity. Both layers must be correct.
6. **Indexes on all foreign keys and frequently filtered fields.** The absence of an index on `institutionId` is a production-grade performance defect.
7. **Schema migrations are incremental and backward-compatible.** Never modify existing migration files. Never break existing reads. Never introduce breaking changes without a migration plan.
8. **Explicit field selection over overfetching.** Use `select` to return only needed fields. Avoid `include` for nested relations unless the relation data is actually needed.

### 5.2 PrismaService Architecture

```
PrismaClient (generated)
    └── PrismaService (custom)
          ├── onModuleInit: $connect + slow-query logging + soft-delete middleware
          ├── onModuleDestroy: $disconnect
          ├── runTransaction<T>: typed $transaction wrapper
          └── Soft-delete $use middleware
                └── Models: Institution, User, Student, Announcement
                └── Actions: findMany, findFirst → injects { deletedAt: null }
```

### 5.3 Tenant Isolation Flow

```
TenantMiddleware (NestJS)
    └── Decodes JWT → injects req.institutionId
            └── Controller → Service → PrismaService
                    └── WHERE institutionId = ? (service adds filter)
                            └── PostgreSQL (filtered by tenant)
                                    └── Response (tenant-scoped data only)
```

### 5.4 Data Consistency Guarantees

| Operation Type | Guarantee | Mechanism |
|---------------|-----------|-----------|
| Single-model write | ACID | Prisma default transaction |
| Multi-model write | ACID | `prisma.$transaction()` |
| Async audit | Eventually consistent | BullMQ + retry |
| Async notification | Eventually consistent | BullMQ + retry |
| Soft delete | Immediate | `update({ data: { deletedAt } })` |
| Hard delete | Immediate | `delete({ where })` on non-soft-delete models |

### 5.5 Role Hierarchy (Database-level awareness)

```
SUPER_ADMIN > ADMIN > DIRECTOR > SECRETARY > PRECEPTOR > TEACHER > GUARDIAN
```

Database-level implications:
- `SUPER_ADMIN` has `institutionId: null` — queries must explicitly handle this case
- `UserLevelRole` table enables per-level role overrides — effective role computed via `getHighestRole()`
- CASL permissions stored in `Permission` table with JSON conditions

---

## 6. Prisma Rules

### 6.1 Service-Level Access Only

Prisma MUST be used only inside services. Controllers never touch Prisma directly.

```typescript
// CORRECT: Prisma in service
@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(institutionId: string) {
    return this.prisma.student.findMany({
      where: { institutionId },
    });
  }
}

// WRONG: Prisma in controller
@Controller('students')
export class StudentsController {
  constructor(private readonly prisma: PrismaService) {} // NO
}
```

### 6.2 Use PrismaService, Not PrismaClient

```typescript
// CORRECT
constructor(private readonly prisma: PrismaService) {}

// WRONG
constructor(private readonly prisma: PrismaClient) {}  // Bypasses middleware
```

`PrismaService` extends `PrismaClient` and registers the soft-delete middleware. Direct `PrismaClient` instantiation bypasses this.

### 6.3 Always Include institutionId

Every query on a tenant-scoped model MUST include `institutionId` in the `where` clause:

```typescript
// CORRECT: always scoped
const students = await this.prisma.student.findMany({
  where: { institutionId, deletedAt: null },
});

// WRONG: unscoped — critical security vulnerability
const students = await this.prisma.student.findMany();
```

### 6.4 SUPER_ADMIN — Explicit Role Check

`SUPER_ADMIN` users have `institutionId: null`. Services MUST handle this explicitly:

```typescript
async findAll(institutionId: string | null, user: RequestUser) {
  if (user.role === 'SUPER_ADMIN') {
    // No institutionId filter — sees all tenants
    return this.prisma.student.findMany({ where: { deletedAt: null } });
  }
  return this.prisma.student.findMany({
    where: { institutionId, deletedAt: null },
  });
}
```

### 6.5 Use upsert for Idempotent Operations

The `Grade` model has a composite unique constraint. Use upsert to prevent duplicate entries:

```typescript
const grade = await this.prisma.grade.upsert({
  where: {
    studentId_courseSubjectId_periodId_type_date: {
      studentId, courseSubjectId, periodId, type, date,
    },
  },
  create: {
    studentId, courseSubjectId, periodId, type,
    score, date, institutionId,
  },
  update: { score, description },
});
```

**Unique constraints that use upsert:**

| Model | Constraint Fields | Notes |
|-------|------------------|-------|
| `Grade` | studentId, courseSubjectId, periodId, type, date | Upsert pattern |
| `Attendance` | studentId, courseId, date, sportGroupId | Includes nullable sportGroupId |
| `IndicatorEvaluation` | indicatorId, studentId, periodId | Upsert pattern |
| `StudentObservation` | studentId, periodId, courseId | One per course per period |
| `StudentCourseSubject` | studentId, courseSubjectId, schoolYearId | Per-year subject assignment |

### 6.6 Transactions for Multi-Model Writes

```typescript
// CORRECT: atomic write across multiple models
await this.prisma.$transaction(async (tx) => {
  const attendance = await tx.attendance.create({ data: { ... } });
  await tx.justification.create({
    data: { attendanceId: attendance.id, ... },
  });
});

// CORRECT: using PrismaService helper
await this.prisma.runTransaction(async (prisma) => {
  const course = await prisma.course.create({ data: { ... } });
  const subjects = await prisma.courseSubject.createMany({
    data: subjectIds.map((id) => ({ courseId: course.id, subjectId: id })),
  });
  return course;
});
```

### 6.7 Field Selection and Query Optimization

```typescript
// CORRECT: select only needed fields
const students = await this.prisma.student.findMany({
  where: { institutionId },
  select: { id: true, firstName: true, lastName: true, documentNumber: true },
});

// CORRECT: include relations only when needed
const course = await this.prisma.course.findUnique({
  where: { id },
  include: {
    students: { select: { id: true, firstName: true, lastName: true } },
    subjects: { include: { teacher: { select: { id: true, firstName: true } } } },
  },
});

// WRONG: overfetching
const course = await this.prisma.course.findUnique({
  where: { id },
  include: { students: true, subjects: true },  // Includes ALL fields of students/subjects
});
```

### 6.8 Soft Delete Behavior

Four models have soft delete enabled: `Institution`, `User`, `Student`, `Announcement`. The `PrismaService` middleware automatically filters `deletedAt: null` on these models for `findMany` and `findFirst`. **Do not manually add `deletedAt: null` to queries** — the middleware handles it.

To restore a soft-deleted record:

```typescript
await this.prisma.user.update({
  where: { id },
  data: { deletedAt: null },
});
```

### 6.9 Index Strategy

Always index fields used in `where` clauses:

```prisma
@@index([institutionId])
@@index([institutionId, documentNumber])
@@index([studentId, courseId, date])
```

Indexes are defined in the schema via `@@index`. Run `prisma migrate dev` to generate and apply migration.

### 6.10 Forbidden Prisma Patterns

| Forbidden Pattern | Severity | Reason |
|------------------|---------|--------|
| Prisma queries in controllers | Critical | Architecture violation |
| Queries without `institutionId` on tenant models | Critical | Cross-tenant data leak |
| Raw SQL without documented justification | High | SQL injection risk + bypasses Prisma typing |
| Using `PrismaClient` instead of `PrismaService` | High | Bypasses soft-delete middleware |
| `ORDER BY random()` on production tables | High | Full table scan |
| Missing indexes on `institutionId` + FK combinations | High | Slow tenant queries |
| Unbounded `findMany()` without `take` | Medium | Memory exhaustion |
| N+1 queries without `include` or `Promise.all()` | Medium | Database overload |
| Bypassing soft-delete middleware with `$queryRaw` | Medium | Intentional override requires documentation |

---

## 7. Schema Design Rules

### 7.1 Model Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Model name | `PascalCase`, singular | `Student`, `CourseSubject`, `AuditLog` |
| Field name | `camelCase` | `firstName`, `lastName`, `institutionId` |
| Enum value | `SCREAMING_SNAKE_CASE` | `SUPER_ADMIN`, `ACTIVE`, `INICIAL` |
| Relation field | `PascalCase` | `CourseStudent`, `SportGroupTeacher` |
| Map name | `snake_case` | `@map("institution_id")`, `@map("created_at")` |
| ID field | `@id @default(uuid())` | Always UUID v4, never auto-increment |
| Timestamps | `createdAt`, `updatedAt` | Auto-handled by `@default(now())` and `@updatedAt` |
| Soft delete | `deletedAt DateTime?` | Nullable timestamp with `@map("deleted_at")` |

### 7.2 Required Fields on Tenant-Scoped Models

Every tenant-scoped model MUST include:

```prisma
model TenantScopedModel {
  id            String   @id @default(uuid())
  institutionId String   @map("institution_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  institution Institution @relation(fields: [institutionId], references: [id])

  @@index([institutionId])
}
```

### 7.3 Soft Delete Field

For models with soft delete capability:

```prisma
model SoftDeleteModel {
  id            String    @id @default(uuid())
  deletedAt     DateTime? @map("deleted_at")  // null = active, set = deleted

  // PrismaService middleware auto-filters deletedAt: null on findMany/findFirst
}
```

### 7.4 Cross-Tenant Models (no institutionId)

Six models do not have `institutionId`. These are platform-level entities:

| Model | Purpose | Rationale |
|-------|---------|-----------|
| `RefreshToken` | JWT refresh token storage | User-owned, validated via userId |
| `PushToken` | FCM device tokens | User-owned, validated via userId |
| `UserLevelRole` | Per-level role overrides | User-owned, cross-institution by design |
| `Permission` | CASL ABAC conditions | Platform-level role definitions |
| `Notification` | In-app notification records | User-owned, userId is the scope |
| `AuditLog` | Action audit trail | Has `institutionId` but not FK; cross-user queries needed |

### 7.5 Nullable Foreign Keys

Use nullable foreign keys when the relation is optional:

```prisma
model Justification {
  reviewerId String? @map("reviewer_id")  // Nullable — reviewer may be deactivated
  reviewer   User?   @relation(fields: [reviewerId], references: [id])
}
```

### 7.6 JSON Fields

Use `Json?` for flexible metadata that does not require a dedicated model:

```prisma
model Institution {
  settings Json?  // { absenceThresholds: { PRIMARIA: 10, SECUNDARIA: 8 }, ... }
}

model AuditLog {
  before Json?  // Serialized previous state (UPDATE/DELETE)
  after  Json?  // Serialized new state (CREATE/UPDATE)
}
```

### 7.7 Enum Usage

Use PostgreSQL enums for finite sets where compile-time safety matters:

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  DIRECTOR
  SECRETARY
  PRECEPTOR
  TEACHER
  GUARDIAN
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  ON_LEAVE
}
```

**Current enum count: 14** (`Role`, `UserStatus`, `Level`, `EnrollmentStatus`, `AttendanceStatus`, `GradeType`, `AnnouncementScope`, `ChatRoomType`, `MessageType`, `NotificationType`, `Platform`, `PeriodType`, `Relationship`, `PlanType`, `InstitutionStatus`, `AuditAction`, `ReservationStatus`, `StudentSubjectType`). Adding a new enum requires a migration — plan accordingly.

### 7.8 Unique Constraints

Unique constraints are scoped by tenant wherever possible:

```prisma
@@unique([email, institutionId])           // User: same email across institutions
@@unique([institutionId, documentNumber]) // Student: DNI unique per institution
@@unique([institutionId, code])            // Subject: code unique per institution
@@unique([institutionId, year])            // SchoolYear: one year per institution
@@unique([studentId, courseSubjectId, periodId, type, date]) // Grade
@@unique([studentId, courseId, date, sportGroupId])         // Attendance
```

### 7.9 SUPER_ADMIN Special Case

`User.institutionId` is nullable to support `SUPER_ADMIN` (cross-tenant role). Two-layer uniqueness strategy:

1. **Prisma schema:**
   ```prisma
   @@unique([email, institutionId])
   ```
   Enforces: `email + institutionId` must be unique. Allows `admin@edusystem.com + NULL`.

2. **PostgreSQL partial index (`prisma/init.sql`):**
   ```sql
   CREATE UNIQUE INDEX users_email_unique_super_admin
     ON users (email)
     WHERE institution_id IS NULL;
   ```
   Enforces: only one `SUPER_ADMIN` per email across all institutions.

**Result:** `admin@edusystem.com` as `SUPER_ADMIN`, `admin@sanmartin.edu.ar` as `ADMIN` — both can coexist.

### 7.10 Forbidden Schema Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Models without `institutionId` that represent tenant-scoped data | Cross-tenant contamination |
| Auto-increment IDs (`@id @default(autoincrement())`) | Sequential ID enumeration attack risk; incompatible with DB merges |
| Storing passwords in plain text | Security violation |
| Storing refresh tokens in plain text | Security violation |
| Tables without primary keys | Prisma requires `@id` on all models |
| Nullable fields without documented justification | Ambiguous data semantics |
| Creating tables outside Prisma migrations | Schema drift, no type safety |

---

## 8. Multi-Tenancy Rules

### 8.1 institutionId — The Cardinal Rule

**This is the single most critical rule in the entire database layer.** Every Prisma query on a tenant-scoped model MUST include `institutionId` in the `where` clause.

```typescript
// CORRECT
await this.prisma.student.findMany({ where: { institutionId } });

// WRONG: unscoped — critical security vulnerability
await this.prisma.student.findMany();
```

### 8.2 Tenant-Scoped Model Registry

The following 26 models are tenant-scoped and **MUST** always be queried with `institutionId`:

| Model | Notes |
|-------|-------|
| `User` | Soft-delete enabled |
| `Student` | Soft-delete enabled |
| `Course` | — |
| `Subject` | — |
| `CourseSubject` | Junction with teacher assignment |
| `CourseStudent` | Enrollment record |
| `Guardian` | Parent-child relationship |
| `Period` | Academic period within school year |
| `Grade` | Academic evaluation |
| `Attendance` | Daily attendance |
| `Justification` | Absence justification |
| `Announcement` | Soft-delete enabled |
| `Syllabus` | Temario per period |
| `Indicator` | Curriculum indicator |
| `IndicatorEvaluation` | Student indicator evaluation |
| `StudentObservation` | Per-period teacher observation |
| `PendingSubject` | Failed subjects tracking |
| `StudentCourseSubject` | Per-student subject assignment |
| `Convivencia` | Discipline record |
| `AbsenceRecord` | Auto-generated threshold breach |
| `Space` | Physical room/resource |
| `SpaceReservation` | Booking |
| `Sport` | Sport catalog |
| `SportGroup` | Sports team per year |
| `Invitation` | Onboarding invitation |
| `ChatRoom` | Chat room |
| `ChatRoomMember` | Room membership |
| `ChatMessage` | Chat message |

### 8.3 Cross-Tenant Models (No institutionId)

Six models are cross-tenant. These are platform-level entities managed by `SUPER_ADMIN` or owned by individual users:

- `RefreshToken` — owned by users
- `PushToken` — owned by users
- `UserLevelRole` — user-specific role overrides
- `Permission` — platform-level CASL definitions
- `Notification` — user-owned notifications
- `AuditLog` — has `institutionId` (not FK) for filtering, but records actions by any user

### 8.4 Where institutionId Comes From

| Source | Usage |
|--------|-------|
| `@InstitutionId()` decorator | Injected by `TenantMiddleware` into controller parameters |
| `req.user.institutionId` | Route-level access in guards and services |
| Job payload (`institutionId` field) | For queue processors |

**Never trust a client-supplied `institutionId`** (from request body, params, or query). Always use the server-injected value from the request context.

### 8.5 Tenant-Aware Foreign Keys

All tenant-scoped models reference `Institution` via `institutionId`:

```prisma
model Student {
  institutionId String
  institution   Institution @relation(fields: [institutionId], references: [id], onDelete: Cascade)

  @@index([institutionId])
}
```

### 8.6 Cascade Delete

Most tenant-scoped relations use `onDelete: Cascade`:

| Parent | Child | Behavior |
|--------|-------|---------|
| `Institution` | All child tables | `Cascade` (delete institution → delete all related data) |
| `User` | RefreshToken, PushToken, Notification, UserLevelRole | `Cascade` |
| `Student` | CourseStudent, Guardian | `Cascade` |
| `Course` | CourseStudent, CourseSubject | `Cascade` |

**Exception:** `AuditLog` from `Institution` uses `onDelete: Restrict` (audit data retained for compliance).

### 8.7 Forbidden Multi-Tenancy Patterns

| Forbidden Pattern | Severity | Reason |
|------------------|---------|--------|
| `prisma.model.findMany()` without `institutionId` on tenant models | **Critical** | Cross-tenant data leak |
| `prisma.model.findFirst()` without `institutionId` on tenant models | **Critical** | Cross-tenant data leak |
| `prisma.model.findUnique()` without `institutionId` check | **Critical** | ID enumeration attack |
| Using `req.body.institutionId` in service | **High** | Tenant spoofing |
| Using `req.params.institutionId` instead of `req.institutionId` | **High** | Untrusted client input |
| Module-level variables storing tenant data | **Critical** | Cross-request contamination |
| Caching tenant data in module scope | **Critical** | Stale data, memory leaks |
| Cross-tenant JOINs without explicit `institutionId` filter | **High** | Data leakage via JOIN |

### 8.8 Tenant-Aware Queries in Workers

Workers receive `institutionId` in the job payload and must use it for all Prisma queries:

```typescript
@Process(JOBS.GRADE_CREATED)
async handleGradeCreated(job: Job<GradeCreatedPayload>) {
  const { gradeId, institutionId } = job.data;
  // All queries within the worker must use institutionId
  const grade = await this.prisma.grade.findFirst({
    where: { id: gradeId, institutionId },  // institutionId filter REQUIRED
  });
}
```

Workers are **stateless and tenant-agnostic** — the `institutionId` in the payload is the sole tenant identifier. Workers never hold per-tenant state.

---

## 9. Soft Delete Rules

### 9.1 Soft Delete Architecture

Soft delete is implemented via a `PrismaService` middleware that automatically injects `deletedAt: null` into all `findMany` and `findFirst` queries on soft-delete-enabled models.

```typescript
// src/prisma/prisma.service.ts — soft-delete middleware
this.$use(async (params, next) => {
  const modelsWithSoftDelete = [
    'User',
    'Student',
    'Announcement',
    'Institution',
  ];

  if (
    params.model &&
    modelsWithSoftDelete.includes(params.model) &&
    (params.action === 'findMany' || params.action === 'findFirst')
  ) {
    params.args.where = {
      ...params.args.where,
      deletedAt: null,  // Automatically injected
    };
  }

  return next(params);
});
```

### 9.2 Soft Delete Model Registry

| Model | Soft Delete | Rationale |
|-------|------------|-----------|
| `Institution` | Yes | Can be suspended/reactivated; data must be preserved |
| `User` | Yes | Can be deactivated; record preserved for audit and historical references |
| `Student` | Yes | Can be transferred or graduated; academic history preserved |
| `Announcement` | Yes | Can be unpublished; preserving for audit |
| **All other models** | No | Use `onDelete: Cascade` or hard delete where appropriate |

### 9.3 Soft Delete Operations

```typescript
// Soft delete: set deletedAt timestamp
await this.prisma.student.update({
  where: { id, institutionId },
  data: { deletedAt: new Date() },
});

// Restore soft-deleted record
await this.prisma.student.update({
  where: { id },
  data: { deletedAt: null },
});

// Hard delete: reserved for non-soft-delete models
await this.prisma.courseSubject.delete({
  where: { id, institutionId },
});
```

### 9.4 Middleware Behavior Details

The soft-delete middleware only affects `findMany` and `findFirst`. It does **not** affect:

| Action | Middleware Behavior | Notes |
|--------|---------------------|-------|
| `findMany` | Adds `deletedAt: null` | Automatic filtering |
| `findFirst` | Adds `deletedAt: null` | Automatic filtering |
| `findUnique` | No filter injected | Caller specifies exact ID; deleting makes record unreachable (desired) |
| `create` | No filter needed | New records have `deletedAt = null` by default |
| `update` | No filter needed | Only active records are typically updated |
| `upsert` | No filter needed | Create or update existing |
| `delete` | No filter injected | Performs hard delete — use `update` with `deletedAt` for soft delete |
| `$queryRaw` | No filter injected | Bypasses Prisma middleware — use only with explicit `WHERE` |

### 9.5 Querying Soft-Deleted Records

For administrative or reporting purposes where soft-deleted records must be included:

```typescript
// Option 1: $queryRaw (bypasses middleware — use with caution)
const allStudents = await this.prisma.$queryRaw`
  SELECT id, first_name, last_name, deleted_at
  FROM students
  WHERE institution_id = ${institutionId}
`;

// Option 2: Find unique with explicit deletedAt check (does not go through middleware for findFirst)
const student = await this.prisma.student.findUnique({
  where: { id },
  // Note: middleware does not filter findUnique
});
```

### 9.6 Hard Delete vs Soft Delete Decision Matrix

| Scenario | Method | Rationale |
|----------|--------|-----------|
| User deactivation | Soft delete | Preserve record, prevent login |
| Student transfer/graduation | Soft delete | Preserve academic history |
| Announcement unpublish | Soft delete | Preserve for audit |
| Test data cleanup | Hard delete | Import rollback, test fixtures |
| Import error correction | Hard delete | Remove incorrectly created records |
| Cascade from parent delete | Hard delete | `onDelete: Cascade` |
| Space removal | Hard delete | Physical resource no longer exists |

### 9.7 Forbidden Soft Delete Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| `prisma.model.delete()` on soft-delete models (Institution, User, Student, Announcement) | Should use soft delete via `update({ data: { deletedAt } })` |
| Manually adding `deletedAt: null` to queries | Middleware handles it automatically; adding it manually may cause issues |
| Using `$queryRaw` for normal queries (bypasses middleware) | Only use for administrative queries with explicit `WHERE` |
| Soft-deleting a record while it has active foreign key references | May cause orphaned references; use `onDelete: Restrict` or check references first |

---

## 10. Relationship Modeling Rules

### 10.1 Relationship Types and When to Use Each

| Pattern | Implementation | When to Use | EduSystem Examples |
|---------|---------------|-------------|-------------------|
| **One-to-Many (owner)** | FK on child + `@relation` | Parent owns children; cascade delete | `Institution → users`, `Course → courseStudents` |
| **One-to-Many (attribute)** | FK + extra columns on join table | The join has business data | `CourseSubject` (teacherId, hoursPerWeek) |
| **Many-to-Many (simple)** | Junction table with `@@id` | Pure M:N without attributes | `SportGroupTeacher`, `SportGroupStudent` |
| **Many-to-Many (unique constraint)** | Junction table with `@@unique` | M:N where a record can only exist once | `Guardian`, `ChatRoomMember` |
| **One-to-One** | `@unique` on FK column | Exactly one associated record | `Justification.attendanceId @unique` |

### 10.2 Junction Table Decision Matrix

```
Question: Does the join between two entities carry business data?

YES → Create a full model (e.g., CourseSubject with teacherId, hoursPerWeek)
NO  → Is it a simple many-to-many? Use junction table with @@id or @@unique
      - Has attributes? → @@unique (Guardian: has relationship type)
      - No attributes? → @@id (SportGroupTeacher, SportGroupStudent)
```

### 10.3 Cascade Delete Strategy

| Relation | Delete Behavior | Rationale |
|---------|-----------------|-----------|
| `Institution → [all child tables]` | `Cascade` | Deleting institution removes all related data. Exception: `AuditLog` uses `Restrict` for compliance. |
| `User → RefreshToken, PushToken, Notification, UserLevelRole` | `Cascade` | Tokens are meaningless without the user. |
| `Student → CourseStudent` | `Cascade` | Enrollment is meaningless without the student. |
| `Course → CourseStudent, CourseSubject` | `Cascade` | Enrollment and subject assignment deleted when course deleted. |
| `Justification → Attendance` | `@relation("AttendanceJustification")` | Justification is 1:1 extension of Attendance. |
| `Justification.reviewer` | Optional `@relation` | Nullable FK — reviewer may be deactivated. |

### 10.4 Self-Referential Relations

Not currently used in the schema. Reserved for future features like course prerequisites. If needed:

```prisma
model Course {
  id               String   @id @default(uuid())
  prerequisiteId   String?  @map("prerequisite_id")
  prerequisite     Course?  @relation("CoursePrerequisite", fields: [prerequisiteId], references: [id])
  dependents       Course[] @relation("CoursePrerequisite")
}
```

### 10.5 Why CourseSubject Is a Full Model

`CourseSubject` exists as a first-class model (not a simple `@relation`) because it carries business attributes:

- `teacherId`: who teaches this subject in this course
- `hoursPerWeek`: weekly load for scheduling
- `createdAt`: audit when the assignment was made

Treating it as a simple `@relation` would lose this information.

### 10.6 One-to-One Relationships

```prisma
model Justification {
  id           String     @id @default(uuid())
  attendanceId String     @unique @map("attendance_id")  // @unique = 1:1
  attendance   Attendance @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
}
```

### 10.7 Forbidden Relationship Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Cross-tenant foreign keys | Would enable cross-tenant data access via FK traversal |
| Missing `onDelete` behavior on relations | Leaves orphaned records on parent delete |
| Using `@relation` without junction table when join has attributes | Data loss |
| `onDelete: SetNull` without documented justification | Data integrity loss |

---

## 11. Query Safety Rules

### 11.1 institutionId Must Be in Every Tenant-Scoped Query

```typescript
// CORRECT: always include institutionId
const students = await this.prisma.student.findMany({
  where: { institutionId },
});

// CORRECT: composite with other filters
const students = await this.prisma.student.findMany({
  where: {
    institutionId,
    deletedAt: null,        // Middleware handles this, but explicit is fine
    enrollmentStatus: 'ACTIVE',
  },
});

// WRONG: missing institutionId
const students = await this.prisma.student.findMany({
  where: { deletedAt: null },
});
```

### 11.2 No N+1 Queries

```typescript
// WRONG: N+1 — one query per course
const courses = await this.prisma.course.findMany({ where: { institutionId } });
for (const course of courses) {
  course.students = await this.prisma.student.findMany({  // N extra queries
    where: { courseId: course.id },
  });
}

// CORRECT: include relations
const courses = await this.prisma.course.findMany({
  where: { institutionId },
  include: {
    students: { select: { id: true, firstName: true, lastName: true } },
  },
});

// CORRECT: parallel queries
const [courses, teachers] = await Promise.all([
  this.prisma.course.findMany({ where: { institutionId } }),
  this.prisma.user.findMany({ where: { institutionId, role: 'TEACHER' } }),
]);
```

### 11.3 Field Selection

```typescript
// CORRECT: select only needed fields
const students = await this.prisma.student.findMany({
  where: { institutionId },
  select: { id: true, firstName: true, lastName: true, documentNumber: true },
});

// WRONG: select all fields when not needed
const students = await this.prisma.student.findMany({
  where: { institutionId },
  // No select → includes ALL fields including passwordHash, avatarUrl, etc.
});
```

### 11.4 Pagination

```typescript
// CORRECT: always use take for list queries
const students = await this.prisma.student.findMany({
  where: { institutionId },
  take: 100,        // Default limit: 100
  skip: (page - 1) * 100,
  orderBy: { createdAt: 'desc' },
});

// CORRECT: cursor-based pagination for large datasets
const students = await this.prisma.student.findMany({
  where: { institutionId },
  take: 50,
  skip: cursor ? 1 : 0,
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: 'desc' },
});

// WRONG: unbounded result set
const students = await this.prisma.student.findMany({
  where: { institutionId },
  // No take → could return millions of rows
});
```

### 11.5 Role-Based Filtering in Queries

Services implement role-aware filtering. Use the `user` object to scope results:

```typescript
// GUARDIAN: only their own children
if (user.role === 'GUARDIAN') {
  const childIds = await this.prisma.guardian.findMany({
    where: { userId: user.id },
    select: { studentId: true },
  }).then((guardians) => guardians.map((g) => g.studentId));
  where.studentId = { in: childIds };
}

// TEACHER: only their assigned subjects
if (user.role === 'TEACHER') {
  const subjectIds = await this.prisma.courseSubject.findMany({
    where: { teacherId: user.id, course: { institutionId } },
    select: { id: true },
  }).then((cs) => cs.map((c) => c.id));
  where.courseSubjectId = { in: subjectIds };
}
```

### 11.6 Forbidden Query Patterns

| Forbidden Pattern | Severity | Reason |
|------------------|---------|--------|
| Queries without `institutionId` on tenant models | **Critical** | Cross-tenant data leak |
| N+1 query loops | **High** | Database overload |
| Unbounded `findMany()` without `take` | **High** | Memory exhaustion |
| `ORDER BY random()` on large tables | **High** | Full table scan |
| Overfetching with `include: { relation: true }` | **Medium** | Large response payloads |
| Using `findUnique` without `institutionId` check | **High** | ID enumeration |
| Queries with `select: *` or no select on large entities | **Medium** | Unnecessary data transfer |

---

## 12. Transaction Rules

### 12.1 When Transactions Are Mandatory

Transactions are **required** when a single logical operation writes to multiple models:

| Scenario | Transaction Required |
|----------|----------------------|
| Create `Attendance` + `Justification` in one request | Yes |
| Update `Student` + create `AbsenceRecord` | Yes |
| Create multiple `CourseStudent` records in bulk enrollment | Yes |
| Create `Convivencia` + notify guardians | Yes |
| Soft delete `Institution` + all related records | Yes |

### 12.2 Transaction Pattern

```typescript
// Pattern 1: inline transaction
await this.prisma.$transaction(async (tx) => {
  const attendance = await tx.attendance.create({
    data: { studentId, courseId, date, status, institutionId },
  });
  await tx.justification.create({
    data: {
      attendanceId: attendance.id,
      studentId,
      institutionId,
      reason,
    },
  });
  return attendance;
});

// Pattern 2: using PrismaService helper
await this.prisma.runTransaction(async (prisma) => {
  const course = await prisma.course.create({ data: { ... } });
  await prisma.courseSubject.createMany({
    data: subjectIds.map((id) => ({
      courseId: course.id,
      subjectId: id,
      institutionId,
    })),
  });
  return course;
});
```

### 12.3 Concurrent Write Handling

For operations that may race (e.g., bulk grade uploads):

```typescript
// Use upsert within transaction for concurrent safety
await this.prisma.$transaction(async (tx) => {
  for (const gradeData of grades) {
    await tx.grade.upsert({
      where: {
        studentId_courseSubjectId_periodId_type_date: {
          studentId: gradeData.studentId,
          courseSubjectId: gradeData.courseSubjectId,
          periodId: gradeData.periodId,
          type: gradeData.type,
          date: new Date(Date.UTC(...)),
        },
      },
      create: { ...gradeData, institutionId },
      update: { score: gradeData.score, description: gradeData.description },
    });
  }
});
```

### 12.4 Transaction Boundaries

Keep transactions small and focused. Do not include non-database operations (API calls, file uploads) inside transactions:

```typescript
// CORRECT: transaction only for DB operations
await this.prisma.$transaction(async (tx) => {
  const grade = await tx.grade.create({ data: { ... } });
  await tx.auditLog.create({ data: { ... } });  // Audit is dispatched to queue, not in transaction
});

// Queue dispatch AFTER transaction
await this.notificationQueue.add(JOBS.GRADE_CREATED, { gradeId: grade.id, institutionId });
```

### 12.5 Retry-Safe Transactions

Prisma transactions can fail with transient errors (connection loss, deadlock). Services should handle retry for critical operations:

```typescript
async function createWithRetry(
  operation: () => Promise<Course>,
  maxRetries = 3,
): Promise<Course> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await this.prisma.$transaction(operation);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        // Deadlock — retry
        this.logger.warn(`Deadlock detected, retry ${attempt + 1}/${maxRetries}`);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Transaction failed after max retries');
}
```

### 12.6 Forbidden Transaction Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Including non-database operations (API calls, file uploads) inside transactions | May cause long-held locks; API failures leave transaction in inconsistent state |
| Giant transactions spanning dozens of operations | Performance degradation; lock contention |
| Starting transaction without explicit reason | Overhead; use only when multiple models are written |
| Forgetting to await the transaction callback | Silent failure; always await `$transaction()` |

---

## 13. Migration Rules

### 13.1 Core Migration Principles

1. **Never modify existing migrations.** Create a new migration for every schema change.
2. **Migrations are incremental.** Each migration is a step in the evolution of the schema.
3. **Test migrations locally before deploying.** Run `prisma migrate dev` against a production-like dataset.
4. **Run `prisma generate` after every migration.** Regenerate the TypeScript client after schema changes.
5. **Backward-compatible by default.** Additive changes (new nullable columns, new tables) are safe. Destructive changes (drop columns, change types, add NOT NULL without defaults) require migration planning.

### 13.2 Migration Workflow

```bash
# 1. Modify schema.prisma
# 2. Create migration
npx prisma migrate dev --name descriptive-migration-name

# 3. Verify migration applies correctly
# 4. Generate client
npx prisma generate

# 5. For production
npx prisma migrate deploy
```

### 13.3 Safe Migration Patterns

```prisma
// CORRECT: Adding a new nullable column
model Student {
  middleName String? @map("middle_name")  // Nullable → safe
}

// CORRECT: Adding a new table
model NewModel {
  id            String @id @default(uuid())
  institutionId String @map("institution_id")
  createdAt     DateTime @default(now()) @map("created_at")

  institution Institution @relation(...)

  @@index([institutionId])
}

// CORRECT: Adding a new non-nullable column with a default
model Student {
  enrollmentType EnrollmentType @default(REGULAR) @map("enrollment_type")  // Has default → safe
}
```

### 13.4 Dangerous Migration Patterns

| Pattern | Why Dangerous | Safe Alternative |
|---------|--------------|-----------------|
| Adding `NOT NULL` without default | Breaks existing rows that have no value | Add nullable first, then backfill, then alter to NOT NULL |
| Removing a column | Breaks any code that references it | Deprecate first (add comment), then remove in next release |
| Changing a column type | May truncate data | Add new column, migrate data, drop old column |
| Renaming a column | Breaks code references | Add new column, update code to use new name, drop old column |
| Modifying existing migrations | Data loss risk on existing deployments | Create a new migration instead |

### 13.5 Migration for New Tenant-Scoped Model

```prisma
// In schema.prisma
model NewTenantModel {
  id            String   @id @default(uuid())
  institutionId String   @map("institution_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  institution Institution @relation(fields: [institutionId], references: [id], onDelete: Cascade)

  @@index([institutionId])
}

// Migration command
npx prisma migrate dev --name add-new-tenant-model
```

### 13.6 Migration for New Soft-Delete Model

To add soft delete to an existing model:

1. Add `deletedAt DateTime? @map("deleted_at")` to the model in schema.prisma
2. Add the model name to the `modelsWithSoftDelete` array in `PrismaService` middleware
3. Run `prisma migrate dev --name add-soft-delete-to-modelname`

```typescript
// In prisma.service.ts
const modelsWithSoftDelete = [
  'User',
  'Student',
  'Announcement',
  'Institution',
  'NewSoftDeleteModel',  // Add here
];
```

### 13.7 Migration for New Index

```prisma
// In schema.prisma
model Attendance {
  // ... existing fields ...

  @@index([studentId, courseId, date])
}
```

### 13.8 Migration for Enum Addition

Adding a new enum value requires a migration:

```prisma
enum GradeType {
  EXAM
  ASSIGNMENT
  ORAL
  PROJECT
  PARTICIPATION
  PRACTICAL  // New value
}
```

Run `prisma migrate dev --name add-practical-grade-type`. The migration adds the new value to the PostgreSQL enum type without data loss.

### 13.9 Forbidden Migration Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Modifying existing migration files | Data loss on deployed databases |
| Dropping a column without deprecation period | Breaks existing application code |
| Adding `NOT NULL` without default | Breaks existing rows |
| Renaming a column directly | Breaks code references before migration completes |
| Creating tables outside Prisma migrations | Schema drift from Prisma source of truth |
| Running `prisma migrate reset` in production | Destroys all data |

---

## 14. Indexing Rules

### 14.1 Mandatory Indexes

Every tenant-scoped model must have an index on `institutionId`:

```prisma
@@index([institutionId])
```

All foreign key fields used in `where` clauses must be indexed:

```prisma
@@index([institutionId])          // Every tenant-scoped table
@@index([studentId])              // Grade, Attendance, Guardian
@@index([courseId])               // Attendance, CourseStudent
@@index([courseSubjectId])        // Grade
@@index([teacherId])              // CourseSubject (ABAC)
@@index([periodId])               // Grade, IndicatorEvaluation
@@index([schoolYearId])           // Course, SportGroup
```

### 14.2 Composite Indexes for Common Query Patterns

```prisma
// Student lookup by DNI
model Student {
  @@unique([institutionId, documentNumber])
}

// Grade upsert constraint
model Grade {
  @@unique([studentId, courseSubjectId, periodId, type, date])
}

// Attendance upsert constraint (includes nullable sportGroupId)
model Attendance {
  @@unique([studentId, courseId, date, sportGroupId])
}

// SchoolYear active year lookup
model SchoolYear {
  @@unique([institutionId, year])
}

// User login lookup
model User {
  @@unique([email, institutionId])
}
```

### 14.3 Index for ABAC Queries

```prisma
// TEACHER: courses by subject (for CASL authorization)
model CourseSubject {
  teacherId String @map("teacher_id")

  @@index([teacherId])  // Required for: WHERE teacherId = user.id
}

// GUARDIAN: children lookup
model Guardian {
  studentId String @map("student_id")

  @@index([studentId])  // Required for: WHERE studentId IN (guardian's children)
}
```

### 14.4 Index for Pagination

```prisma
// Chat message history with cursor-based pagination
model ChatMessage {
  roomId   String @map("room_id")
  sentAt   DateTime @default(now()) @map("sent_at")

  @@index([roomId, sentAt])  // Required for: WHERE roomId = ? ORDER BY sentAt DESC
}

// Audit log time-range queries
model AuditLog {
  institutionId String @map("institution_id")
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([institutionId, createdAt])  // Required for: WHERE institutionId = ? AND createdAt > ?
}
```

### 14.5 Index for Unique Constraints

Unique constraints automatically create B-tree indexes. Use `@@unique` for:

- `@@unique([email, institutionId])` — User
- `@@unique([institutionId, documentNumber])` — Student
- `@@unique([institutionId, code])` — Subject
- `@@unique([institutionId, year])` — SchoolYear
- `@@unique([studentId, courseSubjectId, periodId, type, date])` — Grade
- `@@unique([studentId, courseId, date, sportGroupId])` — Attendance

### 14.6 Partial Index for SUPER_ADMIN

Created in `prisma/init.sql` (Prisma cannot generate partial indexes):

```sql
CREATE UNIQUE INDEX users_email_unique_super_admin
  ON users (email)
  WHERE institution_id IS NULL;
```

### 14.7 Future Index Recommendations

| Query Pattern | Recommended Index | Notes |
|-------------|-------------------|-------|
| Attendance filtered by `courseId + date range` | `([courseId, date])` | High cardinality; large result sets |
| Grade filtered by `courseSubjectId + date range` | `([courseSubjectId, date])` | High cardinality |
| Student full-text search on name | GIN index on `firstName || ' ' || lastName` | For search autocomplete |
| AuditLog cleanup (delete old records) | `([createdAt])` partial | For scheduled cleanup job |

### 14.8 Forbidden Indexing Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Missing index on `institutionId` for tenant-scoped tables | Slow tenant queries at scale |
| Missing index on FK fields used in `where` clauses | Slow lookups |
| Index on `ORDER BY random()` column | Full table scan every time |
| Too many indexes on write-heavy tables | Slows INSERT/UPDATE operations |
| Index on low-cardinality columns (e.g., boolean) | Minimal benefit, overhead on writes |

---

## 15. Authentication Data Rules

### 15.1 RefreshToken Model

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tokenHash String   @unique @map("token_hash") @db.VarChar(256)  // bcrypt hash
  deviceInfo Json    @map("device_info")  // { userAgent, ip, deviceName }
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")  // null = active
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tokenHash])
  @@index([userId])
}
```

### 15.2 Token Storage Rules

| Rule | Implementation |
|------|---------------|
| Never store plaintext tokens | Store bcrypt hash of token |
| Hash cost factor | 10 (balance between security and login latency) |
| Token comparison | bcrypt.compare() — not string equality |
| Expiration | 7 days (set `expiresAt`) |
| Revocation | Set `revokedAt` to current timestamp |
| Multi-device | Each device has its own token record |

```typescript
// Store: hash the refresh token before saving
const tokenHash = await bcrypt.hash(refreshToken, 10);
await this.prisma.refreshToken.create({
  data: { userId, tokenHash, deviceInfo: { userAgent, ip }, expiresAt },
});

// Revoke: mark the token as revoked
await this.prisma.refreshToken.update({
  where: { tokenHash: hashedToken },
  data: { revokedAt: new Date() },
});
```

### 15.3 Password Hash Storage

```prisma
model User {
  passwordHash String @map("password_hash") @db.VarChar(256)
}
```

- Algorithm: bcrypt, cost factor 12
- Never log or return password hashes
- Never accept password in API responses

### 15.4 PushToken Model

```prisma
model PushToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  token     String   @map("token") @db.VarChar(512)  // FCM device token
  platform  Platform // IOS | ANDROID | WEB
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isActive])
}
```

### 15.5 lastLoginAt Tracking

```prisma
model User {
  lastLoginAt DateTime? @map("last_login_at")
}
```

Updated synchronously on successful login. Not used for authentication (JWT handles that) — used for:

- "Last login: 2 hours ago" in admin user detail views
- Stale account detection (inactive for 6+ months)

### 15.6 Forbidden Authentication Data Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Storing refresh tokens in plain text | Security violation |
| Storing passwords without hashing | Security violation |
| Using sequential IDs for tokens | Enumeration attack |
| Not expiring refresh tokens | Token never becomes invalid |
| Storing tokens in module-level variables | Memory leak, cross-request contamination |

---

## 16. Authorization Data Rules

### 16.1 UserLevelRole Model

```prisma
model UserLevelRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  level     Level    // INICIAL | PRIMARIA | SECUNDARIA
  role      Role     // TEACHER | PRECEPTOR | etc.
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, level, role])
  @@index([userId])
}
```

**Use case:** A user who is a `TEACHER` in `PRIMARIA` and a `PRECEPTOR` in `SECUNDARIA`. Their effective role is the highest between `User.role` and all `UserLevelRole.roles` via `getHighestRole()`.

### 16.2 Permission Model (CASL Conditions)

```prisma
model Permission {
  id        String  @id @default(uuid())
  role      Role
  action    String  @db.VarChar(50)   // CREATE, READ, UPDATE, DELETE, EXPORT
  resource  String  @db.VarChar(50)   // Grade, Attendance, Course, Student
  condition Json?   // e.g., { "teacherId": "{{userId}}" }

  @@unique([role, action, resource])
}
```

The `condition` field stores CASL-compatible JSON. Example: `{ "teacherId": "{{userId}}" }` means a `TEACHER` can only `READ`/`UPDATE` grades where `courseSubject.teacherId == user.id`.

### 16.3 Role Hierarchy (Database Representation)

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  DIRECTOR
  SECRETARY
  PRECEPTOR
  TEACHER
  GUARDIAN
}
```

```
SUPER_ADMIN > ADMIN > DIRECTOR > SECRETARY > PRECEPTOR > TEACHER > GUARDIAN
```

### 16.4 Effective Role Computation

```typescript
// src/common/utils/role-hierarchy.ts
const ROLE_HIERARCHY = [
  'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY',
  'PRECEPTOR', 'TEACHER', 'GUARDIAN',
];

export function getHighestRole(roles: string[]): string {
  const indices = roles
    .map((r) => ROLE_HIERARCHY.indexOf(r))
    .filter((i) => i !== -1);
  return indices.length > 0
    ? ROLE_HIERARCHY[Math.min(...indices)]
    : 'GUARDIAN';  // fallback
}
```

Usage: A user with `role=TEACHER` and `UserLevelRole[level=SECUNDARIA, role=DIRECTOR]` has effective role `DIRECTOR`.

### 16.5 CASL Integration with Database

The `Permission` table is the database-backed source of truth for CASL abilities. On login, the user's abilities are loaded from:

1. Static `Permission` table (role-based)
2. `UserLevelRole` table (level-specific overrides)

The `AbilityFactory` combines these to produce the `Ability` object used by `@CheckAbility()` guards.

### 16.6 Forbidden Authorization Data Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Using `User.role` directly instead of `getHighestRole()` | Incorrect permissions for users with level overrides |
| Hardcoding role hierarchy in service logic | Use `getHighestRole()` utility instead |
| Storing authorization decisions in module-level variables | Not thread-safe in worker processes |
| Caching CASL abilities without invalidation | Stale permissions after role changes |

---

## 17. Audit Logging Rules

### 17.1 AuditLog Model

```prisma
model AuditLog {
  id            String      @id @default(uuid())
  institutionId String      @map("institution_id")
  userId        String      @map("user_id")
  action        AuditAction // CREATE | UPDATE | DELETE | LOGIN | LOGOUT | EXPORT
  resource      String      @db.VarChar(50)   // "Grade", "Attendance", "User"
  resourceId    String      @map("resource_id")
  before        Json?       // previous state (UPDATE/DELETE)
  after         Json?       // new state (CREATE/UPDATE)
  ipAddress     String?     @map("ip_address") @db.VarChar(45)
  userAgent     String?     @map("user_agent") @db.VarChar(500)
  createdAt     DateTime    @default(now()) @map("created_at")

  institution Institution @relation(fields: [institutionId], references: [id])
  user        User        @relation(fields: [userId], references: [id])

  @@index([institutionId, createdAt])
  @@index([userId])
  @@index([resource, resourceId])
}
```

### 17.2 Why Async via BullMQ

| Approach | Pros | Cons |
|----------|------|------|
| **Async via BullMQ** (chosen) | Non-blocking API; worker batches inserts; retry on failure | Small risk of losing record if Redis fails before job is processed |
| Synchronous INSERT in service | Simple, transactional with business operation | Blocks HTTP response; JSON serialization of large objects delays response |
| PostgreSQL trigger | DB-level enforcement; no app code dependency | DB coupling; harder to test; cannot enrich with application context |

The **async via BullMQ** approach was chosen because:
- Audit write is never on the critical path of user-facing operations.
- `before`/`after` JSON snapshot serialization can be slow — blocking HTTP responses is unnecessary.
- BullMQ provides built-in retry (5 attempts, exponential backoff) and dead-letter queue.

### 17.3 Audit Log Flow

```
1. Service executes business logic (e.g., update grade)
2. Service calls auditQueue.add(JOBS.AUDIT_LOG, { action, resource, resourceId, before, after })
3. BullMQ Producer enqueues job to Redis
4. Worker (AuditProcessor) dequeues job
5. AuditProcessor serializes before/after as JSON
6. AuditProcessor writes to AuditLog table
7. On failure: BullMQ retries 5 times with exponential backoff
```

### 17.4 What Gets Audited

| Action | Trigger | Before/After |
|--------|---------|--------------|
| `CREATE` | Any insert on a major entity | `null` / new record |
| `UPDATE` | Any update on a major entity | old record / new record |
| `DELETE` | Any hard delete | old record / `null` |
| `LOGIN` | Successful authentication | `null` / `{ ip, userAgent }` |
| `LOGOUT` | Logout endpoint | `{ sessionInfo }` / `null` |
| `EXPORT` | CSV/PDF report generation | `null` / `{ resource, filters }` |

### 17.5 Audit Log Dispatch Pattern

```typescript
// Always dispatch AFTER DB write
const grade = await this.prisma.grade.create({ data: { ... } });
await this.auditQueue.add(JOBS.AUDIT_LOG, {
  institutionId,
  userId,
  action: 'CREATE',
  resource: 'Grade',
  resourceId: grade.id,
  before: null,
  after: grade,
}, JOB_OPTIONS.CRITICAL);
```

### 17.6 Audit Log Data Retention

Audit logs are retained for **1 year**. After 1 year, a scheduled job purges records older than 365 days. For compliance beyond 1 year, `pg_dump` backup archives preserve audit data indefinitely.

### 17.7 Forbidden Audit Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Dispatching audit job before DB write | Orphaned audit records if DB fails |
| Dispatching audit inside a transaction | Unnecessary lock contention; audit is non-critical |
| Storing `before`/`after` as plain strings instead of JSON | Cannot query or filter by audit content |
| Omitting `institutionId` in audit payload | Breaks tenant-scoped audit queries |
| Not retrying failed audit jobs | Lost audit records |

---

## 18. Queue & Worker Data Rules

### 18.1 BullMQ Queue Topology

BullMQ uses Redis for queue state — **no PostgreSQL tables are used for queue management**. Redis stores job metadata, retry state, and dead-letter information.

| Queue | Redis Key Pattern | Purpose | Retry Strategy |
|-------|-------------------|---------|----------------|
| `notifications` | `bull:notifications` | FCM push, in-app notifications | `DEFAULT` (3x, exp 2s) |
| `audit-log` | `bull:audit-log` | AuditLog persistence | `CRITICAL` (5x, exp 1s) |
| `grade-processing` | `bull:grade-processing` | Grade average recalculation | `DEFAULT` (3x, exp 2s) |
| `pdf-generation` | `bull:pdf-generation` | PDF report generation | `LOW_PRIORITY` (2x, fixed 5s) |

### 18.2 Notification Model — Persisted in DB

While BullMQ manages the job queue in Redis, **notification records are persisted in PostgreSQL**:

```prisma
model Notification {
  id     String           @id @default(uuid())
  userId String           @map("user_id")
  type   NotificationType // GRADE | ATTENDANCE | CHAT | ANNOUNCEMENT | SYSTEM
  title  String           @db.VarChar(200)
  body   String
  data   Json?            // { gradeId, courseId } for deep linking
  isRead Boolean          @default(false) @map("is_read")
  sentAt DateTime         @default(now()) @map("sent_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
}
```

**Flow:**
1. `NotificationProcessor` receives job from Redis.
2. Sends FCM push via Firebase Admin SDK.
3. Persists notification record to `Notification` table.
4. Frontend polls `GET /notifications?isRead=false` every 30 seconds.

### 18.3 AbsenceRecord — Auto-Generated

When a student's absence count exceeds the threshold configured in `Institution.settings.absenceThresholds`, an `AbsenceRecord` is auto-generated:

```prisma
model AbsenceRecord {
  id            String   @id @default(uuid())
  studentId     String   @map("student_id")
  courseId      String   @map("course_id")
  institutionId String   @map("institution_id")
  absenceCount  Int      @map("absence_count")  // Total absences at time of generation
  threshold     Int      // e.g., 10 — threshold that triggered this record
  generatedAt   DateTime @default(now()) @map("generated_at")
  sentToParent  Boolean  @default(false) @map("sent_to_parent")
  sentAt        DateTime? @map("sent_at")
  readAt        DateTime? @map("read_at")
}
```

### 18.4 Job Payload Requirements

Every job payload MUST include `institutionId`. Workers are stateless and tenant-agnostic — the `institutionId` in the payload is the sole tenant identifier:

```typescript
// CORRECT: institutionId in every job payload
await this.notificationQueue.add(JOBS.GRADE_CREATED, {
  gradeId: grade.id,
  studentId: dto.studentId,
  institutionId,  // REQUIRED
});

// CORRECT: worker uses institutionId from payload
@Process(JOBS.GRADE_CREATED)
async handleGradeCreated(job: Job<GradeCreatedPayload>) {
  const { gradeId, institutionId } = job.data;
  // All Prisma queries use institutionId
}
```

### 18.5 Idempotency in Worker DB Writes

All processors must be idempotent to prevent duplicate records:

```typescript
// Pattern: use skipDuplicates on createMany
await this.prisma.notification.createMany({
  data: userIds.map((userId) => ({ userId, type, title, body, data })),
  skipDuplicates: true,
});

// Pattern: findFirst check before processing
const existing = await this.prisma.notification.findFirst({
  where: { userId, type, data: { gradeId } as any },
});
if (existing) return;  // Already processed — idempotent guard
```

### 18.6 Eventual Consistency Considerations

Queue-based operations are **eventually consistent**:

| Operation | Consistency Model | Latency |
|-----------|------------------|---------|
| FCM push notification | Eventually consistent | ~500ms-2s |
| In-app notification (DB) | Eventually consistent | ~1-5s |
| Audit log | Eventually consistent | ~500ms-2s |
| Grade recalculation | Eventually consistent | ~1-30s |
| PDF generation | Eventually consistent | ~5-60s |

The API response does **not** wait for queue completion. Clients must poll or use WebSockets for real-time updates.

### 18.7 Forbidden Queue Data Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Job payload without `institutionId` | Breaks tenant isolation in workers |
| Non-idempotent processors | Duplicate notifications, duplicate audit logs |
| Calling `FcmService` directly from services | Bypasses DB persistence — notification may be lost |
| `Promise.all()` for bulk PDF jobs in processor | Puppeteer browser exhaustion |
| Storing job state in module-level variables | Workers are stateless — state lost on restart |
| Redis AOF disabled | Job loss on Redis restart |

---

## 19. Performance Rules

### 19.1 Query Optimization

| Rule | Implementation |
|------|---------------|
| Index all FK fields in `where` clauses | `@@index([institutionId])`, `@@index([studentId])` |
| Limit returned fields | `select: { id: true, firstName: true }` instead of full entity |
| Use `include` for relations | Avoid N+1 loops; `include` produces JOIN, not separate queries |
| Parallel independent reads | `Promise.all([prisma.X.findMany(), prisma.Y.findMany()])` |
| Pagination for all list queries | `take: 100, skip: (page - 1) * 100` |
| Cursor-based pagination for large datasets | `cursor: { id }` instead of `skip`/`take` offset |

### 19.2 Field Selection Best Practices

```typescript
// CORRECT: select only what's needed for the response
const students = await this.prisma.student.findMany({
  where: { institutionId },
  select: {
    id: true,
    firstName: true,
    lastName: true,
    documentNumber: true,
  },
});

// WRONG: select all fields (includes passwordHash, avatarUrl, etc.)
const students = await this.prisma.student.findMany({
  where: { institutionId },
  // No select — all fields returned
});
```

### 19.3 Avoiding N+1 Queries

```typescript
// WRONG: N+1 — one query per course
const courses = await this.prisma.course.findMany({ where: { institutionId } });
for (const course of courses) {
  course.subjectCount = (await this.prisma.courseSubject.count({
    where: { courseId: course.id },
  }));
}

// CORRECT: use Promise.all for parallel queries
const [courses, subjectCounts] = await Promise.all([
  this.prisma.course.findMany({ where: { institutionId } }),
  this.prisma.courseSubject.groupBy({
    by: ['courseId'],
    _count: true,
    where: { course: { institutionId } },
  }),
]);

// CORRECT: use include for nested relations
const courses = await this.prisma.course.findMany({
  where: { institutionId },
  include: {
    subjects: { select: { id: true, name: true } },
    students: { select: { id: true } },
  },
});
```

### 19.4 Pagination Strategy

| Dataset Size | Strategy | Example |
|-------------|---------|---------|
| < 1,000 rows | Offset pagination | `take: 50, skip: (page - 1) * 50` |
| > 1,000 rows | Cursor-based pagination | `cursor: { id: lastId }, take: 50` |
| Infinite scroll | Cursor-based | `cursor: { id }` on sorted field |

```typescript
// Cursor-based pagination
async findAll(institutionId: string, cursor?: string, limit = 50) {
  return this.prisma.student.findMany({
    where: { institutionId },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}
```

### 19.5 Connection Pooling

Prisma manages the connection pool. For high-concurrency scenarios, tune the connection string:

```
DATABASE_URL="postgresql://user:password@host:5432/db?connection_limit=10&pool_timeout=10"
```

- `connection_limit`: max connections per instance (default: unlimited)
- `pool_timeout`: seconds to wait for a connection before throwing (default: 10s)

### 19.6 Slow Query Detection

The `PrismaService` logs queries exceeding 500ms in development:

```typescript
// src/prisma/prisma.service.ts
if (process.env.NODE_ENV === 'development') {
  this.$on('query', (e: { query: string; duration: number }) => {
    if (e.duration > 500) {
      this.logger.warn(`Query lenta (${e.duration}ms): ${e.query.slice(0, 120)}...`);
    }
  });
}
```

For production, enable PostgreSQL `log_min_duration_statement = 500` in the database config.

### 19.7 Forbidden Performance Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| N+1 query loops | Database overload at scale |
| `ORDER BY random()` on tables with > 1,000 rows | Full table scan every request |
| Missing indexes on `institutionId` | Slow tenant queries |
| Missing indexes on FK fields | Slow JOIN operations |
| Unbounded `findMany()` | Memory exhaustion |
| Overfetching with `include: { all: true }` | Large response payloads, slow serialization |
| Synchronous heavy computation in transactions | Long-held locks, reduced throughput |

---

## 20. Security Rules

### 20.1 Tenant Isolation Guarantees

The database enforces referential integrity via foreign keys. The application layer enforces `institutionId` scoping. **Both layers must be correct:**

```prisma
// Database level: FK prevents orphan records
model Student {
  institutionId String
  institution   Institution @relation(fields: [institutionId], references: [id])

  @@index([institutionId])
}

// Application level: every query must include institutionId
const students = await this.prisma.student.findMany({
  where: { institutionId },  // REQUIRED
});
```

### 20.2 Input Validation Before DB Write

All data entering the database is validated by Zod schemas via `ZodPipe` before reaching services. Services receive fully validated DTOs:

```typescript
// Controller: validates before service call
@Post()
create(
  @Body(new ZodPipe(CreateStudentSchema)) dto: CreateStudentDto,  // Validated here
  @InstitutionId() institutionId: string,
) {
  return this.studentsService.create(dto, institutionId);  // dto is safe
}
```

### 20.3 SQL Injection Prevention

Prisma uses parameterized queries for all operations. Raw SQL requires explicit justification:

```typescript
// Prisma (safe): parameterized automatically
await this.prisma.student.findMany({
  where: { institutionId, documentNumber: { contains: search } },
});

// $queryRaw (requires documentation): also parameterized but bypasses type safety
const result = await this.prisma.$queryRaw`
  SELECT id, first_name FROM students
  WHERE institution_id = ${institutionId}
  AND deleted_at IS NULL
`;
```

### 20.4 Secure Token Storage

- Refresh tokens stored as bcrypt hashes — not reversible
- Password hashes stored with bcrypt cost factor 12 — not reversible
- Never log tokens, hashes, or passwords

### 20.5 Least Privilege Data Access

- Services use `select` to return only needed fields — prevents accidental data exposure
- `passwordHash` is never returned in API responses
- Soft-deleted records are filtered by middleware — not exposed to clients
- `SUPER_ADMIN` role bypasses `institutionId` scoping — verify role checks before sensitive operations

### 20.6 Audit Trail Security

All significant mutations are audited. Audit logs cannot be modified or deleted by application code (only `SUPER_ADMIN` can query `AuditLog` directly).

### 20.7 Forbidden Security Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Unscoped Prisma queries on tenant models | Cross-tenant data leak |
| Raw SQL with string concatenation | SQL injection |
| Logging passwords, tokens, or PII | Privacy violation |
| Storing tokens in plain text | Security violation |
| Bypassing Zod validation for "speed" | Unvalidated data in database |
| Returning `passwordHash` in API responses | Credential exposure |
| Missing `institutionId` filter in `findUnique` | ID enumeration attack |
| Using `req.body.institutionId` instead of `req.institutionId` | Tenant spoofing |

---

## 21. Preferred Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| Prisma-only data access | Never use raw SQL unless documented | `prisma.student.findMany(...)` |
| Middleware soft delete | Automatic `deletedAt` filtering | `PrismaService.$use` middleware |
| Upsert for idempotent writes | Prevents duplicate constraint violations | `prisma.grade.upsert(...)` |
| Transaction for multi-model writes | Atomic consistency | `prisma.$transaction(...)` |
| Explicit field selection | Reduces overfetching | `select: { id, name }` |
| Parallel reads | Reduced latency | `Promise.all([findMany, findMany])` |
| Composite indexes | Optimized query patterns | `@@index([institutionId, documentNumber])` |
| Tenant-scoped unique constraints | Enables same value across institutions | `@@unique([email, institutionId])` |
| Cursor-based pagination | Scalable pagination | `cursor: { id }, take: 50` |
| Queue-based async persistence | Non-blocking operations | Audit, notifications via BullMQ |
| Bcrypt token hashing | Secure token storage | `bcrypt.hash(token, 10)` |
| Partial index for SUPER_ADMIN | Enables cross-tenant admin | `prisma/init.sql` |
| `$queryRaw` with tagged template | Safe parameterized raw SQL | `` `$queryRaw`...${var} `` |
| `runTransaction<T>` helper | Typed transaction wrapper | `prisma.runTransaction(...)` |

---

## 22. Forbidden Patterns

### 22.1 Critical Patterns (Zero Tolerance)

| Forbidden Pattern | Severity | Reason | Prevention |
|------------------|---------|--------|------------|
| Unscoped Prisma queries on tenant models | **Critical** | Cross-tenant data leak | Lint rule + PR review checklist |
| Raw SQL without documented justification | **Critical** | SQL injection risk + Prisma bypass | PR review only |
| Using `PrismaClient` instead of `PrismaService` | **Critical** | Bypasses soft-delete middleware | PR review only |
| Client-supplied `institutionId` in service | **Critical** | Tenant spoofing | PR review only |
| Module-level tenant state | **Critical** | Cross-request contamination | PR review only |
| Hardcoded secrets or credentials | **Critical** | Security violation | Lint rule |

### 22.2 High Severity Patterns

| Forbidden Pattern | Severity | Reason |
|------------------|---------|--------|
| `ORDER BY random()` on tables with > 500 rows | **High** | Full table scan |
| Missing index on `institutionId` + FK combinations | **High** | Slow tenant queries |
| Unbounded `findMany()` without `take` | **High** | Memory exhaustion |
| `findUnique` without `institutionId` check | **High** | ID enumeration |
| Non-idempotent queue processors | **High** | Duplicate notifications |
| Modifying existing Prisma migrations | **High** | Data loss on deployed DBs |
| Adding `NOT NULL` column without default | **High** | Breaks existing rows |
| `Promise.all()` for bulk PDF jobs | **High** | Browser exhaustion |

### 22.3 Medium Severity Patterns

| Forbidden Pattern | Severity | Reason |
|------------------|---------|--------|
| N+1 query loops | **Medium** | Database overload |
| Overfetching with `include: { all: true }` | **Medium** | Slow responses |
| Silently swallowed errors | **Medium** | Makes debugging impossible |
| Using `any` for typed data | **Medium** | Type safety violation |
| Bypassing soft-delete middleware with `$queryRaw` without documentation | **Medium** | Intentional override needs documentation |
| Using `$transaction` without explicit multi-model write reason | **Medium** | Overhead |
| Returning `passwordHash` in API responses | **Medium** | Credential exposure |

### 22.4 Architecture Patterns

| Forbidden Pattern | Reason |
|------------------|--------|
| Business logic in controllers | Makes testing impossible |
| Prisma queries in controllers | Architecture violation |
| Calling `FcmService` directly from services | Bypasses DB persistence |
| Dispatching queue jobs before DB write | Orphaned jobs |
| Creating tables outside Prisma migrations | Schema drift |

---

## 23. Development Workflow Expectations

### 23.1 Before Modifying the Schema

1. **Read the schema** (`backend/prisma/schema.prisma`) — understand existing models, constraints, and relationships
2. **Read `docs/DATABASE.md`** — understand migration patterns, indexing strategy, soft delete rules
3. **Identify affected models** — will the change touch `institutionId`? Soft delete? Relationships?
4. **Plan migration** — additive (safe) or destructive (requires planning)?
5. **Check existing migrations** — avoid naming collisions
6. **Assess impact on `PrismaService` middleware** — if adding a new soft-delete model, update the middleware

### 23.2 Schema Change Process

1. Modify `schema.prisma`
2. Run `npx prisma migrate dev --name descriptive-name`
3. Verify migration applies cleanly
4. Run `npx prisma generate` to regenerate TypeScript client
5. Update `PrismaService` middleware if adding soft-delete model
6. Update any raw SQL queries that reference the changed table
7. Run `npm run lint` and `npm run typecheck`
8. Write unit tests for affected service methods

### 23.3 Query Change Process

1. Verify `institutionId` is included in all `where` clauses
2. Check if indexes exist for the query pattern
3. Verify no N+1 patterns (use `include` or `Promise.all()`)
4. Verify field selection is minimal (use `select`)
5. Verify pagination is applied (use `take`)
6. Run slow query logging in development to verify performance

### 23.4 Backward Compatibility

- Additive changes are safe: new nullable columns, new tables, new indexes
- Destructive changes require a migration plan:
  - Removing a column: deprecate first (add comment in schema), then remove in next release
  - Changing a column type: add new column, migrate data, drop old column
  - Renaming a column: add new column, update code, drop old column
- Never modify existing migration files

### 23.5 Architectural Changes

**Explain the reasoning and wait for confirmation** before implementing changes that:

- Add or remove `institutionId` from a model
- Add or remove soft delete from a model
- Create a new cross-tenant model
- Modify `PrismaService` middleware
- Add raw SQL queries
- Change cascade delete behavior
- Add new unique constraints that affect existing queries

### 23.6 Backward Compatibility Checklist

- [ ] New columns are nullable or have a default
- [ ] No existing code references the removed column
- [ ] Existing queries still work with the new constraint
- [ ] Migration has been tested on a production-like dataset
- [ ] Rollback plan exists for the migration

---

## 24. Validation Checklist

Run this checklist before marking any database change complete.

### 24.1 Multi-Tenancy

- [ ] Every tenant-scoped Prisma query includes `institutionId` in `where`
- [ ] `SUPER_ADMIN` role explicitly checked in services requiring cross-tenant access
- [ ] No `prisma.model.findMany()` without `institutionId` on tenant models
- [ ] No `prisma.model.findFirst()` without `institutionId` on tenant models
- [ ] No `prisma.model.findUnique()` without `institutionId` check (or documented justification)
- [ ] Queue job payloads include `institutionId`
- [ ] Worker Prisma queries use `institutionId` from job payload

### 24.2 Prisma Usage

- [ ] `PrismaService` used (not `PrismaClient`)
- [ ] No raw SQL without documented justification
- [ ] Upsert used for operations with composite unique constraints
- [ ] Transactions used for multi-model writes
- [ ] No N+1 queries (use `include` or `Promise.all()`)
- [ ] Field selection used (`select`) to limit returned data
- [ ] Pagination applied (`take`) on all list queries

### 24.3 Soft Delete

- [ ] Soft-delete models identified (Institution, User, Student, Announcement)
- [ ] `PrismaService` middleware updated if new soft-delete model added
- [ ] No `prisma.model.delete()` on soft-delete models (use `update` with `deletedAt`)
- [ ] `$queryRaw` usage documented and justified (bypasses middleware)

### 24.4 Schema Design

- [ ] New tenant-scoped models include `institutionId` and `@@index([institutionId])`
- [ ] New models include `createdAt` and `updatedAt` timestamps
- [ ] New models include proper `@relation` and `onDelete` behavior
- [ ] New unique constraints use tenant-scoped composite keys
- [ ] Migration is incremental (new migration file, not modified existing)
- [ ] `prisma migrate dev` runs cleanly
- [ ] `prisma generate` runs cleanly
- [ ] No breaking changes to existing API contracts

### 24.5 Transactions

- [ ] Transactions used for all multi-model writes
- [ ] Transaction boundaries are small and focused
- [ ] Non-database operations (API calls, file uploads) not inside transactions
- [ ] Queue dispatch happens after transaction completes

### 24.6 Indexing

- [ ] New FK fields indexed (`@@index`)
- [ ] Composite indexes created for common query patterns
- [ ] `ORDER BY` fields indexed for sorted queries
- [ ] No index on `ORDER BY random()` or low-cardinality columns
- [ ] Existing indexes reviewed for new query patterns

### 24.7 Authentication Data

- [ ] New auth-related models use bcrypt hashing for tokens
- [ ] Refresh tokens not stored in plain text
- [ ] No password hashes in API response types

### 24.8 Authorization Data

- [ ] Role hierarchy respected in queries (`getHighestRole()` used)
- [ ] No hardcoded role comparisons in Prisma queries

### 24.9 Audit Logging

- [ ] All significant mutations dispatch `audit.log` job
- [ ] Audit job dispatched after DB write (not before)
- [ ] Audit payload includes `institutionId`, `userId`, `before`, `after`
- [ ] Audit uses `JOB_OPTIONS.CRITICAL` retry strategy

### 24.10 Performance

- [ ] No `ORDER BY random()` on production tables
- [ ] No unbounded `findMany()` without `take`
- [ ] Slow query logging reviewed for new queries
- [ ] Large result sets paginated

### 24.11 Security

- [ ] No `any` types in Prisma query results
- [ ] No logging of passwords, tokens, or PII
- [ ] Zod validation happens before Prisma writes
- [ ] No client-supplied `institutionId` used in queries
- [ ] `passwordHash` excluded from all `select` clauses in API response paths

### 24.12 Code Quality

- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run typecheck` passes with zero errors
- [ ] No commented-out code or TODOs in PR
- [ ] No new `any` types introduced

---

## 25. Expected Quality Standards

A database change is considered **PR-ready** when:

1. **Compiles**: `npm run typecheck` passes with zero errors
2. **Lints**: `npm run lint` passes with zero warnings
3. **Types**: No `any` introduced anywhere
4. **Tenant-safe**: Every tenant-scoped query scoped with `institutionId`
5. **Indexed**: All FK fields and frequently filtered fields have indexes
6. **Migrated**: New migration created, `prisma generate` runs cleanly
7. **Tested**: Unit tests cover service methods that use the changed schema
8. **Documented**: Complex decisions explained in PR description
9. **Backward-compatible**: No breaking changes to existing API contracts
10. **Audited**: All significant mutations dispatch `audit.log` job
11. **Optimized**: No N+1 queries, no unbounded result sets, no slow queries (>500ms)
12. **Validated**: All input validated via Zod before Prisma writes
13. **Clean**: No commented-out code, TODOs, or placeholder implementations
14. **Secure**: No hardcoded secrets, no exposed credentials, no unscoped queries

---

## Appendix A: Soft-Delete Model Registry

| Model | Has `institutionId` | Soft Delete | Middleware Target | Hard Delete Behavior |
|-------|--------------------|-------------|-------------------|----------------------|
| `Institution` | No (root) | Yes | `findMany`, `findFirst` | Use `update` with `deletedAt` |
| `User` | Yes | Yes | `findMany`, `findFirst` | Use `update` with `deletedAt` |
| `Student` | Yes | Yes | `findMany`, `findFirst` | Use `update` with `deletedAt` |
| `Announcement` | Yes | Yes | `findMany`, `findFirst` | Use `update` with `deletedAt` |
| **All others** | Yes | No | Not applicable | Use `delete()` directly |

**Adding a new soft-delete model:**
1. Add `deletedAt DateTime? @map("deleted_at")` to the model in `schema.prisma`
2. Add the model name to `modelsWithSoftDelete` array in `src/prisma/prisma.service.ts`
3. Run `prisma migrate dev --name add-soft-delete-to-modelname`

---

## Appendix B: PrismaService Middleware Reference

```typescript
// src/prisma/prisma.service.ts — soft-delete middleware (lines 58–82)

const modelsWithSoftDelete = [
  'User',
  'Student',
  'Announcement',
  'Institution',
];

this.$use(async (params, next) => {
  if (
    params.model &&
    modelsWithSoftDelete.includes(params.model) &&
    (params.action === 'findMany' || params.action === 'findFirst')
  ) {
    params.args.where = {
      ...params.args.where,
      deletedAt: null,
    };
  }
  return next(params);
});

// What the middleware DOES NOT affect:
// - findUnique (caller specifies exact ID)
// - create (no filter needed)
// - update/upsert (only active records typically updated)
// - delete (hard delete — use update with deletedAt for soft delete)
// - $queryRaw (bypasses middleware — requires explicit WHERE)
```

---

## Appendix C: Common Prisma Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `P2002` | Unique constraint violation | Throw `ConflictException`; check if `institutionId` scoping is missing |
| `P2025` | Record not found | Throw `NotFoundException`; verify FK references |
| `P2003` | Foreign key violation | Throw `BadRequestException`; parent record doesn't exist |
| `P2011` | Required field missing | Throw `BadRequestException`; validate DTO with Zod before write |
| `P2006` | Invalid field value type | Throw `BadRequestException`; type mismatch in DTO |
| `P2034` | Transaction conflict (deadlock) | Retry with exponential backoff; reduce transaction scope |
| `P2021` | Table does not exist | Run `prisma migrate deploy`; verify migration applied |
| `P2023` | Inconsistent column / missing column | Run `prisma generate`; regenerate TypeScript client |

---

*This document is the authoritative database behavioral guide for AI coding agents operating within the EduSystem repository. It is a specialization of `AGENTS.md` and operates parallel to `agents/backend-agent.md`. All database changes must follow the rules in this document. When in doubt, refer to `docs/DATABASE.md` or escalate to the engineering team.*