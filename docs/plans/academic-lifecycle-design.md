# Academic Lifecycle Design Document

> **Status:** Approved — Final
> **Last updated:** 2026-06-12
> **Classification:** ADR — Academic Domain

---

## Table of Contents

1. [Academic Lifecycle Overview](#part-i--academic-lifecycle-overview)
2. [SchoolYear Lifecycle](#part-ii--schoolyear-lifecycle-formal)
3. [SchoolYear Activation](#part-iii--schoolyear-activation-planning--active)
4. [Period Lifecycle](#part-iv--period-lifecycle)
5. [Academic Closure](#part-v--academic-closure-schoolyear--closed)
6. [Promotion Domain](#part-vi--promotion-domain)
7. [Graduation](#part-vii--graduation)
8. [Academic History](#part-viii--academic-history)
9. [Domain Decisions](#part-ix--domain-decisions)
10. [Implementation Roadmap](#part-x--implementation-roadmap)

---

## Part I — Academic Lifecycle Overview

### Full Lifecycle

```
SchoolYear (PLANNING)
    │  (activation — structure ready)
    ▼
SchoolYear (ACTIVE)
    │
    ├── Period (OPEN)
    │   ├── Grades, Attendance, Indicators, Observations (daily ops)
    │   ├── Per-student × per-subject ClosingGrade (unit close)
    │   └── Bulk close (entire course × period)
    │
    ├── Period (CLOSED)  ── repeat for N periods ──
    │
    ├── PendingSubject lifecycle (if closingScore < 7)
    │   ├── ENROLLED → March → August → November → December → February
    │   └── COMPLETED | NOT_COMPLETED
    │
    ▼
SchoolYear (CLOSED)
    │  (all data frozen, no mutations)
    ▼
Promotion Domain
    ├── PROMOTED   → enroll in next SchoolYear, next LevelGrade
    ├── RETAINED   → enroll in next SchoolYear, same LevelGrade
    └── GRADUATED  → trajectory ends (no new enrollment)
```

### State Meanings

| State | Meaning |
|-------|---------|
| `PLANNING` | SchoolYear exists. Only structural setup allowed. |
| `ACTIVE` | SchoolYear is live. All academic operations permitted. One per institution. |
| `CLOSED` | SchoolYear is finished. All mutations blocked. Read-only. |

---

## Part II — SchoolYear Lifecycle (Formal)

### Schema Addition

```prisma
enum SchoolYearStatus {
  PLANNING
  ACTIVE
  CLOSED
}
```

Add `status SchoolYearStatus @default(PLANNING) @map("status")` to the `SchoolYear` model. Replace `isActive` entirely — single source of truth.

### PLANNING — Permitted Operations

| Operation | Status |
|-----------|--------|
| Create/update/delete Course | ✅ |
| Create/update/delete CourseSubject + assign teacher | ✅ |
| Create/update/delete Period | ✅ |
| Enroll students (create CourseStudent) | ✅ |
| Assign StudentCourseSubject (RECURSE/REGULAR) | ✅ |
| Create Indicators (curriculum) | ✅ |
| **Create Grades** | ❌ BLOCKED |
| **Create Attendance** | ❌ BLOCKED |
| **Create ClosingGrade** | ❌ BLOCKED |
| **Create Convivencia** | ❌ BLOCKED |
| **Create PendingSubject** | ❌ BLOCKED |

### ACTIVE — Permitted Operations

All academic operations permitted. Restrictions:
- Structural changes (Course, CourseSubject, Period) locked in advanced config
- New student enrollment permitted (late enrollment)
- CourseStudent.status changes permitted (transfer, suspension)

### CLOSED — Permitted Operations

| Operation | Status |
|-----------|--------|
| **Read all entities** | ✅ |
| **Create/Update/Delete Grade** | ❌ BLOCKED |
| **Create/Update/Delete ClosingGrade** | ❌ BLOCKED |
| **Create/Update/Delete Attendance** | ❌ BLOCKED |
| **Create/Update/Delete IndicatorEvaluation** | ❌ BLOCKED |
| **Create/Update/Delete Convivencia** | ❌ BLOCKED |
| **Create/Update/Delete Observation** | ❌ BLOCKED |
| **Update PendingSubject** | ❌ BLOCKED |
| **Create/Update/Delete Course** | ❌ BLOCKED |
| **Create/Update/Delete CourseStudent** | ❌ BLOCKED |
| **Create/Update/Delete StudentCourseSubject** | ❌ BLOCKED |
| **Generate reports / Export** | ✅ |
| **View academic history** | ✅ |

---

## Part III — SchoolYear Activation (PLANNING → ACTIVE)

### Preconditions (all mandatory)

| Condition | Why |
|-----------|-----|
| At least 1 Course exists | No courses = empty school year |
| At least 1 Period exists (with valid dates) | No periods = no grading structure |
| All Periods have `startDate < endDate` | Temporal consistency |
| At least 1 CourseSubject per Course | Each course must have subjects |
| All CourseSubjects have a teacher assigned | Every subject needs a responsible teacher |
| At least 1 CourseStudent enrolled | Empty institution is irrelevant |
| No other ACTIVE SchoolYear for this institution | One active year per tenant |
| `startDate` and `endDate` on SchoolYear are set | Temporal boundaries |

### Activation Flow

```
1. Validate all preconditions → throw 400 with details if any fail
2. Set all other SchoolYears' isActive = false
3. Set this SchoolYear: status = ACTIVE, isActive = true
4. Dispatch audit log
```

---

## Part IV — Period Lifecycle

### OPEN Definition

A Period is OPEN when it is in an ACTIVE SchoolYear and no ClosingGrade with `isClosed: true` exists for the specific (student, courseSubject, period) combination. Periods are implicitly OPEN upon creation.

### CLOSED Definition

A Period is CLOSED for a specific (student, courseSubject) when a ClosingGrade exists with `isClosed: true`. Each student-subject pair is closed independently.

### Completeness Validation for ClosingGrade

Before accepting a close:

| Check | Entity | MVP | Phase A | Phase B |
|-------|--------|-----|---------|---------|
| At least 1 grade exists | Grade | ❌ | ✅ | ✅ |
| Attendance minimum | Attendance | ❌ | ❌ | ✅ |
| Indicators evaluated | IndicatorEvaluation | ❌ | ❌ | ✅ (configurable) |

Validation phased to avoid breaking current workflows. Configurable per institution via `Institution.settings`:

```json
{
  "academicClosure": {
    "requireMinimumGrades": false,
    "minimumGradeCount": 1,
    "requireAttendance": false,
    "requireIndicators": false,
    "autoCreatePendingOnFail": true,
    "maxPendingForPromotion": 2,
    "coreSubjects": []
  }
}
```

### Bulk Close

```
POST /periods/:periodId/close-course/:courseId
```

Logic:
1. For each student × courseSubject in the course
2. Validate completeness (per config)
3. Calculate closingScore as average of all grades in the period
4. Upsert ClosingGrade with isClosed: true
5. If closingScore < 7, auto-create PendingSubject (ENROLLED)
6. Return summary: { closed: N, failed: M, pendingCreated: P }

### Reopening Rules

Only ADMIN/DIRECTOR can reopen. Reopen must:
- Set `isClosed: false`
- Record `reopenedAt`, `reopenedById`, `reopenReason`
- If PendingSubject was created from this close, orphan it (delete or mark)

---

## Part V — Academic Closure (SchoolYear → CLOSED)

### Conditions (all mandatory)

| Condition | Validation |
|-----------|------------|
| All Periods closed for all students × subjects | `count(ClosingGrade where isClosed=false AND schoolYear.id = X) = 0` |
| No open PendingSubjects | `count(PendingSubject where status = ENROLLED AND schoolYearId = X) = 0` |
| All PendingSubjects resolved | All are COMPLETED or NOT_COMPLETED |

PendingSubjects in ENROLLED status **block SchoolYear Closure**. This is intentional — the year cannot be frozen with unresolved intensification.

### Freeze Implementation

**Approach: NestJS Guard.** New `SchoolYearStatusGuard` — reads `req.institutionId`, finds the ACTIVE SchoolYear, checks its status, and blocks mutations on entities belonging to CLOSED SchoolYears. Explicit, testable, follows existing patterns (OnLeaveGuard).

### Freeze Rules Detail

| Entity | FK to SchoolYear | Freeze behavior |
|--------|-----------------|-----------------|
| Grade | via Period → SchoolYear | BLOCK create/update/delete |
| ClosingGrade | via Period → SchoolYear | BLOCK create/update |
| Attendance | via Course → SchoolYear | BLOCK create/update/delete |
| IndicatorEvaluation | via Period → SchoolYear | BLOCK create/update/delete |
| Convivencia | via Course → SchoolYear | BLOCK create/update/delete |
| StudentObservation | via Period → SchoolYear | BLOCK create/update/delete |
| PendingSubject | direct FK | BLOCK update |
| Course | direct FK | BLOCK update/delete |
| CourseStudent | via Course → SchoolYear | BLOCK create/update/delete |
| StudentCourseSubject | direct FK | BLOCK create/update/delete |

---

## Part VI — Promotion Domain

### PromotionResult Domain Model

`PromotionResult` is a **core domain entity**, not merely an audit record. It is the official record of every student's academic transition between school years.

```prisma
enum PromotionOutcome {
  PROMOTED
  RETAINED
  GRADUATED
}

model PromotionResult {
  id                  String   @id @default(uuid())

  studentId           String
  fromSchoolYearId    String
  toSchoolYearId      String?

  fromCourseStudentId String
  toCourseStudentId   String?

  result              PromotionOutcome

  criteria            Json     // snapshot of rules applied at decision time

  reason              String?  // justification for manual overrides

  decidedById         String
  decidedAt           DateTime

  isOverride          Boolean  @default(false)

  student              Student       @relation(fields: [studentId], references: [id])
  fromSchoolYear       SchoolYear    @relation("PromotionFrom", fields: [fromSchoolYearId], references: [id])
  toSchoolYear         SchoolYear?   @relation("PromotionTo", fields: [toSchoolYearId], references: [id])
  fromCourseStudent    CourseStudent @relation(fields: [fromCourseStudentId], references: [id])
  toCourseStudent      CourseStudent? @relation(fields: [toCourseStudentId], references: [id])
  decidedBy            User          @relation(fields: [decidedById], references: [id])

  @@index([studentId])
  @@index([fromSchoolYearId])
  @@index([toSchoolYearId])
  @@map("promotion_results")
}
```

### Objectives

- Register PROMOTED / RETAINED / GRADUATED outcomes
- Preserve snapshot of rules applied at decision time
- Allow manual overrides with reason
- Provide full academic traceability
- Serve as official source for statistics and reports
- Serve as official source for graduation date (derived)

### Promotion Process Flow

```
For each CourseStudent in the closing SchoolYear:
  1. Check all ClosingGrades for this student
  2. Check all PendingSubjects for this student
  3. Apply promotion rules → determine PROMOTED / RETAINED / GRADUATED
  4. Determine target LevelGrade via progression mapping
     a. PROMOTED → nextLevelGradeId (may cross education levels)
     b. RETAINED → same LevelGrade
     c. GRADUATED → no target (last LevelGrade with isGraduating = true)
  5. If PROMOTED or RETAINED:
     - Find or create destination Course in target SchoolYear
     - Create new CourseStudent
     - Copy REGULAR StudentCourseSubject assignments
  6. Create PromotionResult with full snapshot
  7. Dispatch audit log
```

### Progression Mapping

```prisma
model LevelGrade {
  // ... existing fields
  nextLevelGradeId       String?  @map("next_level_grade_id")
  nextEducationLevelId   String?  @map("next_education_level_id")
  isGraduating           Boolean  @default(false) @map("is_graduating")

  nextLevelGrade       LevelGrade?     @relation("LevelGradeProgression", fields: [nextLevelGradeId], references: [id])
  nextEducationLevel   EducationLevel? @relation(fields: [nextEducationLevelId], references: [id])
}
```

- `nextLevelGradeId = null` + `isGraduating = true` → student graduates
- `nextLevelGradeId` → next grade within same level (2°→3°)
- `nextEducationLevelId` crosses levels (6° Primaria→1° Secundaria)
- `displayOrder` remains for UI ordering only

### RECURSE vs RETAINED

| Concept | Scope | Timing | Effect |
|---------|-------|--------|--------|
| RECURSE | Per-subject | During ACTIVE year | Student takes subject with different group |
| RETAINED | Full year | Promotion result | Student repeats entire year in new SchoolYear |

RETAINED is a `PromotionResult` outcome, not a `CourseStudent` status. `CourseStudent` remains `ACTIVE` for the completed year; the repetition is recorded as a new enrollment in a new year with the same LevelGrade.

### Manual Override

ADMIN/DIRECTOR can override automatic promotion via:

```
POST /promotion/override
{
  studentId,
  fromSchoolYearId,
  result: PROMOTED | RETAINED | GRADUATED,
  reason: "Justificación obligatoria"
}
```

Creates a `PromotionResult` with `isOverride: true`.

---

## Part VII — Graduation

### Conditions

A student graduates when:
1. They complete the last LevelGrade of their EducationLevel
2. LevelGrade has `isGraduating = true` and `nextLevelGradeId = null`
3. The SchoolYear is CLOSED
4. Promotion rules determine PROMOTED

### Representation

Graduation is recorded as a `PromotionResult` with `result: GRADUATED`. The graduating year's `CourseStudent.status` is set to `GRADUATED`.

### Graduation Date

Derived from `PromotionResult.decidedAt` where `result = GRADUATED` (most recent). No `graduatedAt` field on `Student` — data is fully derivable.

### Transcript / Certificate

- All historical data remains readable via Academic History
- Student trajectory is complete — no further SchoolYears needed
- Reports filter on `PromotionResult.result === GRADUATED` for alumni lists

---

## Part VIII — Academic History

### Display Requirements

| Section | Data Source | Filter |
|---------|-------------|--------|
| Years attended | SchoolYear (via CourseStudent → Course → SchoolYear) | All where student had CourseStudent |
| Courses per year | Course (via CourseStudent) | By SchoolYear |
| Final scores per subject | ClosingGrade | By SchoolYear, grouped by CourseSubject |
| Grades detail | Grade | By SchoolYear + Period + CourseSubject |
| Attendance summary | Attendance | By SchoolYear, aggregated % |
| Indicators | IndicatorEvaluation | By SchoolYear + Period |
| PendingSubjects | PendingSubject | By SchoolYear |
| Convivencias | Convivencia | By SchoolYear |
| Observations | StudentObservation | By SchoolYear |
| Promotion result | PromotionResult | Between SchoolYears |

### Historical Data Integrity

All data is frozen by SchoolYear CLOSED state. No special archival mechanism needed.

### Query Pattern

```
GET /students/:id/history?include=grades,attendance,pending,promotion
```

Response grouped by SchoolYear with PromotionResult between years.

---

## Part IX — Domain Decisions

### D1: Grade Progression — Explicit Mapping (APPROVED)

```prisma
nextLevelGradeId       String?
nextEducationLevelId   String?
isGraduating           Boolean
```

Handles normal progression, level changes, and graduation. `displayOrder` for UI only.

### D2: Repetition — PromotionResult (APPROVED)

RETAINED lives in `PromotionResult.outcome`. `CourseStudent.status` remains unchanged.

### D3: PendingSubject Impact (APPROVED)

ENROLLED status blocks: (1) SchoolYear Closure, (2) Promotion Execution.

Sequence:

```
PendingSubjects resolved (COMPLETED | NOT_COMPLETED)
        ↓
SchoolYear CLOSED (data frozen)
        ↓
Promotion Process → PromotionResult
```

### D4: Graduation Date — Derived (APPROVED)

No `Student.graduatedAt`. Derive from latest `PromotionResult` with `result = GRADUATED`.

### D5: SchoolYear Status — Replaces isActive (APPROVED)

Single source of truth: `status: PLANNING | ACTIVE | CLOSED`.

### D6: Bulk Close — Primary UX Path (APPROVED)

Course×Period bulk close is the primary flow. Individual close is fallback.

---

## Part X — Implementation Roadmap

### Phase 1 — SchoolYear Status Enum

**Dependencies:** None

**Scope:**
- `SchoolYearStatus` enum
- `status` field on SchoolYear
- Migration: `isActive=true → ACTIVE`, `isActive=false → PLANNING`
- Update `createSchoolYear()` → PLANNING
- Update `setActiveSchoolYear()` → validate preconditions

### Phase 2 — Period Completeness + Bulk Close

**Dependencies:** Phase 1

**Scope:**
- Institution-level config for completeness rules
- `ClosingGradeValidator` (grade count, attendance, indicators)
- Bulk close: course × period
- Auto-create PendingSubject on score < 7

### Phase 3 — SchoolYear Freeze Guard

**Dependencies:** Phase 1

**Scope:**
- `SchoolYearStatusGuard` — blocks mutations on CLOSED year entities
- Allow-list for reads
- Add CLOSED transition endpoint

### Phase 4 — SchoolYear Closure

**Dependencies:** Phases 2, 3

**Scope:**
- `POST /school-years/:id/close`
- Validate all Periods closed, all PendingSubjects resolved
- Set `status = CLOSED`
- Dispatch audit

### Phase 5 — Promotion Domain

**Dependencies:** Phase 4

**Scope:**
- `PromotionOutcome` enum
- `PromotionResult` model + migration
- Progression mapping: `nextLevelGradeId`, `nextEducationLevelId`, `isGraduating`
- `PromotionService` — rules engine
- Manual override endpoint
- Enrollment creation in target SchoolYear
- `CourseStudent.status = GRADUATED` on graduation

### Phase 6 — Academic History

**Dependencies:** Phase 3 (CLOSED years must exist)

**Scope:**
- `GET /students/:id/history` endpoint
- Cross-SchoolYear aggregation
- Frontend history page
- Frozen data read-only display

---

## Summary of Schema Changes

| Model | New Field | Type | Purpose |
|-------|-----------|------|---------|
| `SchoolYear` | `status` | `SchoolYearStatus` | PLANNING / ACTIVE / CLOSED |
| `LevelGrade` | `nextLevelGradeId` | `String?` | Explicit progression |
| `LevelGrade` | `nextEducationLevelId` | `String?` | Cross-level progression |
| `LevelGrade` | `isGraduating` | `Boolean` | Last grade marker |
| `PromotionResult` | (full model) | — | Core promotion entity |

## New Enums

| Enum | Values |
|------|--------|
| `SchoolYearStatus` | `PLANNING`, `ACTIVE`, `CLOSED` |
| `PromotionOutcome` | `PROMOTED`, `RETAINED`, `GRADUATED` |

## Removed from Design

| Item | Reason |
|------|--------|
| `EnrollmentStatus.RETAINED` | Repetition belongs in PromotionResult |
| `Student.graduatedAt` | Derivable from PromotionResult |
| `isActive` as separate field | Replaced by status enum |

---

**Final — Approved for implementation.**
