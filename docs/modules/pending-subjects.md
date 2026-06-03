# PendingSubjects Module — Materias Pendientes

> **Version:** 1.0 | **Last updated:** 2026-06-02

---

## 1. Overview

The PendingSubjects module tracks students who have failed a subject ("materia pendiente" / "materia previa") and need to complete an intensification process to accredit it. It operates on a special calendar (March → August → November → December → February) distinct from the standard school periods.

Key concepts:
- **PendingSubject**: A record linking a student to a failed subject in a specific school year.
- **Intensification**: The process by which a student retakes evaluations for a pending subject across up to 5 evaluation periods.
- **Accreditation**: The final outcome — the student either passes (COMPLETED) or does not (NOT_COMPLETED).

---

## 2. Domain Model

### 2.1 PendingSubject Status (`PendingSubjectStatus`)

| Value | Meaning | Terminal? |
|-------|---------|-----------|
| `ENROLLED` | Student is enrolled in intensification | No |
| `COMPLETED` | Student accredited the subject | Yes |
| `NOT_COMPLETED` | Student did not accredit | Yes |

### 2.2 Intensification Result (`IntensificationResult`)

Each evaluation period (march/august/november/december/february) receives one of three statuses:

| Value | Label | Meaning |
|-------|-------|---------|
| `AA` | Acreditación Automática | Student passed autonomously |
| `CCA` | Cursada para Completar Aprendizajes | Student needs guided study |
| `CSA` | Cursado Sin Aprobar | Student attended but did not pass |

These are validated server-side via `IntensificationResultSchema` (`z.enum(['AA','CCA','CSA'])`).

### 2.3 Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `initialSabers` | `string?` | Initial knowledge assessment |
| `march`, `august`, `november`, `december`, `february` | `string?` | AA/CCA/CSA per intensification period |
| `finalScore` | `string?` | Textual final result (e.g., "APROBADO") |
| `closingSabers` | `string?` | Final knowledge assessment |
| `closingGradeId` | `string?` | Optional 1:1 link to ClosingGrade |
| `status` | `PendingSubjectStatus` | ENROLLED / COMPLETED / NOT_COMPLETED |

---

## 3. States & Lifecycle

```
ENROLLED ──► COMPLETED (acreditó)
    │
    └────► NOT_COMPLETED (no acreditó)
```

- A PendingSubject is created in `ENROLLED` status.
- Teachers update intensification scores across periods.
- When the process ends, status transitions to `COMPLETED` or `NOT_COMPLETED`.
- No transitions are allowed from terminal states.

---

## 4. Institution Configuration

Configured in `Institution.settings.pendingSubjects`:

```typescript
interface PendingSubjectsConfig {
  enabled: boolean;                        // Master toggle for the feature
  activeIntensificationPeriod: string;     // Current period: "march" | "august" | "november" | "december" | "february"
  allowPreviousPeriodEditing: boolean;     // Allow editing periods before activeIntensificationPeriod
}
```

### Effect of Configuration

| Setting | `enabled === false` | `enabled === true` |
|---------|--------------------|--------------------|
| Create PendingSubject | Forbidden (403) | Allowed (TEACHER+) |
| Update status | Forbidden (403) | Allowed (TEACHER+) |
| Update progress | Forbidden (403) | Allowed (period rules apply) |
| Delete | Forbidden (403) | Allowed (TEACHER+, no Delete for TEACHER per CASL) |
| Read | Allowed (TEACHER+) | Allowed (TEACHER+) |

---

## 5. Period Edition Rules

`PendingSubjectsService.validatePeriodEdition()` enforces the following rules:

| Period | Relative to active | Editable? |
|--------|-------------------|-----------|
| `activeIntensificationPeriod` | Active | **Always** |
| Periods before active | Past | Only if `allowPreviousPeriodEditing === true` |
| Periods after active | Future | **Never** (ForbiddenException) |

**Detection:** `getModifiedPeriods()` compares each DTO field against the existing DB value. Only fields that differ trigger the edition check.

**Example — active = `november`:**

```
march (past, idx=0)    → editable if allowPreviousPeriodEditing = true
august (past, idx=1)   → editable if allowPreviousPeriodEditing = true
november (active, idx=2) → always editable
december (future, idx=3) → NEVER editable
february (future, idx=4) → NEVER editable
```

---

## 6. API Surface

All PendingSubject endpoints live in `TeacherController` (`/teacher`):

| Method | Path | CASL Action | Description |
|--------|------|-------------|-------------|
| `POST` | `/teacher/pending` | `Create` | Create PendingSubject for a student+subject |
| `GET` | `/teacher/pending/student/:studentId` | `Read` | List pending subjects by student |
| `GET` | `/teacher/pending/eligible-subjects/:studentId` | `Read` | List subjects eligible for pending |
| `PATCH` | `/teacher/pending/update-status` | `Update` | Change status (ENROLLED → COMPLETED/NOT_COMPLETED) |
| `PATCH` | `/teacher/pending/update-progress` | `Update` | Update intensification period scores |
| `DELETE` | `/teacher/pending/:studentId/:subjectId` | `Delete` | Remove a PendingSubject |

All endpoints are scoped by `institutionId` from the JWT.

---

## 7. Security

### 7.1 CASL Subject: `'PendingSubject'`

Registered in `casl.types.ts` union type. Permissions by role:

| Role | Permission |
|------|-----------|
| SUPER_ADMIN | Manage (full CRUD across all tenants) |
| ADMIN | Manage |
| DIRECTOR | Manage |
| SECRETARY | Read |
| PRECEPTOR | Read |
| TEACHER | Create, Read, Update (no Delete) |
| GUARDIAN | No explicit rule — inherits `can(Read, 'all')` |

### 7.2 Guard Stack

All endpoints pass through:
1. `TenantMiddleware` — extracts `institutionId` from JWT
2. `JwtAuthGuard` — verifies JWT signature, loads user
3. `OnLeaveGuard` — blocks mutations when user is ON_LEAVE
4. `CaslGuard` — checks `@CheckAbility()` decorator

### 7.3 Additional Validation

- `validateEnabled()` — returns 403 if `enabled === false`
- `validatePeriodEdition()` — returns 403 if period is not editable
- Cross-tenant checks: `pendingSubject.institutionId` must match the request's `institutionId`

---

## 8. Multi-Tenancy

- All Prisma queries filter by `institutionId`.
- `PendingSubjectsService` receives `institutionId` from the controller (via `@InstitutionId()` decorator).
- Cross-tenant data access is prevented by entity match validation.
- Queue jobs (audit) include `institutionId` in the payload.

---

## 9. Audit

After every mutation, `TeacherService` dispatches an `audit.log` job with `JOB_OPTIONS.CRITICAL`:

| Operation | Payload |
|-----------|---------|
| Create | `action: 'CREATE'`, `after: newPendingSubject` |
| Update status | `action: 'UPDATE'`, `before/after` snapshots |
| Update progress | `action: 'UPDATE'`, `before/after` period fields |
| Delete | `action: 'DELETE'`, `before: deletedPendingSubject` |

Jobs are dispatched with `this.auditQueue.add()` and caught to prevent blocking the mutation.

---

## 10. Key Files

| File | Purpose |
|------|---------|
| `backend/src/modules/pending-subjects/pending-subjects.service.ts` | Period validation, config read |
| `backend/src/modules/pending-subjects/pending-subjects.module.ts` | Module registration |
| `backend/src/modules/teacher/teacher.service.ts` | CRUD operations, queue dispatch |
| `backend/src/modules/teacher/teacher.controller.ts` | HTTP endpoints |
| `backend/src/modules/teacher/dto/teacher.dto.ts` | `IntensificationResultSchema`, DTOs |
| `backend/src/modules/casl/casl-ability.factory.ts` | CASL rules for PendingSubject |
| `backend/src/modules/casl/casl.types.ts` | `'PendingSubject'` in Subjects union |
| `backend/src/modules/institutions/dto/institution.dto.ts` | `pendingSubjects` in settings |
| `backend/prisma/schema.prisma` | `PendingSubject` model, `PendingSubjectStatus` enum |
| `frontend/src/app/admin/pending/page.tsx` | Pending subjects management page |
| `frontend/src/app/admin/pending/_components/pending.types.ts` | Frontend types, getPeriodStatus() |
| `frontend/src/app/admin/settings/page.tsx` | Institution config — PendingSubjectsTab |
| `frontend/src/lib/api/institution.ts` | `PendingSubjectsConfig` interface |

---

## 11. Related Documentation

- `docs/DATABASE.md` §12 — PendingSubject schema and constraints
- `docs/MULTITENANCY.md` §9.2, §9.3, §11 — Tenant isolation and CASL rules
- `docs/ARCHITECTURE.md` §4 — Module registry
- `AGENTS.md` §23 — Preferred patterns for pending subjects
