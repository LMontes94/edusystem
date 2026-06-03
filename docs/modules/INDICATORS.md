# Indicators Module

> **Module:** `indicators`
> **Location:** `backend/src/modules/indicators/`
> **Last Updated:** 2026-06-03

---

## Overview

The Indicators module manages curriculum-based academic tracking: skill/learning-goal indicators, per-student qualitative evaluations, and free-text pedagogical observations. No model in this module carries a direct `institutionId` — tenant isolation is enforced via indirect joins.

---

## CASL Subjects

| Subject | Description |
|---------|-------------|
| `Indicator` | Curriculum indicators (skills/learning goals) |
| `IndicatorEvaluation` | Qualitative evaluations per student per indicator |
| `StudentObservation` | Free-text pedagogical observations |

### Permission Matrix

| Role | `Indicator` | `IndicatorEvaluation` | `StudentObservation` |
|------|-------------|----------------------|----------------------|
| SUPER_ADMIN | Manage | Manage | Manage |
| ADMIN | Manage | Manage | Manage |
| DIRECTOR | Manage | Manage | Manage |
| SECRETARY | Read | No Access | Manage |
| PRECEPTOR | Read | No Access | Manage |
| TEACHER | Read | Create + Update | Create + Read + Update |
| GUARDIAN | Read | No Access | Read |

---

## Tenant Validation

No model has `institutionId` directly. Tenant ownership is resolved through joins:

```
Indicator               → Subject          → Institution
IndicatorEvaluation     → Indicator        → Subject → Institution
StudentObservation      → Course           → Institution
```

All endpoints receive `@InstitutionId()` from the request context. Service helpers perform validation before any mutation.

---

## Audit Events

All mutations dispatch a BullMQ job to the `audit-log` queue. The `AuditProcessor` and `AuditLogPayload` were not modified; no Prisma migrations were required.

| Event | Action | Resource |
|-------|--------|----------|
| Create indicator | `CREATE` | `Indicator` |
| Update indicator | `UPDATE` | `Indicator` |
| Delete indicator | `DELETE` | `Indicator` |
| Reorder indicators | `UPDATE` | `Indicator` |
| Bulk evaluation upsert | `UPDATE` | `IndicatorEvaluation` |
| Create observation | `CREATE` | `StudentObservation` |
| Update observation | `UPDATE` | `StudentObservation` |

### REORDER Event

The reorder event is identifiable by `after.operation === "REORDER"` in the persisted `after` JSON:

```json
{
  "resourceId": "<subject-uuid>",
  "before": {
    "reorderedIds": ["id1", "id2", "id3"]
  },
  "after": {
    "operation": "REORDER",
    "reorderedIds": ["id3", "id1", "id2"]
  }
}
```

- `resourceId` references a real domain resource (`subjectId`).
- `before.reorderedIds` preserves the previous order for traceability.
- `after.operation === "REORDER"` distinguishes this event from a generic `UPDATE`.

---

## Validation Rules

### Tenant Validation (Bulk)

All `indicatorIds` received in `bulkUpsertEvaluations` are validated before any write:

- If any indicator does not exist → `NotFoundException("Algunos indicadores no existen")`
- If any indicator belongs to a different institution → `NotFoundException("Algunos indicadores no pertenecen a esta institución")`
- The entire batch is rejected — no partial mutations occur.

### Teacher Ownership (Bulk Evaluations)

When the requesting user has role `TEACHER`:

- All affected `subjectId` values are validated against `CourseSubject.teacherId`.
- If any subject is not taught by the teacher → `ForbiddenException("No tenés permisos para algunas evaluaciones")`.
- Validation occurs before any upsert.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/indicators` | List indicators (filtered by `subjectId`, `schoolYearId`, `grade`) |
| `GET` | `/indicators/:id` | Get single indicator |
| `POST` | `/indicators` | Create indicator |
| `PATCH` | `/indicators/:id` | Update indicator |
| `DELETE` | `/indicators/:id` | Delete indicator |
| `POST` | `/indicators/reorder` | Reorder indicators (batch order update) |
| `POST` | `/indicators/bulk-evaluations` | Bulk upsert indicator evaluations |
| `POST` | `/indicators/observations` | Create a student observation |
| `GET` | `/indicators/observations` | List observations (filtered by `studentId`, `periodId`, `courseId`) |
| `PATCH` | `/indicators/observations/:id` | Update a student observation |

---

## Verification

- `npx nest build` — exitoso
- `npx tsc --noEmit` — exitoso
- No Prisma migrations required
- No changes to `AuditProcessor`
- No changes to `AuditLogPayload`
