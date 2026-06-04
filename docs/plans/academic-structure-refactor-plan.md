# Academic Structure Refactor Plan

> **Status:** Approved for implementation
> **Last updated:** 2026-06-03
> **Classification:** Internal — Engineering

---

## Table of Contents

1. [Current Problem](#1-current-problem)
2. [Objectives](#2-objectives)
3. [Proposed Domain Design](#3-proposed-domain-design)
4. [MVP Scope](#4-mvp-scope)
5. [Changes to Existing Models](#5-changes-to-existing-models)
6. [Domain Invariants](#6-domain-invariants)
7. [Deletion Rules](#7-deletion-rules)
8. [Subject ↔ EducationLevel — Design Decision](#8-subject---educationlevel--design-decision)
9. [Backend Impact](#9-backend-impact)
10. [Frontend Impact](#10-frontend-impact)
11. [Hidden Dependencies](#11-hidden-dependencies)
12. [Migration Strategy](#12-migration-strategy)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Effort Estimate](#14-effort-estimate)

---

## 1. Current Problem

The system has three hardcoded academic dimensions that cannot be configured per institution.

### 1.1 `Level` enum

```prisma
enum Level {
  INICIAL
  PRIMARIA
  SECUNDARIA
}
```

Defined at `schema.prisma:29`. Used in four models and multiple frontend locations. Adding a new level (e.g., `TECNICA`, `ADULTOS`) requires:
- Prisma schema change + migration
- Backend Zod schema updates in DTOs
- Frontend type updates
- Frontend label/color maps
- Navigation and report filter logic

### 1.2 Numeric `grade` field

`Course.grade` is a raw `Int` with no validation per level. The DTO constrains `1..12` regardless of level. Problems:
- PRIMARIA should only accept grades 1–6, SECUNDARIA 1–5, TÉCNICA 1–7
- INICIAL has no numeric grades (Sala de 3, Sala de 4, Sala de 5)
- No way to map "grade 1" to a display name ("1° grado")

### 1.3 Hardcoded grade list in frontend

`indicators-filters.tsx:17`:
```typescript
const GRADES = [1, 2, 3, 4, 5, 6, 7];
```

This assumes a single grade range regardless of level.

---

## 2. Objectives

| # | Objective | Success criteria |
|---|-----------|-----------------|
| 1 | Per-institution education levels | Each institution defines its own levels |
| 2 | Per-level grade ranges | Each level defines which grades it includes |
| 3 | Non-numeric grade support | Inicial can have "Sala de 3", "Sala de 4", "Sala de 5" without numeric grade |
| 4 | Backward compatibility | Existing data migrates; API evolves without breaking consumers |
| 5 | Frontend dynamism | Dropdowns for level/grade populated from API, not hardcoded |
| 6 | Multi-tenant isolation | All configuration is per-institution, no global catalogs |

---

## 3. Proposed Domain Design

### 3.1 EducationLevel

Replaces the `Level` enum. Each institution defines its own set of levels.

```prisma
enum EducationLevelStatus {
  ACTIVE
  INACTIVE
}

model EducationLevel {
  id            String   @id @default(uuid())
  institutionId String
  name          String   @db.VarChar(100)
  order         Int      @default(0)
  status        EducationLevelStatus @default(ACTIVE)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  institution  Institution @relation(fields: [institutionId], references: [id], onDelete: Cascade)
  grades       LevelGrade[]
  userRoles    UserLevelRole[]
  commSettings InstitutionLevelCommunicationSettings[]
  chatRooms    ChatRoom[]

  @@unique([institutionId, name])
  @@index([institutionId])
  @@map("education_levels")
}
```

### 3.2 LevelGrade

Represents a specific year or grade within an education level. Replaces the numeric `grade` on `Course` and `Indicator`.

```prisma
model LevelGrade {
  id               String   @id @default(uuid())
  educationLevelId String
  number           Int?     @db.SmallInt     // null for non-numeric levels (Inicial)
  name             String   @db.VarChar(50)  // "1°", "Sala de 3", "Primero"
  order            Int      @default(0)
  status           EducationLevelStatus @default(ACTIVE)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  educationLevel EducationLevel @relation(fields: [educationLevelId], references: [id], onDelete: Cascade)
  courses        Course[]
  indicators     Indicator[]

  @@unique([educationLevelId, number])
  @@unique([educationLevelId, name])
  @@index([educationLevelId])
  @@map("level_grades")
}
```

### 3.3 Out of scope (explicitly excluded)

- `LevelCycle` / `GradeCycle` — no cycle entities in MVP
- Cycle-based reports or filtering
- Grade-independent indicators

---

## 4. MVP Scope

| In scope | Out of scope (future) |
|----------|----------------------|
| `EducationLevel` model | `LevelCycle` / `GradeCycle` |
| `LevelGrade` model | Grade-independent indicators |
| Course: `levelGradeId` replaces `grade` + `level` | Multi-grade indicator `OR` filtering |
| Indicator: `levelGradeId` replaces `grade` | Advanced level metadata (colors, descriptions) |
| UserLevelRole: `educationLevelId` replaces `level` | Institution-clonable structure templates |
| ChatRoom: `educationLevelId` replaces `level` | Cycle-based report grouping |
| `InstitutionLevelCommunicationSettings`: `educationLevelId` replaces `level` | Bulk import/export |
| Seed defaults on institution creation | API versioning (old params accepted throughout) |
| Backfill script for existing institutions | Subject ↔ Level association |
| Admin UI: Configuración → Estructura Académica | |

---

## 5. Changes to Existing Models

### 5.1 Course

```
REMOVE: grade  Int      (SmallInt)
REMOVE: level  Level    (enum)
ADD:    levelGradeId String (required, FK → LevelGrade)

KEEP (deprecated, dual-write during transition):
  grade (Int, deprecated)
  level (Level, deprecated)
```

The education level is derived through the relation chain:

```
Course → LevelGrade → EducationLevel
```

`Course` does **not** store `educationLevelId` directly. This avoids redundant state and synchronization invariants.

### 5.2 Indicator

```
REMOVE: grade        Int?  (SmallInt)
ADD:    levelGradeId String (required, FK → LevelGrade)
```

Indicators remain grade-specific in the MVP. No grade-independent indicators are included.

### 5.3 UserLevelRole

```
REMOVE: level           Level  (enum)
ADD:    educationLevelId String (required, FK → EducationLevel)
```

### 5.4 ChatRoom

```
KEEP:  level           Level?  (enum, deprecated)
ADD:   educationLevelId String? (nullable, FK → EducationLevel)
```

### 5.5 InstitutionLevelCommunicationSettings

```
REMOVE: level           Level  (enum)
ADD:    educationLevelId String (required, FK → EducationLevel)

@@unique([institutionId, educationLevelId])  // replaces [institutionId, level]
```

### 5.6 Level enum

After all references are migrated, remove from Prisma schema entirely.

---

## 6. Domain Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | A `LevelGrade` belongs to exactly one `EducationLevel` | `levelGrade.educationLevelId` is required (NOT NULL). Cascade delete from `EducationLevel`. |
| 2 | A `Course` belongs to exactly one `LevelGrade` | `course.levelGradeId` is required (NOT NULL). The education level is derived transitively. |
| 3 | An `Indicator` belongs to exactly one `LevelGrade` | `indicator.levelGradeId` is required (NOT NULL). Every indicator is grade-specific. |
| 4 | A `UserLevelRole` is scoped to exactly one `EducationLevel` | `userLevelRole.educationLevelId` is required (NOT NULL). |
| 5 | `InstitutionLevelCommunicationSettings` is scoped to exactly one `EducationLevel` | `commSettings.educationLevelId` is required (NOT NULL). |
| 6 | `ChatRoom` can optionally scope to an `EducationLevel` | `chatRoom.educationLevelId` is nullable. |
| 7 | EducationLevels with dependencies cannot be deleted | Application-layer check. Deactivation always allowed. |
| 8 | LevelGrades with dependencies cannot be deleted | Application-layer check. Deactivation always allowed. |

---

## 7. Deletion Rules

### 7.1 EducationLevel

**Blocked if:**
- Any `LevelGrade` referencing this level has `Course` or `Indicator` dependencies
- Any `UserLevelRole` references this level
- Any `InstitutionLevelCommunicationSettings` references this level
- Any `ChatRoom` references this level with a non-null FK

**Alternative:** Set `status = INACTIVE`. This hides the level from creation/edit dropdowns while preserving all existing relationships.

### 7.2 LevelGrade

**Blocked if:**
- Any `Course` references this grade
- Any `Indicator` references this grade

**Alternative:** Set `status = INACTIVE`.

### 7.3 General principle

> Deactivate instead of delete.

Existing relationships must remain intact. Deactivation is the supported strategy for lifecycle management.

---

## 8. Subject ↔ EducationLevel — Design Decision

### 8.1 Evaluation

It was evaluated whether `Subject` should be associated with one or more `EducationLevel` to restrict invalid assignments and improve filtering.

**Arguments for:**
- Prevents assigning a Primaria subject to a Secundaria course
- Cleaner subject catalog per level
- Better filtering in admin UI

**Arguments against:**
- Many subjects are conceptually cross-level (institutions already differentiate via naming: "MAT-PRIM" vs "MAT-SEC")
- CourseSubject already acts as the assignment validator
- Existing subjects need backfill
- Cross-level subjects become awkward (nullable FK)

### 8.2 Decision

**No schema changes to `Subject` or `CourseSubject`.**

This proposal is intentionally excluded from this refactor because it does not solve the current problem and would introduce additional migration complexity.

The decision may be revisited in the future if institutions require level-based subject validation or filtering.

---

## 9. Backend Impact

### 9.1 Modules requiring changes

| Module | Change | Risk |
|--------|--------|------|
| **Courses** | DTOs: replace `grade` + `level` with `levelGradeId`. Service: create/update/findAll accept new field. Keep deprecated params during transition. | High |
| **Indicators** | DTO: replace `grade` with `levelGradeId`. Service: filter by `levelGradeId`. `getCourseEvaluations()`: derive from `course.levelGradeId`. | High |
| **Auth/Users** | `UserLevelRole` DTO: replace `level` enum with `educationLevelId`. | Medium |
| **Chat** | `ChatRoom`: add nullable `educationLevelId`. `resolveRoomLevel()`: read `course.levelGrade.educationLevelId` and `userLevelRole.educationLevelId`. Fallback `'PRIMARIA'` → null or first active level. | Medium |
| **Reports** | All `course.grade` / `course.level` → `course.levelGrade.name` / `course.levelGrade.educationLevel.name`. `resolvePeriodAggregation()` key: enum → `educationLevel.name`. `DEFAULT_AGGREGATION` keys: update. Report types: `level: string` → `educationLevelName: string`. | Medium |
| **Institution settings** | Communication settings composite key changes from `[institutionId, level]` to `[institutionId, educationLevelId]`. | Low |

### 9.2 Modules with zero impact

| Module | Reason |
|--------|--------|
| Grades | No grade/level fields on Grade model. Filters are relational. |
| ClosingGrades | Same as Grades. |
| PendingSubjects | No grade/level fields. |
| Subjects | No grade/level fields. Decision documented in §8. |
| CourseSubjects | No grade/level fields. All info comes via `Course` FK. |
| Attendance | No grade/level fields. |
| Students | Enrollment is via `CourseStudent` → `Course`. |
| Convivencias | No grade/level fields. |
| Announcements | No grade/level fields. |
| Spaces / Reservations | No grade/level fields. |
| Sports / SportGroups | No grade/level fields. |
| CASL Ability Factory | Permissions are role+subject based, not level-sensitive. |

### 9.3 Seed defaults

When a new institution is created, auto-seed:

```typescript
const DEFAULT_LEVELS = [
  {
    name: 'Inicial', order: 1,
    grades: [
      { number: null, name: 'Sala de 3', order: 1 },
      { number: null, name: 'Sala de 4', order: 2 },
      { number: null, name: 'Sala de 5', order: 3 },
    ],
  },
  {
    name: 'Primaria', order: 2,
    grades: [
      { number: 1, name: '1°', order: 1 }, { number: 2, name: '2°', order: 2 },
      { number: 3, name: '3°', order: 3 }, { number: 4, name: '4°', order: 4 },
      { number: 5, name: '5°', order: 5 }, { number: 6, name: '6°', order: 6 },
    ],
  },
  {
    name: 'Secundaria', order: 3,
    grades: [
      { number: 1, name: '1°', order: 1 }, { number: 2, name: '2°', order: 2 },
      { number: 3, name: '3°', order: 3 }, { number: 4, name: '4°', order: 4 },
      { number: 5, name: '5°', order: 5 },
    ],
  },
];
```

Existing institutions get seeded via the backfill migration script.

### 9.4 New API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/education-levels` | List levels for the institution |
| `POST` | `/education-levels` | Create a new level (ADMIN/DIRECTOR) |
| `PATCH` | `/education-levels/:id` | Update level name/order/status |
| `DELETE` | `/education-levels/:id` | Blocked if dependencies exist |
| `GET` | `/education-levels/:id/grades` | List grades within a level |
| `POST` | `/education-levels/:id/grades` | Create a grade within a level |
| `PATCH` | `/grades/:id` | Update grade name/number/order/status |
| `DELETE` | `/grades/:id` | Blocked if dependencies exist |

### 9.5 Deprecated endpoints (dual-write)

Existing endpoints accepting `grade` (int) and `level` (INICIAL/PRIMARIA/SECUNDARIA) continue to work during the transition period. The old fields populate both the deprecated column and the new FK internally.

---

## 10. Frontend Impact

### 10.1 Files requiring changes

| File | Change | Priority |
|------|--------|----------|
| `courses.types.ts` | `level` enum → `levelGradeId`. Remove hardcoded `levelLabel`/`levelColor` maps (replace with API-driven). | Must |
| `create-course-dialog.tsx` | Level dropdown from API. Grade dropdown from API (cascading). | Must |
| `course-card.tsx` | Level/grade display from `course.levelGrade` relation. | Must |
| `[id]/page.tsx` | `isSecondary` check → `course.levelGrade.educationLevel.name` comparison. | Must |
| `indicators-filters.tsx:17` | Remove `const GRADES = [1,2,3,4,5,6,7]`. Fetch from API. | Must |
| `lib/api/courses.ts` | Update `Course` interface. Add `useEducationLevels()` and `useLevelGrades()` hooks. | Must |
| `lib/api/indicators.ts` | Update query params for `levelGradeId`. | Must |
| `guardian-student-selector.tsx` | `{course.grade}°` → `{course.levelGrade.name}`. | Should |
| `reports/types.ts` | Remove `EDUCATION_LEVEL_TO_COURSE_LEVEL` mapping. Filter by `educationLevelId` directly. | Must |
| `courses.types.ts` | Zod: `grade: z.coerce.number().min(1).max(12)` → `levelGradeId: z.string().uuid()`. | Must |

### 10.2 New frontend API hooks

```typescript
// GET /education-levels
useEducationLevels(): UseQueryResult<EducationLevel[]>

// GET /education-levels/:id/grades
useLevelGrades(educationLevelId: string): UseQueryResult<LevelGrade[]>
```

### 10.3 Hardcoded values to remove

| Location | Current value | Replacement |
|----------|--------------|-------------|
| `create-course-dialog.tsx:24` | `defaultValues: { level: 'PRIMARIA' }` | `defaultValues: { levelGradeId: '' }` |
| `create-course-dialog.tsx:109-111` | Three `<SelectItem>` for levels | Dynamic from API |
| `course-card.tsx:21-22` | `levelColor` / `levelLabel` maps | `course.levelGrade.educationLevel.name` |
| `[id]/page.tsx:37` | `course.level === 'SECUNDARIA'` | `course.levelGrade.educationLevel.name === 'Secundaria'` |
| `reports/types.ts:86-89` | `EDUCATION_LEVEL_TO_COURSE_LEVEL` | Remove entire mapping |

---

## 11. Hidden Dependencies

These dependencies were discovered during analysis and must be addressed during implementation:

### 11.1 Chat module

| Location | Current code | Required change |
|----------|-------------|-----------------|
| `chat.service.ts:137` | `const roomLevel = resolvedLevel ?? 'PRIMARIA'` | Fallback to `null` or first active level |
| `chat.service.ts:139` | `where: { institutionId_level: { level: roomLevel } }` | Use `educationLevelId` |
| `chat.service.ts:172` | `level: resolvedLevel` (room creation) | `educationLevelId: resolvedLevel` |
| `chat.service.ts:685` | `resolveRoomLevel()` reads `course.level` and `userLevelRole.level` | Read `course.levelGrade.educationLevelId` and `userLevelRole.educationLevelId` |
| `chat.service.ts:737` | `where: { institutionId_level: { level: room.level ?? 'PRIMARIA' } }` | Use `educationLevelId` |
| `chat.service.ts:865` | Same pattern | Same change |

### 11.2 Reports module

| Location | Current code | Required change |
|----------|-------------|-----------------|
| `report.aggregation.ts:30-34` | `DEFAULT_AGGREGATION` keys: `SECUNDARIA`, `PRIMARIA`, `INICIAL` | Keys match seed names: `"Secundaria"`, `"Primaria"`, `"Inicial"` |
| `reports.service.ts:88-105` | `resolvePeriodAggregation()` uses level string as key in `institution.settings.reportPeriodAggregation[level]` | Use `educationLevel.name` as key |
| `report.types.ts:65,84,108` | `course.level: string` in report interfaces | `course.educationLevelName: string` |
| `reports.service.ts:443,445` | `courseStudent.course.grade`, `courseStudent.course.level` | `courseStudent.course.levelGrade.name`, `courseStudent.course.levelGrade.educationLevel.name` |
| `reports.service.ts:715,717` | Same pattern | Same change |
| `reports.service.ts:882,884` | Same pattern | Same change |
| `reports.service.ts:1023` | Same pattern | Same change |
| `reports.service.ts:1154,1156` | Same pattern | Same change |

### 11.3 DTOs and services

| Location | Current code | Required change |
|----------|-------------|-----------------|
| `courses/course.dto.ts:17` | `level: z.enum(['INICIAL','PRIMARIA','SECUNDARIA'])` | `educationLevelId: z.string().uuid()` |
| `courses/course.dto.ts` | `grade: z.coerce.number().int().min(1).max(12)` | `levelGradeId: z.string().uuid()` |
| `users/user.dto.ts:34` | `level: z.enum(['INICIAL','PRIMARIA','SECUNDARIA'])` | `educationLevelId: z.string().uuid()` |
| `courses.service.ts:238` | `grade: cs.course.grade` | `gradeName: cs.course.levelGrade.name` |
| `student-course-subjects.service.ts:98` | `grade: cs.course.grade` | `gradeName: cs.course.levelGrade.name` |

---

## 12. Migration Strategy

### Phase 1: Schema introduction

1. Create new models: `EducationLevel`, `LevelGrade`
2. Add nullable columns + FKs to existing models:
   - `Course.levelGradeId` (nullable, FK → LevelGrade)
   - `Indicator.levelGradeId` (nullable, FK → LevelGrade)
   - `UserLevelRole.educationLevelId` (nullable, FK → EducationLevel)
   - `ChatRoom.educationLevelId` (nullable, FK → EducationLevel)
   - `InstitutionLevelCommunicationSettings.educationLevelId` (nullable, FK → EducationLevel)
3. Keep old columns: `Course.grade`, `Course.level`, `Indicator.grade`, `UserLevelRole.level`, `ChatRoom.level`, `InstitutionLevelCommunicationSettings.level`
4. Generate migration (up-only, no data loss)

### Phase 2: Seed + backfill

1. Add seed logic to institution creation hook
2. Write backfill script for existing institutions:
   - For each institution, create default `EducationLevel` + `LevelGrade` records
   - For each `Course`: find matching `LevelGrade` by `level → educationLevel.name` + `grade → levelGrade.number`, set `course.levelGradeId`
   - For each `Indicator`: same approach for `grade → levelGrade.number`
   - For each `UserLevelRole`: `level → educationLevel.name`
   - For each `ChatRoom`: `level → educationLevel.name`
   - For each `InstitutionLevelCommunicationSettings`: `level → educationLevel.name`
3. Audit log all backfilled records for manual review

### Phase 3: Backend migration

1. Update Courses module (controller, service, DTOs)
2. Update Indicators module
3. Update Auth/Users module (UserLevelRole)
4. Update Chat module
5. Update Reports module (types, aggregation, service)
6. Accept both old and new params during transition
7. Dual-write: when creating Course/Indicator via new API, populate both new FK and old deprecated field

### Phase 4: Frontend migration

1. Add `useEducationLevels()` and `useLevelGrades()` hooks
2. Create `/admin/settings/academic-structure` page with CRUD UI
3. Update course creation/edit form to use dynamic dropdowns
4. Update indicators filter to use dynamic dropdowns
5. Remove hardcoded `GRADES = [1,2,3,4,5,6,7]`
6. Update reports filtering
7. Remove hardcoded level labels and color maps

### Phase 5: Cleanup

1. Make new FKs required (NOT NULL) after confirming all records migrated
2. Drop old columns:
   - `Course.grade`, `Course.level`
   - `Indicator.grade`
   - `UserLevelRole.level`
   - `ChatRoom.level` (keep if nullable)
   - `InstitutionLevelCommunicationSettings.level`
3. Remove `Level` enum from Prisma schema
4. Remove deprecated DTO fields
5. Remove deprecation compatibility code from services

---

## 13. Risks & Mitigations

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| Indicator migration fails (grade → levelGradeId mapping ambiguous) | Medium | High | Audit log all migrated records; manual review tool for admins |
| Institutions with custom grade ranges break during backfill | Low | High | Backfill skips unmappable records; manual setup via admin UI |
| Course creation dual-write bugs (old/new fields out of sync) | Medium | Medium | Test coverage on create endpoint; validation that old == new post-migration |
| Deletion-blocking rules cause support tickets | Medium | Low | Clear error messages with dependency counts; deactivate always available |
| Frontend hardcoded references missed | Medium | Medium | Comprehensive grep for `course.level`, `course.grade`, `INICIAL`, `PRIMARIA`, `SECUNDARIA` |
| Chat service `resolveRoomLevel()` regression | Low | Medium | Integration test for chat room creation with new fields |
| Reports generate incorrect period aggregation | Low | High | Snapshot test report output before and after migration |

---

## 14. Effort Estimate

| Phase | Scope | Estimated days |
|-------|-------|---------------|
| 1 — Schema | 2 new models + 5 nullable columns + migration | 2 |
| 2 — Seed + backfill | Institution creation hook + backfill script | 2 |
| 3 — Backend code | Courses, Indicators, Auth, Chat, Reports (~8 modules) | 5 |
| 4 — Frontend code | ~12 files + new API hooks + admin settings page | 5 |
| 5 — Cleanup | Columns required, drop old fields, remove enum | 1 |
| **Total** | | **~15 days** |

---

## Appendix: Comparison of single-entity vs two-entity approach

| Dimension | Single entity (AcademicGrade) | Two entities (EducationLevel + LevelGrade) |
|-----------|------------------------------|-------------------------------------------|
| `UserLevelRole` reference | Needs separate `EducationLevel` or denormalized string | Natural FK to `EducationLevel` |
| `InstitutionLevelCommunicationSettings` | Same issue | Natural FK to `EducationLevel` |
| `ChatRoom` | Same issue | Natural FK to `EducationLevel` |
| `Course` → level | One JOIN | Two JOINs (negligible cost) |
| Query simplicity | Level is a field on the grade record | Level is a relation from grade |
| Normalization | Denormalized (level is repeated per grade) | Normalized |
| Future: level metadata | Hard to add (would need separate table anyway) | Already separate |

**Decision: Two entities.** Justified by `UserLevelRole`, `InstitutionLevelCommunicationSettings`, and `ChatRoom` needing level-scoped references without grade granularity.
