# Academic Structure Refactor — Implementation Plan

## Architectural Decisions

| Decision | Status | Resolution |
|----------|--------|------------|
| Indicator Backfill Strategy | APPROVED | Hybrid algorithm (CourseSubject inference → Sibling inference → Manual Review). Dry-run only measures impact and does not change strategy. No minimum resolution threshold. |
| EducationLevel Identifier | APPROVED | Add immutable `slug`. Internal relations use IDs. Persisted configuration uses slug. |
| `reportPeriodAggregation` Keys | APPROVED | Use `EducationLevel.slug`. Never UUID. Never display name. |
| RITE / VALORACIONES | APPROVED | Design B. Preserve current behavior. Replace `Course.level === 'SECUNDARIA'` with `Course.levelGrade.educationLevel.slug === 'secundaria'`. |
| `InstitutionLevelCommunicationSettings` Uniqueness | APPROVED | Partial unique index on `(institution_id, education_level_id) WHERE education_level_id IS NOT NULL`. |
| `EducationLevel.slug` Mutability | APPROVED | Immutable after creation. |
| Indicator Dry-Run Threshold | APPROVED | None. Hybrid algorithm is always used. Dry-run is a visibility tool, not a gating mechanism. |
| `ChatRoom.educationLevelId` | APPROVED | Remains nullable to support institution-wide rooms. |

### Slug convention

| Source | Default slug |
|--------|--------------|
| `Level.INICIAL` | `inicial` |
| `Level.PRIMARIA` | `primaria` |
| `Level.SECUNDARIA` | `secundaria` |
| Custom | Lowercase, ASCII, no accents, immutable |

---

## Before You Begin

Run `npx prisma generate` after every schema change. Run `npm run lint && npm run typecheck` before committing each phase. Every new endpoint requires `@CheckAbility()` and `@InstitutionId()`. `EducationLevel` requires `institutionId`; `LevelGrade` does not.

---

## Phase 1 — Prisma Schema Foundation

**Goal:** Add `EducationLevel` and `LevelGrade` models; add nullable FKs with `onDelete: Restrict`; add slug with immutability invariant; add performance indexes. All changes additive — zero data loss, zero breaking changes.

### Canonical schema

```prisma
model EducationLevel {
  id            String   @id @default(uuid())
  institutionId String   @map("institution_id")
  slug          String
  name          String
  displayOrder  Int      @default(0)
  status        Status   @default(ACTIVE)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  institution            Institution                          @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  grades                 LevelGrade[]
  userLevelRoles         UserLevelRole[]
  chatRooms              ChatRoom[]
  communicationSettings  InstitutionLevelCommunicationSettings[]

  @@unique([institutionId, name])
  @@unique([institutionId, slug])
  @@index([institutionId])
  @@map("education_levels")
}

model LevelGrade {
  id               String   @id @default(uuid())
  educationLevelId String   @map("education_level_id")
  name             String
  displayOrder     Int      @default(0)
  status           Status   @default(ACTIVE)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  educationLevel EducationLevel @relation(fields: [educationLevelId], references: [id], onDelete: Restrict)
  courses        Course[]
  indicators     Indicator[]

  @@unique([educationLevelId, name])
  @@index([educationLevelId, displayOrder])
  @@index([educationLevelId, status])
  @@map("level_grades")
}
```

**LevelGrade does not have `institutionId`.** Tenant scope via parent `EducationLevel.institutionId`. Queries:

```typescript
prisma.levelGrade.findMany({
  where: { educationLevel: { institutionId } },
});
```

### Consumer relations (all explicit `onDelete: Restrict`)

```prisma
model Course {
  levelGradeId  String?     @map("level_grade_id")
  levelGrade    LevelGrade? @relation(fields: [levelGradeId], references: [id], onDelete: Restrict)
  // ...
}

model Indicator {
  levelGradeId  String?     @map("level_grade_id")
  levelGrade    LevelGrade? @relation(fields: [levelGradeId], references: [id], onDelete: Restrict)
  // ...
}

model UserLevelRole {
  educationLevelId  String?          @map("education_level_id")
  educationLevel    EducationLevel?  @relation(fields: [educationLevelId], references: [id], onDelete: Restrict)
  // ...
}

model ChatRoom {
  educationLevelId  String?          @map("education_level_id")
  educationLevel    EducationLevel?  @relation(fields: [educationLevelId], references: [id], onDelete: Restrict)
  // ...
}

model InstitutionLevelCommunicationSettings {
  educationLevelId  String?          @map("education_level_id")
  educationLevel    EducationLevel?  @relation(fields: [educationLevelId], references: [id], onDelete: Restrict)
  // ...
}
```

**Why explicit `onDelete: Restrict`:** Prisma 5 default for nullable relations is `SetNull` (silent orphaning). The application layer in Phase 3 is the deletion gate; the database must enforce consistency even on direct DB-level attempts.

### InstitutionLevelCommunicationSettings uniqueness (partial index, manual SQL)

**Do NOT add `@@unique([institutionId, educationLevelId])` in `schema.prisma`.** Prisma's `@unique` does not support `WHERE` clauses, and a non-partial unique on a nullable column would allow multiple `NULL` rows (PostgreSQL behavior). Additionally, Prisma does not generate composite unique input types from manual SQL indexes — queries must use standard filters on `institutionId` and `educationLevelId` while the database-level partial unique index enforces uniqueness.

Add a **manual SQL migration step** in the same migration file:

```sql
CREATE UNIQUE INDEX institution_level_comm_settings_unique_level
ON institution_level_communication_settings (
  institution_id,
  education_level_id
)
WHERE education_level_id IS NOT NULL;
```

**Document in the migration file's comments** that this index is the source of truth and must be preserved. Application queries use standard `where: { institutionId, educationLevelId }` filters.

### Slug validation (Zod)

```typescript
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizeSlug = (value: string) =>
  value.trim().toLowerCase();

export const CreateEducationLevelSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .transform(normalizeSlug)
    .regex(SLUG_REGEX, 'Slug debe ser lowercase, ASCII, sin acentos, separado por guiones'),
  displayOrder: z.number().int().optional(),
});
```

`normalizeSlug` is also applied to the frontend slug suggestion helper and the update DTO (if slug is ever accepted).

### Slug immutability (application-layer enforcement in Phase 3)

The DTO does not allow slug updates. Service-level guard in `EducationLevelsService.update()`:

```typescript
async update(id: string, dto: UpdateEducationLevelDto, institutionId: string) {
  const current = await this.prisma.educationLevel.findFirst({
    where: { id, institutionId },
  });
  if (!current) throw new NotFoundException();

  if (dto.slug !== undefined) {
    throw new BadRequestException('El slug es inmutable una vez creado');
  }
  // ... apply name, displayOrder, status only
}
```

### Migration

`npx prisma migrate dev --name add_education_level_and_grade`

The migration file contains:
1. Prisma-generated DDL for new models and FKs.
2. Manual SQL for the partial unique index.
3. SQL comments documenting the index purpose.

### Acceptance criteria

- `npx prisma generate` succeeds.
- Partial unique index `institution_level_comm_settings_unique_level` exists in the database.
- All existing tables readable; no `LevelGrade.institutionId` column.
- All new columns nullable; no `NOT NULL` violations.
- `onDelete: Restrict` on every new FK.

### Rollback

`npx prisma migrate dev --name <previous_migration>` and delete the new migration file.

### Complexity: Low

---

## Phase 2 — Seed & Backfill

**Goal:** Seed default levels/grades for new institutions; backfill existing data; run indicator dry-run; migrate institution settings JSON; add `schemaVersion`.

### Course Backfill (deterministic)

`Course` has `level` (enum) and `grade` (Int). Mapping is unambiguous:

```typescript
// backfill/courses.ts
for (const course of await prisma.course.findMany({
  where: { levelGradeId: null },
  include: { institution: true },
})) {
  const levelLabel = levelEnumToLabel(course.level);
  const gradeLabel = intToGradeLabel(course.grade);

  const level = await prisma.educationLevel.findFirst({
    where: { institutionId: course.institutionId, name: levelLabel },
  });
  if (!level) continue;

  let grade = await prisma.levelGrade.findFirst({
    where: { educationLevelId: level.id, name: gradeLabel },
  });
  if (!grade) {
    grade = await prisma.levelGrade.create({
      data: { educationLevelId: level.id, name: gradeLabel, displayOrder: course.grade },
    });
  }
  await prisma.course.update({ where: { id: course.id }, data: { levelGradeId: grade.id } });
}
```

### UserLevelRole, ChatRoom, InstitutionLevelCommunicationSettings Backfill (deterministic)

`level` enum → `EducationLevel` (by name). All three models backfill using the same map.

### Indicator Backfill (hybrid algorithm — always used, no threshold)

#### Step 1 — CourseSubject inference

`Indicator → Subject → CourseSubject → Course → LevelGrade → EducationLevel`

```typescript
for (const indicator of unresolved) {
  const courseSubjects = await prisma.courseSubject.findMany({
    where: { subjectId: indicator.subjectId },
    include: { course: { include: { levelGrade: { include: { educationLevel: true } } } } },
  });

  const candidates = courseSubjects
    .filter((cs) => cs.course.levelGrade?.name === intToGradeLabel(indicator.grade))
    .map((cs) => ({
      educationLevelId: cs.course.levelGrade!.educationLevel.id,
      levelGradeId: cs.course.levelGradeId!,
    }));
  const distinctLevels = [...new Set(candidates.map((c) => c.educationLevelId))];

  if (distinctLevels.length === 1 && candidates.length > 0) {
    await assignAndMark(indicator, candidates[0].levelGradeId, 'AUTO_STEP1');
    continue;
  }
  if (distinctLevels.length > 1) {
    const distinctPairs = [...new Set(candidates.map((c) => c.levelGradeId))];
    if (distinctPairs.length === 1) {
      await assignAndMark(indicator, distinctPairs[0], 'AUTO_STEP1');
      continue;
    }
  }
  // Fall through to step 2
}
```

#### Step 2 — Sibling inference

Same `subjectId` + same `schoolYearId`:

```typescript
const siblings = await prisma.indicator.findMany({
  where: {
    subjectId: indicator.subjectId,
    schoolYearId: indicator.schoolYearId,
    levelGradeId: { not: null },
  },
  select: { levelGradeId: true },
});
const distinctSiblingGrades = [...new Set(siblings.map((s) => s.levelGradeId))];
if (distinctSiblingGrades.length === 1) {
  await assignAndMark(indicator, distinctSiblingGrades[0], 'AUTO_STEP2');
  continue;
}
```

#### Step 3 — Manual review

Unresolved records are appended to the CSV report and remain with `levelGradeId = NULL`. Phase 12 is gated on zero unresolved.

### Dry-run script (deliverable)

`backend/scripts/indicator-backfill.ts --dry-run`

```typescript
// Output JSON printed to stdout
{
  "total": 0,
  "autoResolvedStep1": 0,
  "autoResolvedStep2": 0,
  "manualReview": 0,
  "resolutionRate": 0
}
```

**Dry-run NEVER changes strategy.** The hybrid algorithm is always used. The dry-run is an operational visibility tool.

### CSV report

`backend/prisma/migrations/<timestamp>_add_education_level_and_grade/migration_report.csv` with columns: `entity, id, reason, suggested_resolution`.

### Institution settings migration (same phase)

```typescript
// backfill/institution-settings.ts
for (const institution of await prisma.institution.findMany()) {
  const settings = (institution.settings as any) ?? {};
  const oldAgg = settings.reportPeriodAggregation;
  if (!oldAgg) continue;

  const newAgg: Record<string, PeriodAggregationEntry[]> = {};
  for (const [oldKey, value] of Object.entries(oldAgg)) {
    const slug = levelEnumToSlug(oldKey as Level);
    newAgg[slug] = value as PeriodAggregationEntry[];
  }
  await prisma.institution.update({
    where: { id: institution.id },
    data: {
      settings: {
        ...settings,
        reportPeriodAggregation: newAgg,
        schemaVersion: 2,
      },
    },
  });
}
```

`schemaVersion: 2` is the migration marker. Phase 12 validates it.

### Validation queries

```sql
SELECT COUNT(*) FROM courses WHERE level_grade_id IS NULL;
SELECT COUNT(*) FROM user_level_roles WHERE education_level_id IS NULL;
SELECT COUNT(*) FROM chat_rooms WHERE education_level_id IS NULL AND level IS NOT NULL;
SELECT COUNT(*) FROM institution_level_communication_settings WHERE education_level_id IS NULL AND level IS NOT NULL;
SELECT COUNT(*) FROM indicators WHERE level_grade_id IS NULL;
```

### Acceptance criteria

- All validation queries return 0 (except `indicators`, which returns the count of records flagged for manual review).
- CSV report exists with all unresolved indicators.
- Institution settings JSON has `schemaVersion: 2` and `reportPeriodAggregation` keyed by slug.

### Rollback: restore from pre-migration backup.

### Complexity: Medium

---

## Phase 3 — Education Structure Module

**Goal:** New NestJS module with CRUD for EducationLevel and LevelGrade.

### Files (new)

- `modules/education-levels/education-levels.module.ts`
- `modules/education-levels/education-levels.controller.ts`
- `modules/education-levels/education-levels.service.ts`
- `modules/education-levels/dto/create-education-level.dto.ts` (name, slug, displayOrder)
- `modules/education-levels/dto/update-education-level.dto.ts` (all optional; excludes slug)
- `modules/education-levels/dto/query-education-level.dto.ts`
- `modules/education-levels/dto/create-level-grade.dto.ts`
- `modules/education-levels/dto/update-level-grade.dto.ts`

### Files (existing)

- `modules/casl/casl-ability.factory.ts` — add `EducationLevel` and `LevelGrade` subjects
- `app.module.ts` — register `EducationLevelsModule`

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/education-levels` | List levels |
| POST | `/education-levels` | Create (requires slug) |
| PATCH | `/education-levels/:id` | Update name/order/status only (slug immutable) |
| DELETE | `/education-levels/:id` | Blocked if dependencies |
| GET | `/education-levels/:educationLevelId/grades` | List grades |
| POST | `/education-levels/:educationLevelId/grades` | Create grade |
| PATCH | `/education-levels/:educationLevelId/grades/:id` | Update grade |
| DELETE | `/education-levels/:educationLevelId/grades/:id` | Blocked if dependencies |

### Deletion rules (application-layer enforcement)

```typescript
async deleteEducationLevel(id: string, institutionId: string) {
  const level = await this.prisma.educationLevel.findFirst({
    where: { id, institutionId },
  });
  if (!level) throw new NotFoundException();

  // Application-level validation for clearer 409 errors.
  // Database integrity is still enforced by Prisma Restrict FKs.
  const [
    gradeCount,
    courseCount,
    indicatorCount,
    roleCount,
    roomCount,
    settingsCount,
  ] = await Promise.all([
    this.prisma.levelGrade.count({ where: { educationLevelId: id } }),
    this.prisma.course.count({
      where: { levelGrade: { educationLevelId: id } },
    }),
    this.prisma.indicator.count({
      where: { levelGrade: { educationLevelId: id } },
    }),
    this.prisma.userLevelRole.count({ where: { educationLevelId: id } }),
    this.prisma.chatRoom.count({ where: { educationLevelId: id } }),
    this.prisma.institutionLevelCommunicationSettings.count({ where: { educationLevelId: id } }),
  ]);

  if (
    gradeCount + courseCount + indicatorCount + roleCount + roomCount + settingsCount > 0
  ) {
    throw new ConflictException(
      `No se puede eliminar: ${gradeCount} grados, ${courseCount} cursos, ${indicatorCount} indicadores, ${roleCount} roles, ${roomCount} salas, ${settingsCount} configuraciones dependen de este nivel. Desactívelo en su lugar.`
    );
  }

  await this.prisma.educationLevel.delete({ where: { id } });
}
```

**The Course and Indicator dependency checks are intentionally duplicated at the application layer. Their purpose is not to enforce integrity (which is already guaranteed by the database through `onDelete: Restrict` foreign keys), but to provide deterministic and user-friendly `409 Conflict` responses that clearly explain why a deletion is blocked. Without these checks, the operation would fail later with a lower-level database constraint violation that exposes less useful information to administrators.**

Las validaciones previas de dependencias (LevelGrade, Course, Indicator, UserLevelRole, ChatRoom e InstitutionLevelCommunicationSettings) existen únicamente para proporcionar errores de negocio claros y accionables al usuario (HTTP 409 Conflict con detalle de dependencias). La integridad real de los datos sigue estando garantizada por las foreign keys con `onDelete: Restrict` definidas en Prisma y aplicadas en la base de datos. Si una validación de aplicación se omite accidentalmente o existe una operación directa sobre la base, las restricciones de la base continúan impidiendo la eliminación de registros referenciados.

**Note:** `Course` and `Indicator` do not have a direct `educationLevelId` column. The query traverses the relation: `Course → LevelGrade → EducationLevel`.

### Acceptance criteria

- All endpoints respect `@CheckAbility()` and `@InstitutionId()`.
- DELETE on level with any of the 6 dependency types returns 409.
- The 409 message lists each affected entity type and its count.
- Slug cannot be updated after creation.
- Audit logs dispatched on create/update/delete.

### Complexity: Medium

---

## Phase 4 — Courses Refactor

**Goal:** Replace `Course.grade` (Int) and `Course.level` (Level enum) with `Course.levelGradeId` (String FK). No API compatibility shim.

### Files affected

- `modules/courses/dto/course.dto.ts` — remove `level` enum and `grade` Int, add `levelGradeId: z.string().uuid()`
- `modules/courses/dto/course.dto.ts` — query schema: replace `level`/`grade` filters with `levelGradeId`
- `modules/courses/courses.service.ts:72` — `orderBy: [{ grade: 'asc' }, ...]` → `orderBy: [{ levelGrade: { displayOrder: 'asc' } }, ...]`
- `modules/courses/courses.service.ts:238` — `cs.course.grade` → `cs.course.levelGrade.name` (display) or `cs.course.levelGradeId` (logic)
- `modules/courses/courses.controller.ts` — DTO pipe references
- `modules/student-course-subjects/student-course-subjects.service.ts:98` — same
- `modules/attendance/attendance.service.ts:308` — response DTO `grade: true` → `levelGrade: { select: { id, name } }`
- `modules/attendance/justifications.service.ts:193` — same
- `modules/convivencias/convivencias.service.ts:13` — same

### Service-level validation (single query, checks own + parent status)

```typescript
async create(dto: CreateCourseDto, institutionId: string) {
  const levelGrade = await this.prisma.levelGrade.findFirst({
    where: {
      id: dto.levelGradeId,
      status: 'ACTIVE',
      educationLevel: { institutionId, status: 'ACTIVE' },
    },
  });
  if (!levelGrade) {
    throw new BadRequestException(
      'El nivel/grado especificado no existe, está inactivo o su nivel educativo no pertenece a la institución'
    );
  }
  // ... create
}
```

### API compatibility: NOT retained

- Backend and frontend are versioned together.
- No external API consumers exist.
- Legacy columns remain in DB until Phase 12.

### Acceptance criteria

- `POST /courses` accepts only `levelGradeId`.
- Creating with INACTIVE `LevelGrade` or INACTIVE parent `EducationLevel` returns 400.
- `GET /courses` returns courses with level/grade resolved through relation.

### Complexity: Medium

---

## Phase 5 — Indicators Refactor

**Goal:** Replace `Indicator.grade` (Int?) with `Indicator.levelGradeId` (String FK, required at DTO).

### Files affected

- `modules/indicators/dto/create-indicator.dto.ts` — `levelGradeId: z.string().uuid()`
- `modules/indicators/dto/update-indicator.dto.ts` — same
- `modules/indicators/dto/query-indicator.dto.ts` — replace `grade` filter with `levelGradeId`
- `modules/indicators/indicators.service.ts:111` — `grade: dto.grade` → `levelGradeId: dto.levelGradeId`
- `modules/indicators/indicators.service.ts:382` — `where: { ..., grade: course.grade }` → `where: { ..., levelGradeId: course.levelGradeId }`
- `modules/indicators/indicators.controller.ts` — DTO pipes

### Service-level validation (same pattern as Phase 4)

```typescript
const levelGrade = await this.prisma.levelGrade.findFirst({
  where: {
    id: dto.levelGradeId,
    status: 'ACTIVE',
    educationLevel: { institutionId, status: 'ACTIVE' },
  },
});
if (!levelGrade) {
  throw new BadRequestException('El nivel/grado especificado no existe o está inactivo');
}
```

### Acceptance criteria

- `POST /indicators` accepts only `levelGradeId`.
- INACTIVE rejection works for own and parent.

### Complexity: Medium

---

## Phase 6 — UserLevelRole Refactor

**Goal:** Add `educationLevelId` binding.

### Files affected

- `modules/users/dto/user.dto.ts:34` — `z.enum(...)` removed, `educationLevelId: z.string().uuid()` added
- `modules/users/users.service.ts` — assignment logic updated
- `modules/users/users.controller.ts` — DTO pipes

### Service-level validation (parent status check)

```typescript
const educationLevel = await this.prisma.educationLevel.findFirst({
  where: { id: dto.educationLevelId, institutionId, status: 'ACTIVE' },
});
if (!educationLevel) {
  throw new BadRequestException('El nivel educativo no existe o está inactivo');
}
```

### Uniqueness note

`@@unique([userId, level, role])` remains during Phases 2-11 (the `level` column is still present). Phase 12 migrates it to `@@unique([userId, educationLevelId, role])`.

### Acceptance criteria

- `POST /users/:id/roles` accepts `educationLevelId` only.
- INACTIVE rejection works.

### Complexity: Low

---

## Phase 7 — Chat Refactor

**Goal:** Replace `ChatRoom.level` (enum) with `ChatRoom.educationLevelId` (FK); correct the misattributed uniqueness; handle level-less rooms explicitly.

**Architectural correction:** the existing `@@unique([institutionId, level])` belongs to `InstitutionLevelCommunicationSettings`, **not** `ChatRoom`. **No new constraint is added to `ChatRoom`.**

### Files affected

- `modules/chat/chat.service.ts:137` — remove `?? 'PRIMARIA'` fallback
- `modules/chat/chat.service.ts:685-710` (`resolveRoomLevel`) — use `chatRoom.educationLevel?.name` or `null`
- `modules/chat/chat.service.ts:737,865` — query `InstitutionLevelCommunicationSettings` using standard `{ institutionId, educationLevelId }` filters
- `modules/chat/chat.service.ts:830,902` — `level: room.level` → `educationLevelId: room.educationLevelId`
- `modules/chat/dto/create-chat-room.dto.ts` — accept `educationLevelId` instead of `level`
- `modules/institution-level-communication-settings/institution-level-communication-settings.service.ts` — update level references

### Explicit branch for level-less rooms

```typescript
async getRoomSettings(room: ChatRoom) {
  if (room.educationLevelId === null) {
    // Institution-wide or course-scoped room: use default settings
    return this.getInstitutionDefaultSettings(room.institutionId);
  }
  return this.prisma.institutionLevelCommunicationSettings.findFirst({
    where: {
      institutionId: room.institutionId,
      educationLevelId: room.educationLevelId,
    },
  });
}
```

### Acceptance criteria

- `resolveRoomLevel` returns level name or `null` (no fallback).
- Level-scoped rooms query `InstitutionLevelCommunicationSettings` correctly.
- Institution-wide/course-scoped rooms take the explicit branch.
- No `Level` enum references in chat module.

### Complexity: Low

---

## Phase 8 — Reports Refactor

**Goal:** Use `educationLevel.slug` for all settings JSON lookups; add Zod validation; preserve RITE/VALORACIONES behavior via slug check.

### Files affected

- `modules/reports/report.aggregation.ts:30-34` — `DEFAULT_AGGREGATION` keyed by `slug`
- `modules/reports/report.types.ts` — new `InstitutionSettingsSchema` (Zod)
- `modules/reports/reports.service.ts:88-105` — `resolvePeriodAggregation(institutionId, educationLevelSlug)`
- `modules/reports/reports.service.ts:443,445,530,715,717,882,884,1023,1154,1156,1235` — `course.level`/`course.grade` → `course.levelGrade.educationLevel.slug` and `course.levelGrade.name`

### Slug everywhere — never UUID, never display name

```typescript
// report.aggregation.ts
export const DEFAULT_AGGREGATION: Record<string, PeriodAggregationEntry[]> = {
  inicial:    DEFAULT_PRIMARIA_AGGREGATION,
  primaria:   DEFAULT_PRIMARIA_AGGREGATION,
  secundaria: DEFAULT_SECUNDARIA_AGGREGATION,
};
```

### Zod validation of institution settings JSON

```typescript
// report.types.ts
export const InstitutionSettingsSchema = z.object({
  schemaVersion: z.literal(2).optional(),
  reportPeriodAggregation: z.record(
    z.string().regex(SLUG_REGEX),
    z.array(z.object({
      label: z.string(),
      includePeriodOrder: z.array(z.number().int()),
    })),
  ).optional(),
});

// reports.service.ts
private async resolvePeriodAggregation(
  institutionId: string,
  educationLevelSlug: string,
): Promise<PeriodAggregationEntry[]> {
  const institution = await this.prisma.institution.findUnique({
    where: { id: institutionId },
    select: { settings: true },
  });

  const parsed = InstitutionSettingsSchema.safeParse(institution?.settings);
  if (!parsed.success) {
    this.logger.warn(`Invalid institution settings for ${institutionId}`, parsed.error);
    return DEFAULT_AGGREGATION[educationLevelSlug] ?? DEFAULT_SECUNDARIA_AGGREGATION;
  }
  const config = parsed.data.reportPeriodAggregation?.[educationLevelSlug];
  if (Array.isArray(config) && config.length > 0) return config;
  return DEFAULT_AGGREGATION[educationLevelSlug] ?? DEFAULT_SECUNDARIA_AGGREGATION;
}
```

### RITE / VALORACIONES — Design B (preserve existing behavior)

The frontend `course.level === 'SECUNDARIA'` check becomes:

```typescript
// lib/helpers/education-level.ts (centralized helper)
export function isSecondaryEducationLevel(
  course: { levelGrade?: { educationLevel?: { slug: string } } | null } | null | undefined,
): boolean {
  return course?.levelGrade?.educationLevel?.slug === 'secundaria';
}
```

**No institution-configurable report mapping. No additional settings. No behavior changes.**

### Acceptance criteria

- Report generation uses slug for aggregation.
- `institution.settings.reportPeriodAggregation` is Zod-validated; invalid JSON fails safely.
- RITE and VALORACIONES templates still work for courses whose `levelGrade.educationLevel.slug === 'secundaria'`.

### Complexity: Medium

---

## Phase 9 — Frontend Academic Structure

### Files (new)

- `src/app/admin/academic-structure/page.tsx`
- `src/app/admin/academic-structure/_components/academic-structure.types.ts`
- `src/app/admin/academic-structure/_components/level-list.tsx`
- `src/app/admin/academic-structure/_components/grade-list.tsx`
- `src/app/admin/academic-structure/_components/create-level-dialog.tsx` (includes slug field with regex preview and `.trim().toLowerCase()` normalization)
- `src/app/admin/academic-structure/_components/create-grade-dialog.tsx`
- `src/lib/api/academic-structure.ts`

### Files (existing)

- `src/lib/navigation.ts` — add nav item for ADMIN/DIRECTOR

### Slug input UX

The create-level dialog shows a slug field with a live preview. If the admin types "Nivel Preescolar", the preview suggests `nivel-preescolar` after `trim().toLowerCase()`. The admin can override but the regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` is enforced.

### Acceptance criteria

- Page accessible to ADMIN/DIRECTOR only.
- Slug immutability surfaced in UI (edit dialog does not show slug field).
- 409 handling for delete-with-dependencies.

### Complexity: Medium

---

## Phase 10 — Frontend Courses

### Affected files (full list)

- `src/app/admin/courses/_components/courses.types.ts`
- `src/app/admin/courses/_components/create-course-dialog.tsx`
- `src/app/admin/courses/_components/courses-table.tsx`
- `src/app/admin/courses/_components/course-card.tsx`
- `src/app/admin/courses/[id]/page.tsx`
- `src/app/guardian/dashboard/page.tsx`
- `src/app/guardian/components/guardian-student-selector.tsx`
- `src/app/admin/reports/_components/generate-report-tab.tsx`
- `src/app/teacher/reports/page.tsx`

### Migration pattern

```diff
- course.level
- course.grade
+ course.levelGrade.name
+ course.levelGrade.educationLevel
```

For report-type filtering (`generate-report-tab.tsx:35`, `teacher/reports/page.tsx:39`):

```diff
- c.level === EDUCATION_LEVEL_TO_COURSE_LEVEL[REPORT_TYPES[reportType].educationLevel]
+ c.levelGrade?.educationLevel?.slug === slugFromReportType(reportType)
```

### Centralized helper

```typescript
// src/lib/helpers/education-level.ts
export function isSecondaryEducationLevel(
  course: { levelGrade?: { educationLevel?: { slug: string } } | null } | null | undefined,
): boolean {
  return course?.levelGrade?.educationLevel?.slug === 'secundaria';
}
```

### Acceptance criteria

- All 9 files updated; no `course.level` or `course.grade` references remain.
- Course creation shows level selector → dynamic grade filter.
- Bulk downloads gated on `isSecondaryEducationLevel(course)`.

### Complexity: Medium

---

## Phase 11 — Frontend Indicators

### Files affected

- `src/app/admin/indicators/_components/indicators-filters.tsx` — replace `GRADES = [1,2,3,4,5,6,7]` with `useLevelGrades()`; add level+grade two-step filter
- `src/app/admin/indicators/_components/indicator-form.tsx` — same
- `src/lib/api/indicators.ts` — update `Indicator` interface

### Acceptance criteria

- Indicator filter: select level → grades populated dynamically.
- Indicator creation assigns `levelGradeId`.
- Display fields show level+grade names.

### Complexity: Low

---

## Phase 12 — Cleanup

**Goal:** Remove deprecated columns, `Level` enum, legacy unique, default fallback. Production-safe migrations.

### Indicator Resolution Gate

Phase 12 cannot begin while any Indicator remains unresolved. All Indicators must have a populated `levelGradeId` before cleanup. The manual-review CSV generated in Phase 2 must be fully resolved and re-imported before running `check-cleanup-preconditions.ts`.

Required state:

```sql
SELECT COUNT(*) FROM indicators WHERE level_grade_id IS NULL;
-- Result must be 0
```

### Pre-conditions (CI-enforced)

`backend/scripts/check-cleanup-preconditions.ts`:

```typescript
const checks = [
  { model: 'course',           column: 'level_grade_id' },
  { model: 'indicator',        column: 'level_grade_id' },
  { model: 'user_level_role',  column: 'education_level_id' },
];

for (const { model, column } of checks) {
  const unresolved = await prisma[model].count({ where: { [column]: null } });
  if (unresolved > 0) {
    throw new Error(`Cleanup blocked: ${unresolved} ${model} records have NULL ${column}.`);
  }
}

// Institution settings validation
for (const institution of await prisma.institution.findMany()) {
  const settings = (institution.settings as any) ?? {};
  if (settings.schemaVersion !== 2) {
    throw new Error(`Institution ${institution.id} settings.schemaVersion is not 2.`);
  }
  const keys = Object.keys(settings.reportPeriodAggregation ?? {});
  const invalid = keys.filter((k) => !SLUG_REGEX.test(k));
  if (invalid.length > 0) {
    throw new Error(`Institution ${institution.id} has non-slug keys: ${invalid.join(', ')}`);
  }
}

console.log('All cleanup pre-conditions satisfied.');
```

### CHECK NOT VALID → VALIDATE → SET NOT NULL migration strategy

```sql
-- Step 1: Add CHECK constraint NOT VALID (no full table scan, no long lock)
ALTER TABLE courses
ADD CONSTRAINT courses_level_grade_id_not_null
CHECK (level_grade_id IS NOT NULL)
NOT VALID;

-- Step 2: Validate the constraint (weaker lock, validates existing rows)
ALTER TABLE courses
VALIDATE CONSTRAINT courses_level_grade_id_not_null;

-- Step 3: Set NOT NULL (metadata only, after all rows validated)
ALTER TABLE courses
ALTER COLUMN level_grade_id SET NOT NULL;

-- Step 4: Drop the redundant CHECK constraint
ALTER TABLE courses
DROP CONSTRAINT courses_level_grade_id_not_null;
```

**Apply the same pattern to:**

- `indicators.level_grade_id`
- `user_level_roles.education_level_id`

### Cleanup steps (in order)

1. Migrate `UserLevelRole` `@@unique([userId, level, role])` → `@@unique([userId, educationLevelId, role])`.
2. Drop `ChatRoom.level` column.
3. Drop `UserLevelRole.level` column.
4. Drop `Course.grade` and `Course.level` columns; drop `@@index([level])`.
5. Drop `Indicator.grade` column.
6. Drop `Level` enum.
7. Drop `InstitutionLevelCommunicationSettings.@@unique([institutionId, level])`. **Keep the partial unique index from Phase 1.**
8. Apply NOT NULL via `CHECK NOT VALID → VALIDATE → SET NOT NULL → DROP CONSTRAINT` to: `courses.level_grade_id`, `indicators.level_grade_id`, `user_level_roles.education_level_id`.
9. Final validation: re-run `check-cleanup-preconditions.ts`.

### Acceptance criteria

- Schema has no `Level` enum.
- No `grade` or `level` columns remain.
- `levelGradeId` is `NOT NULL` on Course, Indicator, UserLevelRole.
- Partial unique index preserved.
- `settings.schemaVersion === 2` and only slug keys present.

### Rollback: requires backup restore. Do not deploy until Phases 4-11 have been in production for at least one release cycle.

### Complexity: Medium-High

---

## Dependency Graph

```
P1 (Schema)
  └─► P2 (Seed & Backfill + dry-run + settings migration)
        ├─► P3 (Education Module)
        ├─► P4 (Courses)
        │     └─► P8 (Reports)
        ├─► P5 (Indicators)
        ├─► P6 (UserLevelRole)
        └─► P7 (Chat)
        │
P3 ──► P9 (Frontend Academic Structure)
P4 ──► P10 (Frontend Courses)
P5 ──► P11 (Frontend Indicators)
        │
All above + zero unresolved indicators ──► P12 (Cleanup)
```

**Implementation order:** P1 → P2 → P3 → (P4, P5, P6, P7 in parallel) → P8 → (P9, P10, P11 in parallel) → P12 (after ≥1 release cycle).

---

## Testing Strategy per Phase

| Phase | What to Verify |
|-------|----------------|
| 1 | `prisma generate` succeeds; partial unique index exists; `onDelete: Restrict` on all FKs. |
| 2 | Validation queries return 0 (except `indicators`); CSV exists; dry-run output structure correct. |
| 3 | CRUD endpoints, 409 on delete-with-deps, slug immutability, CASL enforcement. |
| 4 | Course create/update with `levelGradeId`, INACTIVE rejection (own and parent). |
| 5 | Indicator create/filter with `levelGradeId`, INACTIVE rejection (own and parent). |
| 6 | UserLevelRole with `educationLevelId`, INACTIVE rejection. |
| 7 | Chat room creation with `educationLevelId`; level-less room branch; no PRIMARIA fallback. |
| 8 | Reports use slug; Zod validation rejects malformed JSON; RITE/VALORACIONES still work for slug=secundaria. |
| 9 | UI flow: create level with slug → create grade → see both. |
| 10 | All 9 files updated; bulk downloads gated on `isSecondaryEducationLevel`. |
| 11 | Indicator filter: level → dynamic grades. |
| 12 | `check-cleanup-preconditions.ts` passes; `CHECK NOT VALID → VALIDATE → SET NOT NULL` runs without timeout. |

---

## Verification Checklist (final)

- [ ] No references to `institutionId_educationLevelId` Prisma composite inputs remain.
- [ ] All `InstitutionLevelCommunicationSettings` lookups use standard `{ institutionId, educationLevelId }` filters.
- [ ] No occurrence of `SET NOT NULL NOT VALID`.
- [ ] PostgreSQL migration pattern: `CHECK (...) NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL` → `DROP CONSTRAINT`.
- [ ] Phase 12 contains an explicit **Indicator Resolution Gate** section.
- [ ] Cleanup is blocked while any `Indicator.levelGradeId` remains `NULL`.
- [ ] `deleteEducationLevel()` validates all 6 dependency types: LevelGrade, Course, Indicator, UserLevelRole, ChatRoom, InstitutionLevelCommunicationSettings.
- [ ] The application-layer validation rationale is documented in Phase 3.
- [ ] Slug normalization (`trim + lowercase`) is applied before validation in backend DTOs and frontend helpers.
- [ ] Partial unique index on `InstitutionLevelCommunicationSettings` is a manual SQL migration, not a Prisma `@@unique`.

---

## Final Verdict

🟢 **GO.**

Plan is approved for implementation in the sequence P1 → P2 → P3 → (P4, P5, P6, P7) → P8 → (P9, P10, P11) → P12.
