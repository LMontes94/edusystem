# Promotion Domain — Technical Design Document

> **Status:** Final — Approved for Implementation
> **Version:** 1.1
> **Last updated:** 2026-06-12
> **Classification:** Technical Design Specification
> **Dependencies:** `academic-lifecycle-design.md` (Phase 1 — SchoolYear Status migration must be deployed first)

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-12 | Initial technical design |
| 1.1 | 2026-06-12 | Pre-Implementation Audit fixes: F1 (relation syntax), F2 (Json default), F3 (institutionId), F4 (Course race), F5 (onDelete), F6 (I12 soften), F7 (migration deps), F8 (summary staleness), F9 (override criteria), F11 (audit events), F12 (heartbeat), F14 (no-prior-result) |

---

## Table of Contents

1. [Prisma Schema Specification](#part-1--prisma-schema-specification)
2. [Database Migration Plan](#part-2--database-migration-plan)
3. [Service Architecture](#part-3--service-architecture)
4. [Effective Result Strategy](#part-4--effective-result-strategy)
5. [API Contract Design](#part-5--api-contract-design)
6. [Transaction Boundaries](#part-6--transaction-boundaries)
7. [Authorization Matrix](#part-7--authorization-matrix)
8. [Error Handling](#part-8--error-handling)
9. [Idempotency Strategy](#part-9--idempotency-strategy)
10. [Testing Strategy](#part-10--testing-strategy)
11. [Rollout Plan](#part-11--rollout-plan)

---

## Part 1 — Prisma Schema Specification

### 1.1 New Enums

```prisma
enum PromotionOutcome {
  PROMOTED
  RETAINED
  GRADUATED
}

enum PromotionStatus {
  PREVIEWED
  EXECUTING
  COMPLETED
}
```

**Migration notes:**
- `PromotionOutcome` — new enum, added via `CREATE TYPE`
- `PromotionStatus` — new enum, added via `CREATE TYPE`

### 1.2 PromotionResult Model

```prisma
model PromotionResult {
  id                  String           @id @default(uuid())

  // Tenant isolation (F3)
  institutionId       String           @map("institution_id")

  // Identities
  studentId           String           @map("student_id")
  fromSchoolYearId    String           @map("from_school_year_id")
  toSchoolYearId      String?          @map("to_school_year_id")

  // CourseStudent traceability
  fromCourseStudentId String           @map("from_course_student_id")
  toCourseStudentId   String?          @map("to_course_student_id")

  // LevelGrade trajectory
  fromLevelGradeId    String?          @map("from_level_grade_id")
  toLevelGradeId      String?          @map("to_level_grade_id")

  // Outcome
  result              PromotionOutcome

  // Snapshots
  criteria            Json
  evaluationSnapshot  Json             @default("{}")  // (F2) Prevents Prisma runtime crash on omit

  // Override metadata
  reason              String?          @db.VarChar(500)
  isOverride          Boolean          @default(false) @map("is_override")

  // Audit
  decidedById         String           @map("decided_by_id")
  decidedAt           DateTime         @default(now()) @map("decided_at")

  // Relations (F1 — named, F5 — explicit onDelete)
  student              Student       @relation(fields: [studentId],          references: [id])
  institution          Institution   @relation(fields: [institutionId],      references: [id])
  fromSchoolYear       SchoolYear    @relation("PromotionFromSchoolYear",    fields: [fromSchoolYearId], references: [id])
  toSchoolYear         SchoolYear?   @relation("PromotionToSchoolYear",      fields: [toSchoolYearId],   references: [id], onDelete: SetNull)
  fromCourseStudent    CourseStudent @relation("PromotionFromCourseStudent", fields: [fromCourseStudentId], references: [id])
  toCourseStudent      CourseStudent? @relation("PromotionToCourseStudent",  fields: [toCourseStudentId], references: [id], onDelete: SetNull)
  decidedBy            User          @relation(fields: [decidedById],         references: [id])

  // Indexes
  @@index([institutionId])
  @@index([studentId])
  @@index([studentId, fromSchoolYearId])
  @@index([fromSchoolYearId])
  @@index([toSchoolYearId])
  @@index([result])
  @@map("promotion_results")
}
```

#### Field Design Decisions

| Field | Nullable | Rationale |
|-------|----------|-----------|
| `institutionId` | `String` (NOT NULL) | Tenant isolation. Populated from `SchoolYear.institutionId`. All queries must be institution-scoped. |
| `fromLevelGradeId` | `String?` | Legacy pre-LevelGrade data may not have a mapping. Engine-generated records SHOULD populate this (F6). |
| `toLevelGradeId` | `String?` | Null when `result = GRADUATED`. Always populated when `result = PROMOTED | RETAINED`. |
| `toSchoolYearId` | `String?` | Null when `result = GRADUATED`. |
| `toCourseStudentId` | `String?` | Null when `result = GRADUATED`. Populated when a destination CourseStudent is created. |
| `reason` | `String?` | Required when `isOverride = true`. Optional when engine-generated. |
| `evaluationSnapshot` | `Json (NOT NULL, default {})` | Engine-generated results always populate this. Overrides may leave it empty (DB default handles it). |

#### Index Justification

| Index | Purpose |
|-------|---------|
| `@@index([institutionId])` | Tenant-scoped queries (F3) |
| `@@index([studentId])` | Student historical lookups |
| `@@index([studentId, fromSchoolYearId])` | Effective-result resolution (DISTINCT ON support) |
| `@@index([fromSchoolYearId])` | SchoolYear-level queries |
| `@@index([toSchoolYearId])` | Reverse lookups |
| `@@index([result])` | Filtered aggregates |

#### Snapshot Schemas

**criteria** (`Json`) — preserved in every PromotionResult:
```json
{
  "engineVersion": "1.0",
  "minAverageScore": 7.0,
  "maxPendingSubjects": 2,
  "coreSubjects": [],
  "attendanceMinimum": 80.0,
  "closingGradeMinimum": 6.0
}
```

**evaluationSnapshot** (`Json`) — preserved in every engine-generated PromotionResult:
```json
{
  "engineVersion": "1.0",
  "averageScore": 8.4,
  "totalGrades": 48,
  "pendingSubjects": {
    "total": 1,
    "completed": 0,
    "notCompleted": 1
  },
  "failedCoreSubjects": [],
  "attendancePercentage": 93.2,
  "closingGradesEvaluated": 12,
  "closingGradesPassed": 11,
  "closingGradesFailed": 1
}
```

**Version-aware reading:**
```typescript
const engineVersion = result.evaluationSnapshot['engineVersion'] ?? '1.0';
const reader = SnapshotReader.forVersion(engineVersion);
const avg = reader.getAverageScore(result.evaluationSnapshot);
```

### 1.3 SchoolYear Additions

```prisma
model SchoolYear {
  // ... existing fields ...

  status              SchoolYearStatus?            @map("status")        // from Academic Lifecycle Phase 1
  promotionStatus     PromotionStatus?             @map("promotion_status")
  promotionLockedAt   DateTime?                    @map("promotion_locked_at")
  promotionHeartbeatAt DateTime?                   @map("promotion_heartbeat_at") // (F12)
  promotionSummary    Json?                        @map("promotion_summary")
  promotionSummaryStale Boolean  @default(false)   @map("promotion_summary_stale") // (F8)

  // Relations (new)
  promotionsFrom      PromotionResult[]            @relation("PromotionFromSchoolYear")
  promotionsTo        PromotionResult[]            @relation("PromotionToSchoolYear")
}
```

**`promotionSummary` shape:**
```json
{
  "totalStudents": 120,
  "promoted": 95,
  "retained": 18,
  "graduated": 7,
  "overrides": 3,
  "executedAt": "2026-12-20T18:00:00.000Z",
  "executedById": "uuid"
}
```

**`promotionSummaryStale` (F8):** Set to `true` after any override creation. Dashboards and reporting endpoints check this flag; if stale, they should either recompute from `effective_promotion_results` or display a "summary may be outdated" banner.

### 1.4 LevelGrade Additions

```prisma
model LevelGrade {
  // ... existing fields ...

  nextLevelGradeId    String?      @map("next_level_grade_id")
  isGraduating        Boolean      @default(false) @map("is_graduating")

  nextLevelGrade      LevelGrade?  @relation("LevelGradeProgression", fields: [nextLevelGradeId], references: [id])
}
```

**Migration notes:**
- `nextLevelGradeId` nullable FK to self. No cycles. Self-reference check enforced via raw SQL CHECK constraint.
- `isGraduating` marks terminal grades within an education level.
- No `nextEducationLevelId` — cross-level progression is handled by `nextLevelGradeId → LevelGrade.educationLevelId` (traverse the FK).

#### CHECK Constraint (raw SQL)

```sql
ALTER TABLE level_grades
ADD CONSTRAINT level_grades_no_self_ref
CHECK (next_level_grade_id IS NULL OR next_level_grade_id <> id);
```

### 1.5 CourseStudent Additions (F1)

```prisma
model CourseStudent {
  // ... existing fields (no structural changes) ...

  promotionResultFrom  PromotionResult?  @relation("PromotionFromCourseStudent")
  promotionResultTo    PromotionResult?  @relation("PromotionToCourseStudent")
}
```

These are explicit back-references using the named relations defined on `PromotionResult` (`PromotionFromCourseStudent`, `PromotionToCourseStudent`). No FKs or indexes needed — the owning side (`PromotionResult`) already defines them.

---

## Part 2 — Database Migration Plan

### Prerequisite (F7)

```
Academic Lifecycle Phase 1 migration must be deployed first.

That migration introduces:
- SchoolYearStatus enum (PLANNING, ACTIVE, CLOSED)
- SchoolYear.status column (backfilled from isActive)

The Promotion migrations depend on SchoolYearStatus existing.
```

### Naming Convention

All migrations follow the existing pattern: `YYYYMMDDHHMMSS_description`.

| Migration | File Name | Dependencies |
|-----------|-----------|--------------|
| A | `20260612000001_add_promotion_enums` | None |
| B | `20260612000002_add_school_year_promotion_fields` | A, Academic Lifecycle Phase 1 |
| C | `20260612000003_add_level_grade_progression_fields` | None |
| D | `20260612000004_create_promotion_results` | A, B, C |
| E | `20260612000005_backfill_from_level_grade_id` | D |

---

### Migration A — Promotion Enums

**Changes:**
```sql
CREATE TYPE "PromotionOutcome" AS ENUM ('PROMOTED', 'RETAINED', 'GRADUATED');
CREATE TYPE "PromotionStatus" AS ENUM ('PREVIEWED', 'EXECUTING', 'COMPLETED');
```

**Data backfill:** None required.

**Verification:**
```sql
SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromotionOutcome');
SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromotionStatus');
```

**Rollback:**
```sql
DROP TYPE IF EXISTS "PromotionOutcome";
DROP TYPE IF EXISTS "PromotionStatus";
```

---

### Migration B — SchoolYear Promotion Fields (F7, F12)

**Changes:**
```sql
-- Add promotion lifecycle columns ONLY (status already added by Academic Lifecycle)
ALTER TABLE "school_years" ADD COLUMN "promotion_status" "PromotionStatus";
ALTER TABLE "school_years" ADD COLUMN "promotion_locked_at" TIMESTAMP(3);
ALTER TABLE "school_years" ADD COLUMN "promotion_heartbeat_at" TIMESTAMP(3);
ALTER TABLE "school_years" ADD COLUMN "promotion_summary" JSONB;
ALTER TABLE "school_years" ADD COLUMN "promotion_summary_stale" BOOLEAN NOT NULL DEFAULT false;
```

**Indexes:**
```sql
CREATE INDEX "school_years_promotion_status_idx" ON "school_years"("promotion_status");
```

**Verification:**
```sql
SELECT id, year, status, promotion_status FROM school_years LIMIT 5;
```

**Rollback:**
```sql
ALTER TABLE "school_years" DROP COLUMN "promotion_summary_stale";
ALTER TABLE "school_years" DROP COLUMN "promotion_summary";
ALTER TABLE "school_years" DROP COLUMN "promotion_heartbeat_at";
ALTER TABLE "school_years" DROP COLUMN "promotion_locked_at";
ALTER TABLE "school_years" DROP COLUMN "promotion_status";
DROP INDEX IF EXISTS "school_years_promotion_status_idx";
```

---

### Migration C — LevelGrade Progression Fields

**Changes:**
```sql
ALTER TABLE "level_grades" ADD COLUMN "next_level_grade_id" TEXT;
ALTER TABLE "level_grades" ADD COLUMN "is_graduating" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "level_grades"
ADD CONSTRAINT "level_grades_no_self_ref"
CHECK (next_level_grade_id IS NULL OR next_level_grade_id <> id);
```

**Foreign Key:**
```sql
ALTER TABLE "level_grades"
ADD CONSTRAINT "level_grades_next_level_grade_id_fkey"
FOREIGN KEY ("next_level_grade_id") REFERENCES "level_grades"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
```

**Indexes:**
```sql
CREATE INDEX "level_grades_next_level_grade_id_idx" ON "level_grades"("next_level_grade_id");
```

**Verification:**
```sql
SELECT id, name, next_level_grade_id, is_graduating FROM level_grades LIMIT 10;
```

**Rollback:**
```sql
ALTER TABLE "level_grades" DROP CONSTRAINT IF EXISTS "level_grades_next_level_grade_id_fkey";
ALTER TABLE "level_grades" DROP CONSTRAINT IF EXISTS "level_grades_no_self_ref";
ALTER TABLE "level_grades" DROP COLUMN "is_graduating";
ALTER TABLE "level_grades" DROP COLUMN "next_level_grade_id";
DROP INDEX IF EXISTS "level_grades_next_level_grade_id_idx";
```

---

### Migration D — PromotionResult Table (F3, F5)

**Changes:**
```sql
CREATE TABLE "promotion_results" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "from_school_year_id" TEXT NOT NULL,
    "to_school_year_id" TEXT,
    "from_course_student_id" TEXT NOT NULL,
    "to_course_student_id" TEXT,
    "from_level_grade_id" TEXT,
    "to_level_grade_id" TEXT,
    "result" "PromotionOutcome" NOT NULL,
    "criteria" JSONB NOT NULL,
    "evaluation_snapshot" JSONB NOT NULL DEFAULT '{}',
    "reason" VARCHAR(500),
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "decided_by_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promotion_results_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "promotion_results_institution_id_idx" ON "promotion_results"("institution_id");
CREATE INDEX "promotion_results_student_id_idx" ON "promotion_results"("student_id");
CREATE INDEX "promotion_results_student_id_from_school_year_id_idx" ON "promotion_results"("student_id", "from_school_year_id");
CREATE INDEX "promotion_results_from_school_year_id_idx" ON "promotion_results"("from_school_year_id");
CREATE INDEX "promotion_results_to_school_year_id_idx" ON "promotion_results"("to_school_year_id");
CREATE INDEX "promotion_results_result_idx" ON "promotion_results"("result");

-- Foreign Keys
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_institution_id_fkey"
    FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_from_school_year_id_fkey"
    FOREIGN KEY ("from_school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_to_school_year_id_fkey"
    FOREIGN KEY ("to_school_year_id") REFERENCES "school_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_from_course_student_id_fkey"
    FOREIGN KEY ("from_course_student_id") REFERENCES "course_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_to_course_student_id_fkey"
    FOREIGN KEY ("to_course_student_id") REFERENCES "course_students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_decided_by_id_fkey"
    FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Verification:**
```sql
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promotion_results');
SELECT COUNT(*) FROM promotion_results;
```

**Rollback:**
```sql
DROP TABLE IF EXISTS "promotion_results" CASCADE;
```

---

### Migration E — Historical Backfill of fromLevelGradeId

**Backfill SQL:**
```sql
UPDATE "promotion_results" pr
SET "from_level_grade_id" = c.level_grade_id
FROM "course_students" cs
JOIN "courses" c ON c.id = cs.course_id
WHERE pr.from_course_student_id = cs.id
  AND pr.from_level_grade_id IS NULL
  AND c.level_grade_id IS NOT NULL;
```

**Verification:**
```sql
SELECT COUNT(*) FROM promotion_results
WHERE from_level_grade_id IS NULL;
```

**Note:** Records where `Course.levelGradeId` was null remain with `fromLevelGradeId = null`. This is accepted technical debt for legacy pre-LevelGrade data (F6).

**Rollback:**
```sql
UPDATE "promotion_results" SET "from_level_grade_id" = NULL;
```

---

## Part 3 — Service Architecture

### 3.1 Module Structure

```
src/modules/promotion/
├── promotion.module.ts
├── promotion.controller.ts
├── services/
│   ├── promotion-preview.service.ts
│   ├── promotion-execution.service.ts
│   ├── promotion-override.service.ts
│   └── promotion-reporting.service.ts
├── dto/
│   ├── create-override.dto.ts
│   ├── query-results.dto.ts
│   └── preview-response.dto.ts
├── engine/
│   ├── promotion-engine.ts
│   ├── rules/
│   │   ├── base-rule.ts
│   │   ├── average-score.rule.ts
│   │   ├── pending-subjects.rule.ts
│   │   ├── core-subjects.rule.ts
│   │   └── attendance.rule.ts
│   └── snapshot-reader.ts
└── utils/
    ├── effective-result.view.ts
    └── destination-resolver.ts
```

### 3.2 Service Responsibilities

#### PromotionPreviewService

**Scope:** Builds a preview of what the promotion outcome would be without writing anything.

```typescript
@Injectable()
export class PromotionPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionEngine: PromotionEngine,
  ) {}

  async preview(
    schoolYearId: string,
    institutionId: string,
    userId: string,
  ): Promise<PreviewResponse> { /* ... */ }
}
```

**Rules:**
- Must NOT write any PromotionResults or CourseStudents to the database.
- Must verify `promotionStatus != 'EXECUTING'` before running (invariant I21).
- Must verify `SchoolYear.status = 'CLOSED'` before running.
- Must set `promotionStatus = 'PREVIEWED'` on the SchoolYear after successful computation. This is the only allowed DB write.
- Must load the same criteria/config that the engine would use during execution.
- Must return per-student projected outcomes + aggregate statistics.

---

#### PromotionExecutionService

**Scope:** Executes the promotion process — creates PromotionResults and destination CourseStudents.

```typescript
@Injectable()
export class PromotionExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionEngine: PromotionEngine,
    @InjectQueue(QUEUES.AUDIT)
    private readonly auditQueue: Queue,
  ) {}

  async execute(
    schoolYearId: string,
    institutionId: string,
    userId: string,
  ): Promise<ExecuteResponse> { /* ... */ }
}
```

**Execution flow:**
```
0. PRECHECK: verify schoolYear.promotionStatus === 'PREVIEWED'
   If not → throw PROMOTION_NOT_PREVIEWED

1. LOCK: UPDATE school_years SET promotion_status = 'EXECUTING', promotion_locked_at = NOW()
         WHERE id = ? AND promotion_status = 'PREVIEWED'

2. IF affected = 0 → throw CONCURRENT_EXECUTION

3. Load all CourseStudents for the SchoolYear (batched, N at a time)

4. PRE-RESOLVE DESTINATIONS (F4):
   Analyze all students; compute unique set of (targetSchoolYearId, toLevelGradeId) pairs.
   For each pair: find or create the destination Course.
   Store in Map<"schoolYearId:levelGradeId", CourseId>.

5. FOR EACH student, within a TRANSACTION:
   a. Check no existing result for (studentId, fromSchoolYearId) → skip if exists
   b. Run engine → result, toLevelGradeId, toSchoolYearId
   c. If PROMOTED or RETAINED:
      - Read destination Course from pre-resolved Map (no DB race)
      - Create CourseStudent
      - Copy REGULAR StudentCourseSubject assignments
   d. Create PromotionResult with full snapshot
   e. COMMIT

6. Every 100 students, update heartbeat (F12):
   UPDATE school_years SET promotion_heartbeat_at = NOW() WHERE id = ?

7. UPDATE school_years SET promotion_status = 'COMPLETED', promotion_summary = {...}
   WHERE id = ?

8. Dispatch audit log
```

**Heartbeat recovery (F12):** Before acquiring the lock, check for stale executions:
```typescript
const stale = await this.prisma.schoolYear.findFirst({
  where: {
    institutionId,
    promotionStatus: 'EXECUTING',
    promotionHeartbeatAt: { lt: new Date(Date.now() - 15 * 60 * 1000) }
  }
});
```

---

#### PromotionOverrideService

**Scope:** Creates manual overrides to existing promotion outcomes.

```typescript
@Injectable()
export class PromotionOverrideService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.AUDIT)
    private readonly auditQueue: Queue,
  ) {}

  async createOverride(
    dto: CreateOverrideDto,
    institutionId: string,
    userId: string,
  ): Promise<PromotionResult> { /* ... */ }
}
```

**Rules:**
- Must verify `promotionStatus != 'EXECUTING'` (invariant I20).
- Must verify user is ADMIN or DIRECTOR (CASL).
- Must require non-empty `reason` (min 10 chars).
- Must create a new PromotionResult with `isOverride = true`.
- Must mark `promotionSummaryStale = true` on the SchoolYear (F8).

**Override criteria strategy (F9):**
1. Copy `criteria` from the most recent non-override (`isOverride = false`) PromotionResult for the same `(studentId, fromSchoolYearId)`.
2. If no prior result exists, use a snapshot of the current institution promotion configuration (`Institution.settings.academicClosure`).
3. `evaluationSnapshot` defaults to `{}` via `@default("{}")` — override creation may leave it empty.

**Override without prior result (F14):**
If no prior PromotionResult exists for the student, resolve `fromCourseStudentId` from the student's active CourseStudent in the source SchoolYear. If no CourseStudent exists, reject with `STUDENT_NOT_ENROLLED_IN_YEAR`.

---

#### PromotionReportingService

**Scope:** Statistics, effective-result resolution, historical trends, export.

```typescript
@Injectable()
export class PromotionReportingService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getStatistics(schoolYearId: string, institutionId: string): Promise<PromotionStatistics> { /* ... */ }
  async getStudentHistory(studentId: string, institutionId: string): Promise<StudentPromotionHistory> { /* ... */ }
  async getResults(schoolYearId: string, filters: ResultFilters, institutionId: string): Promise<PromotionResult[]> { /* ... */ }
}
```

**All queries MUST:**
- Use the `effective_promotion_results` view.
- Include `WHERE institution_id = ?` for tenant isolation.
- Direct queries against `promotion_results` are strongly discouraged.

---

### 3.3 PromotionEngine (Pure Logic)

```typescript
@Injectable()
export class PromotionEngine {
  constructor(private readonly rules: PromotionRule[]) {}

  evaluate(
    student: StudentEvaluationData,
    criteria: PromotionCriteria,
    levelGrade: LevelGrade | null,
  ): PromotionEngineResult {
    let passed = true;
    const results: RuleResult[] = [];

    for (const rule of this.rules) {
      const ruleResult = rule.evaluate(student, criteria);
      results.push(ruleResult);
      if (!ruleResult.passed) passed = false;
    }

    if (levelGrade?.isGraduating && passed) {
      return { result: PromotionOutcome.GRADUATED, toLevelGrade: null, ruleResults: results };
    }

    if (passed) {
      return {
        result: PromotionOutcome.PROMOTED,
        toLevelGrade: levelGrade?.nextLevelGrade ?? null,
        ruleResults: results,
      };
    }

    return {
      result: PromotionOutcome.RETAINED,
      toLevelGrade: levelGrade,
      ruleResults: results,
    };
  }
}
```

### 3.4 Effective Result View Utility

```typescript
@Injectable()
export class EffectiveResultService {
  constructor(private readonly prisma: PrismaService) {}

  /** Raw SQL via Prisma.$queryRaw — fetches effective results using DISTINCT ON */
  async getEffectiveResults(schoolYearId: string, institutionId: string): Promise<PromotionResult[]> {
    return this.prisma.$queryRaw`
      SELECT DISTINCT ON (pr.student_id, pr.from_school_year_id)
        pr.*
      FROM promotion_results pr
      WHERE pr.from_school_year_id = ${schoolYearId}::uuid
        AND pr.institution_id = ${institutionId}
      ORDER BY
        pr.student_id,
        pr.from_school_year_id,
        pr.decided_at DESC,
        pr.id DESC
    `;
  }

  /** Get the single effective result for one student */
  async getEffectiveResult(studentId: string, fromSchoolYearId: string): Promise<PromotionResult | null> {
    const results = await this.prisma.$queryRaw<PromotionResult[]>`
      SELECT *
      FROM promotion_results
      WHERE student_id = ${studentId}::uuid
        AND from_school_year_id = ${fromSchoolYearId}::uuid
      ORDER BY decided_at DESC, id DESC
      LIMIT 1
    `;
    return results[0] ?? null;
  }
}
```

---

## Part 4 — Effective Result Strategy

### 4.1 Database View

```sql
CREATE VIEW effective_promotion_results AS
SELECT DISTINCT ON (student_id, from_school_year_id)
  *
FROM promotion_results
ORDER BY
  student_id,
  from_school_year_id,
  decided_at DESC,
  id DESC;
```

**Index to support the view:**
```sql
CREATE INDEX idx_promotion_results_effective
ON promotion_results (student_id, from_school_year_id, decided_at DESC, id DESC);
```

### 4.2 Usage Rules

| Use Case | Query Against | Rationale |
|----------|---------------|-----------|
| Statistics (counts, rates) | `effective_promotion_results` | Avoids double-counting overridden students |
| Student academic history | `effective_promotion_results` | Shows only the current decision |
| Export (CSV, reports) | `effective_promotion_results` | Correct per-student results |
| Audit / compliance | `promotion_results` (raw) | Full history of all decisions needed |
| Override creation checks | `promotion_results` (raw) | Need to check if any result exists |
| Dashboard widgets | `effective_promotion_results` | Accurate summary numbers |

**Enforcement:** All queries against either object must include `WHERE institution_id = ?` for multi-tenant isolation (F3).

---

## Part 5 — API Contract Design

### 5.1 Endpoint Overview

| Method | Path | Service | Description |
|--------|------|---------|-------------|
| `GET` | `/promotion/preview/:schoolYearId` | Preview | Run dry-run promotion for a SchoolYear |
| `POST` | `/promotion/execute/:schoolYearId` | Execution | Execute promotion process |
| `POST` | `/promotion/override` | Override | Create manual override |
| `GET` | `/promotion/results` | Reporting | List PromotionResults for a SchoolYear |
| `GET` | `/promotion/statistics/:schoolYearId` | Reporting | Aggregated promotion stats |
| `GET` | `/promotion/student-history/:studentId` | Reporting | All promotion results for a student |

### 5.2 Endpoint Details

#### GET /promotion/preview/:schoolYearId

**Auth:** `@CheckAbility({ action: Action.Read, subject: 'PromotionResult' })`

**Request parameters:**
```typescript
schoolYearId: string (uuid)
```

**Response (200):**
```typescript
interface PreviewResponse {
  schoolYearId: string;
  evaluatedAt: string;
  totalStudents: number;
  projections: { promoted: number; retained: number; graduated: number; };
  students: StudentProjection[];
}
```

**Errors:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `SCHOOL_YEAR_NOT_CLOSED` | SchoolYear is not CLOSED |
| 409 | `PROMOTION_ALREADY_EXECUTING` | promotionStatus = EXECUTING (I21) |
| 404 | `SCHOOL_YEAR_NOT_FOUND` | Invalid schoolYearId |

---

#### POST /promotion/execute/:schoolYearId

**Auth:** `@CheckAbility({ action: Action.Create, subject: 'PromotionExecution' })`

**Response (200):**
```typescript
interface ExecuteResponse {
  schoolYearId: string;
  executedAt: string;
  summary: {
    totalStudents: number;
    promoted: number;
    retained: number;
    graduated: number;
    errors: number;
    skipped: number;
  };
}
```

**Errors:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `SCHOOL_YEAR_NOT_CLOSED` | SchoolYear is not CLOSED |
| 400 | `PROMOTION_NOT_PREVIEWED` | Execute was called without a preview — promotion must first pass through PREVIEWED |
| 409 | `CONCURRENT_EXECUTION` | Another execution is already running |

**Lock acquisition:**
```sql
UPDATE school_years
SET promotion_status = 'EXECUTING', promotion_locked_at = NOW()
WHERE id = ?
  AND promotion_status = 'PREVIEWED'
```

---

#### POST /promotion/override

**Auth:** `@CheckAbility({ action: Action.Create, subject: 'PromotionResult' })` (ADMIN/DIRECTOR only per CASL)

**Request body:**
```typescript
interface CreateOverrideDto {
  studentId: string;
  fromSchoolYearId: string;
  result: PromotionOutcome;
  reason: string; // min 10 chars
  toSchoolYearId?: string; // auto-resolved if not provided
}
```

**Zod Schema:**
```typescript
export const CreateOverrideSchema = z.object({
  studentId: z.string().uuid(),
  fromSchoolYearId: z.string().uuid(),
  result: z.nativeEnum(PromotionOutcome),
  reason: z.string().min(10, 'La justificación debe tener al menos 10 caracteres'),
  toSchoolYearId: z.string().uuid().optional(),
}).strict();
```

**Response (201):**
```typescript
interface OverrideResponse {
  id: string;
  result: PromotionOutcome;
  isOverride: true;
  reason: string;
  decidedAt: string;
}
```

**Override behavior without prior result (F14):**
If no prior PromotionResult exists for the student, the service resolves `fromCourseStudentId` from the student's active CourseStudent in the source SchoolYear. If no CourseStudent exists, rejects with `STUDENT_NOT_ENROLLED_IN_YEAR`.

**Errors:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `OVERRIDE_FORBIDDEN_DURING_EXECUTION` | promotionStatus = EXECUTING (I20) |
| 400 | `INVALID_LEVEL_GRADE_PROGRESSION` | Override would create invalid LevelGrade path |
| 400 | `OVERRIDE_REASON_REQUIRED` | Reason is empty or too short |
| 400 | `STUDENT_NOT_ENROLLED_IN_YEAR` | Student has no CourseStudent in source SchoolYear (F14) |
| 404 | `STUDENT_NOT_FOUND` | Invalid studentId |
| 409 | `STUDENT_ALREADY_GRADUATED` | Student has effective GRADUATED result (I2) |

---

#### GET /promotion/results

**Auth:** `@CheckAbility({ action: Action.Read, subject: 'PromotionResult' })`

**Request query:**
```typescript
interface ResultQueryDto {
  schoolYearId: string;
  studentId?: string;
  result?: PromotionOutcome;
  isOverride?: boolean;
  page?: number;  // @default 1
  limit?: number; // @default 100
}
```

**Response (200):** `PromotionResult[]` (array directly, no wrapper per codebase convention).

**Note:** Queries the `effective_promotion_results` view by default. Add `?includeHistory=true` to query the raw table.
All queries are scoped by `institutionId` from `@InstitutionId()`.

---

#### GET /promotion/statistics/:schoolYearId

**Auth:** `@CheckAbility({ action: Action.Read, subject: 'PromotionResult' })`

**Response (200):**
```typescript
interface PromotionStatistics {
  schoolYearId: string;
  totalStudents: number;
  promoted: { count: number; percentage: number; };
  retained: { count: number; percentage: number; };
  graduated: { count: number; percentage: number; };
  overrides: { count: number; list: { ... }[]; };
  summaryStale: boolean; // from SchoolYear.promotionSummaryStale (F8)
}
```

---

#### GET /promotion/student-history/:studentId

**Auth:** `@CheckAbility({ action: Action.Read, subject: 'PromotionResult' })`
**(Guardian sees only own children — handled by CaslGuard)**

**Response (200):**
```typescript
interface StudentPromotionHistory {
  studentId: string;
  studentFullName: string;
  results: {
    fromSchoolYearId: string;
    toSchoolYearId: string | null;
    result: PromotionOutcome;
    isOverride: boolean;
    reason: string | null;
    decidedAt: string;
  }[];
  effectiveGraduationDate: string | null;
}
```

---

## Part 6 — Transaction Boundaries

### 6.1 Preview Transaction

**Boundary:** No transaction (read-only).
**Isolation level:** Read Committed (default).
**Idempotency:** Always idempotent.

### 6.2 Execute Transaction

**Boundary:** Three-phase with destination pre-resolution (F4).

```
Pre-Phase 0 — Preview Precondition Check (no TX)
─────────────────────────────────────────────
  schoolYear = SELECT promotion_status FROM school_years WHERE id = $schoolYearId
  IF schoolYear.promotionStatus != 'PREVIEWED':
    throw PROMOTION_NOT_PREVIEWED

Phase 1 — Lock Acquisition (single atomic UPDATE)
─────────────────────────────────────────────
  UPDATE school_years
  SET promotion_status = 'EXECUTING', promotion_locked_at = NOW()
  WHERE id = $schoolYearId
    AND promotion_status = 'PREVIEWED'
  ── COMMIT
  IF affected = 0 → throw CONCURRENT_EXECUTION

Phase 1.5 — Destination Course Pre-resolution (F4) [NEW]
─────────────────────────────────────────────
  Analyze all students.
  Compute unique set of (targetSchoolYearId, toLevelGradeId) pairs.
  FOR EACH unique pair:
    SELECT id FROM courses
    WHERE school_year_id = $targetSchoolYearId
      AND level_grade_id = $toLevelGradeId
    LIMIT 1;
    IF not found:
      INSERT INTO courses (...) VALUES (...) RETURNING id;
  Store resolved Course IDs in Map<"schoolYearId:levelGradeId", CourseId>.
  ── This runs in a single short transaction, outside per-student loop.

Phase 2 — Per-Student Transactions (N transactions, READ COMMITTED)
─────────────────────────────────────────────
  FOR EACH student (batched in groups of 50):
    BEGIN TX
      SELECT 1 FROM promotion_results
      WHERE student_id = $studentId AND from_school_year_id = $schoolYearId
      LIMIT 1;
      IF found → SKIP

      result = engine.evaluate(studentData, criteria, levelGrade)

      IF result == PROMOTED || result == RETAINED:
        course = preResolvedMap.get(`${targetYearId}:${toLevelGradeId}`)
        INSERT INTO course_students (course_id, student_id, ...)
        INSERT INTO student_course_subjects (...) -- REGULAR subjects only

      INSERT INTO promotion_results (...)

      COMMIT

  Heartbeat every 100 students:
    UPDATE school_years SET promotion_heartbeat_at = NOW() WHERE id = ?

Phase 3 — Finalization (single atomic UPDATE)
─────────────────────────────────────────────
  UPDATE school_years
  SET promotion_status = 'COMPLETED', promotion_summary = $summaryJson
  WHERE id = $schoolYearId
  ── COMMIT
```

**Failure model:**
| Failure Point | Recovery |
|---------------|----------|
| Crash during Phase 1 | Lock acquired (promotion_status = 'EXECUTING'). Stale heartbeat detected (F12). Recovery resets promotion_status to PREVIEWED or NULL via admin action. |
| Crash during Phase 2 | Already-processed students have results (idempotent skip). Others processed on re-run. |
| Crash during Phase 3 | Results persisted. Admin or re-run sets COMPLETED (skips all via idempotent guard). |
| Per-student TX failure | Logged as error. Other students continue. Summary includes error count. |

### 6.3 Override Transaction

**Boundary:** Single atomic transaction.
```sql
BEGIN TX
  SELECT promotion_status FROM school_years WHERE id = $schoolYearId
  -- If EXECUTING → throw OVERRIDE_FORBIDDEN_DURING_EXECUTION

  INSERT INTO promotion_results (...) -- with isOverride = true

  UPDATE school_years SET promotion_summary_stale = true WHERE id = $schoolYearId (F8)
COMMIT
```

### 6.4 Promotion Status Lifecycle

**Status transitions:**

```
(null/initial)
     │
     ▼  (preview)
 PREVIEWED
     │
     ▼  (execute — lock)
 EXECUTING
     │
     ▼  (execute — finalize)
 COMPLETED  ◄── TERMINAL
```

**Allowed transitions:**

| From | To | Trigger | Notes |
|------|----|---------|-------|
| `null` | `PREVIEWED` | Preview endpoint | Sets status after successful preview computation |
| `PREVIEWED` | `EXECUTING` | Execute endpoint lock | Atomic UPDATE acquires the execution lock |
| `EXECUTING` | `COMPLETED` | Execute endpoint finalization | Automatic on successful execution |
| `EXECUTING` | `PREVIEWED` | Admin recovery | Stale heartbeat recovery only (F12) |

**Rules:**
- `COMPLETED` is **terminal**. No automatic transition back to `PREVIEWED`.
- Direct `null → EXECUTING` is **forbidden**. Preview is mandatory.
- Preview sets `promotionStatus = 'PREVIEWED'` only when current status is `null`. If `COMPLETED`, preview returns a read-only cached summary (`promotionSummary`) without changing the status.
- To re-execute after `COMPLETED` (e.g., new students added after initial execution), an administrator must use a dedicated recovery endpoint to reset `promotionStatus = null`, then re-run preview → execute.

### 6.5 Reporting Transaction

**Boundary:** No transaction (read-only). Read Committed.

---

## Part 7 — Authorization Matrix

### 7.1 CASL Subjects

```typescript
type Subjects = '...existing...' | 'PromotionResult' | 'PromotionExecution';
```

### 7.2 Permission Matrix

| Endpoint | SUPER_ADMIN | ADMIN | DIRECTOR | SECRETARY | PRECEPTOR | TEACHER | GUARDIAN |
|----------|-------------|-------|----------|-----------|-----------|---------|----------|
| `GET /promotion/preview/:id` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /promotion/execute/:id` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /promotion/override` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /promotion/results` | ✅ (all) | ✅ (own) | ✅ (own) | ✅ | ✅ | ✅ (*) | ❌ |
| `GET /promotion/statistics/:id` | ✅ (all) | ✅ (own) | ✅ (own) | ✅ | ✅ | ❌ | ❌ |
| `GET /promotion/student-history/:id` | ✅ (all) | ✅ (own) | ✅ (own) | ✅ | ✅ | ✅ (*) | ✅ (**) |

### 7.3 CASL Rule Implementation (F3)

```typescript
// ADMIN/DIRECTOR (own institution):
can([Action.Read, Action.Create], 'PromotionResult', { institutionId: user.institutionId });
can([Action.Read, Action.Create], 'PromotionExecution', { institutionId: user.institutionId });

// TEACHER — read only own institution:
can(Action.Read, 'PromotionResult', { institutionId: user.institutionId });

// GUARDIAN — read only own institution (further filtered by guardian-child in service):
can(Action.Read, 'PromotionResult', { institutionId: user.institutionId });

// SUPER_ADMIN — unrestricted:
can(Action.Manage, ['PromotionResult', 'PromotionExecution']);
```

The direct `institutionId` filter on `PromotionResult` (F3) makes this simpler and more performant than nested-path alternatives.

---

## Part 8 — Error Handling

### 8.1 Error Catalog

| Code | HTTP Status | Message (Spanish) | Trigger |
|------|-------------|-------------------|---------|
| `SCHOOL_YEAR_NOT_CLOSED` | 400 | El año lectivo no está cerrado | Preview/Execute on non-CLOSED year |
| `SCHOOL_YEAR_NOT_FOUND` | 404 | Año lectivo no encontrado | Invalid schoolYearId |
| `CONCURRENT_EXECUTION` | 409 | Ya hay una ejecución de promoción en curso | Double execute attempt |
| `PROMOTION_NOT_PREVIEWED` | 400 | Debes generar una vista previa antes de ejecutar | Execute without preview |
| `OVERRIDE_FORBIDDEN_DURING_EXECUTION` | 400 | No se pueden crear overriding durante la ejecución | I20 — Override while EXECUTING |
| `INVALID_LEVEL_GRADE_PROGRESSION` | 400 | La progresión de grado no es válida | Override creates invalid LevelGrade path |
| `STUDENT_ALREADY_GRADUATED` | 409 | El estudiante ya ha egresado | I2 — New result for graduated student |
| `OVERRIDE_REASON_REQUIRED` | 400 | La justificación es obligatoria (mín. 10 caracteres) | Empty/short reason |
| `STUDENT_NOT_FOUND` | 404 | Estudiante no encontrado | Invalid studentId |
| `STUDENT_NOT_ENROLLED_IN_YEAR` | 400 | El estudiante no está inscripto en el año lectivo | Override without CourseStudent (F14) |
| `PROMOTION_ALREADY_EXECUTING` | 409 | No se puede generar vista previa durante la ejecución | I21 — Preview while EXECUTING |

### 8.2 Audit Events (F11)

| Event | Action | Resource | resourceId | before | after |
|-------|--------|----------|------------|--------|-------|
| PROMOTION_EXECUTION_STARTED | `UPDATE` | `SchoolYear` | schoolYearId | `{ promotionStatus }` | `{ promotionStatus: 'EXECUTING' }` |
| PROMOTION_EXECUTION_COMPLETED | `UPDATE` | `SchoolYear` | schoolYearId | `{ promotionStatus: 'EXECUTING' }` | `{ promotionStatus: 'COMPLETED', summary }` |
| PROMOTION_RESULT_CREATED | `CREATE` | `PromotionResult` | result.id | `null` | `{ id, studentId, result, criteria }` |
| PROMOTION_OVERRIDE_CREATED | `CREATE` | `PromotionResult` | result.id | Prior effective result (or null) | `{ id, studentId, result, reason }` |

Dispatch pattern:
```typescript
await this.auditQueue.add(JOBS.AUDIT_LOG, {
  institutionId, userId,
  action: 'CREATE',
  resource: 'PromotionResult',
  resourceId: result.id,
  after: { id: result.id, studentId, result: result.result, isOverride },
}, JOB_OPTIONS.CRITICAL);
```

---

## Part 9 — Idempotency Strategy

### 9.1 Execute Idempotency

The execute process is **idempotent by design** — each per-student transaction checks for existing results before creating:

```sql
SELECT 1 FROM promotion_results
WHERE student_id = $studentId AND from_school_year_id = $schoolYearId
LIMIT 1;
-- If row exists → SKIP
```

Running execute twice creates no duplicate PromotionResults or CourseStudents.

### 9.2 Override Idempotency

Overrides are NOT idempotent — each call creates a new `PromotionResult` with higher `decidedAt`. The effective-result resolution ensures the latest override wins. This is intentional — each override represents a distinct decision point in the academic record.

### 9.3 Preview Idempotency

Always idempotent — read-only computation.

---

## Part 10 — Testing Strategy

### 10.1 Unit Tests

| Target | Test Cases | Mocked Dependencies |
|--------|------------|---------------------|
| `PromotionEngine` | Student with all grades ≥ 7 → PROMOTED | None (pure logic) |
| `PromotionEngine` | Student with failing grade → RETAINED | None |
| `PromotionEngine` | Student in graduating LevelGrade → GRADUATED | None |
| `PromotionEngine` | Student with too many pending subjects → RETAINED | None |
| `PromotionEngine` | Edge cases: empty grades, attendance below min | None |
| `AverageScoreRule` | Average 8.5 vs 6.5 with min 7.0 | None |
| `PendingSubjectsRule` | 0, 1, 3 pending with max 2 | None |
| `SnapshotReader` | v1.0 and v2.0 snapshots | None |
| `DestinationResolver` | PROMOTED → next, RETAINED → same, GRADUATED → null | PrismaService |

### 10.2 Integration Tests

| Target | Test Cases |
|--------|------------|
| `POST /promotion/preview/:id` | Returns correct projections; rejects non-CLOSED year |
| `POST /promotion/execute/:id` | Creates PromotionResults; creates destination CourseStudents; idempotent on re-run |
| `POST /promotion/execute/:id` | Copies REGULAR StudentCourseSubjects; skips RECURSE |
| `POST /promotion/execute/:id` | Pre-resolves destinations correctly (F4); no duplicate Courses |
| `POST /promotion/override` | Creates override with reason; rejects during EXECUTING |
| `POST /promotion/override` | Auto-populates `criteria` (F9); marks summary stale (F8) |
| `POST /promotion/override` | Rejects student without CourseStudent (F14) |
| `GET /promotion/statistics/:id` | Correct counts from effective view; respects overrides |
| `GET /promotion/student-history/:id` | Chronological results; effective graduation date |

### 10.3 Concurrency Tests

| Test Case | Setup | Expected Behavior |
|-----------|-------|-------------------|
| Double execute | Two simultaneous POST | First locks, second gets 409 CONCURRENT_EXECUTION |
| Override during execute | Execute running, override POST | Override gets 400 (I20) |
| Preview during execute | Execute running, preview GET | Preview rejected (I21) |
| Orphan recovery | Execute crashes; heartbeat stale | Recovery detects stale; re-run skips processed |
| Course race (F4) | Two students promoted to same LevelGrade | One Course created, both use it |

### 10.4 Migration Tests

| Test Case | Setup | Expected Behavior |
|-----------|-------|-------------------|
| Migration A | Fresh DB | Enums created |
| Migration B | After Academic Lifecycle | Columns added without conflict (F7) |
| Migration C | LevelGrades exist | nextLevelGradeId, isGraduating added |
| Migration D | Fresh DB | Table created with all constraints |
| Migration E | PromotionResults with null fromLevelGradeId | Backfilled where Course.levelGradeId available |

---

## Part 11 — Rollout Plan

### Phase 1 — Schema & Migrations

**Dependencies:** Academic Lifecycle Phase 1 must be deployed first (F7).

**Scope:**
- Run Migrations A through E.
- Create `effective_promotion_results` view.
- Add CHECK constraint on `level_grades`.
- Add CASL subjects `PromotionResult`, `PromotionExecution`.

### Phase 2 — Services

**Scope:**
- `PromotionEngine` with all rules.
- `PromotionPreviewService`, `PromotionExecutionService`, `PromotionOverrideService`, `PromotionReportingService`.
- `EffectiveResultService`, `DestinationResolver`.
- Unit tests.

### Phase 3 — API

**Scope:**
- `PromotionController` with 6 endpoints.
- DTOs, Zod schemas, decorators.
- Integration tests.

### Phase 4 — Frontend Integration

**Scope:**
- Promotion dashboard page.
- Preview results table, execute button, override form.
- React Query hooks in `src/lib/api/promotion.ts`.

### Phase 5 — Reporting

**Scope:**
- Statistics endpoint with dashboard-ready data.
- Export endpoints.
- Academic history integration.

### Phase 6 — Production Rollout

**Steps:**
1. Run migrations against staging with production-like data.
2. Stress test with 5000-student cohort.
3. Deploy backend first (backward-compatible migrations).
4. Deploy frontend.
5. Monitor: execution duration, error rate, override rate.

---

## Appendix A: Invariant Table (Final)

| # | Invariant | Enforced At |
|---|-----------|-------------|
| I1 | Effective result = latest by `decidedAt DESC, id DESC` per `(studentId, fromSchoolYearId)` | Application + DB View |
| I2 | GRADUATED students cannot receive new results | Application |
| I3 | SchoolYear must be CLOSED before promotion execution | Application |
| I4 | `fromSchoolYearId ≠ toSchoolYearId` | Application |
| I5 | GRADUATED: all "to" fields are null | Application |
| I6 | PROMOTED | RETAINED: `toSchoolYearId ≠ null` | Application |
| I7 | `toCourseStudent.course.schoolYearId = toSchoolYearId` | Application |
| I8 | RETAINED: `toLevelGradeId = fromLevelGradeId` | Application |
| I9 | PROMOTED: `toLevelGradeId ≠ null` and `≠ fromLevelGradeId` | Application |
| I10 | Only ADMIN and DIRECTOR can create overrides | CASL |
| I11 | Every override must have non-empty `reason` | Zod |
| I12 | Engine-generated records SHOULD contain fromLevelGradeId. Legacy records or records whose source Course lacked LevelGrade mapping may contain null (F6). | Application |
| I13 | No concurrent execution for same SchoolYear | DB (atomic UPDATE) |
| I14 | `evaluationSnapshot` required when `isOverride = false` | Application |
| I15 | `criteria` is never null | Application |
| I16 | Engine cannot execute if PendingSubjects ENROLLED exist | Application (blocked by CLOSED prerequisite) |
| I17 | Cannot PROMOTE to nonexistent LevelGrade | Application |
| I18 | `nextLevelGradeId ≠ id` (no self-reference) | DB (CHECK constraint) |
| I19 | `nextLevelGradeId` references existing LevelGrade in same institution | FK |
| I20 | Overrides forbidden while `promotionStatus = 'EXECUTING'` | Application |
| I21 | Preview forbidden while `promotionStatus = 'EXECUTING'` | Application |

---

> **Implementation note on first-result ordering:** Automatic (engine-generated) results are normally expected to precede overrides, but first-result overrides are supported for exceptional administrative cases (F14). No chronological restriction is enforced between automatic and override results.

---

### Implementation Backlog (Non-Blocking)

These items are acknowledged but do not block implementation. They should be addressed during or after the initial development cycle.

1. **`getEffectiveResult` tenant scoping** (§3.4, line 727): Add `institutionId` parameter and `WHERE institution_id = ?` to the raw SQL query for defense-in-depth tenant isolation.

2. **`NO_TARGET_SCHOOL_YEAR` error code**: Override auto-resolution (line 872) should reject with a specific error when no valid next SchoolYear can be resolved for PROMOTED/RETAINED outcomes. Currently no code covers this case in the error catalog.

3. **Composite index evaluation**: After production profiling, consider adding `@@index([institutionId, fromSchoolYearId])` for the common tenant-scoped SchoolYear query pattern. The separate indexes on `institutionId` and `fromSchoolYearId` suffice initially.

No schema changes are required for any backlog item.

---

*End of Technical Design Document v1.1 — Implementation Ready*
