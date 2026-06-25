// ── Promotion Result Type ──────────────────────
export type PromotionResultType =
  | 'PROMOTED'
  | 'RETAINED'
  | 'GRADUATED';

// ── Promotion Result (full model, camelCase) ───
export interface PromotionResult {
  id: string;
  institutionId: string;
  studentId: string;
  studentFullName: string;
  fromSchoolYearId: string;
  toSchoolYearId: string | null;
  fromCourseStudentId: string;
  toCourseStudentId: string | null;
  fromLevelGradeId: string | null;
  toLevelGradeId: string | null;
  result: PromotionResultType;
  criteria: Record<string, unknown>;
  evaluationSnapshot: Record<string, unknown>;
  reason: string | null;
  isOverride: boolean;
  decidedById: string;
  decidedByName: string;
  decidedAt: string;
}

// ── Preview ────────────────────────────────────
export interface RuleResultProjection {
  rule: string;
  passed: boolean;
  reason?: string;
}

export interface StudentProjection {
  studentId: string;
  studentFullName: string;
  result: PromotionResultType;
  toLevelGradeId: string | null;
  toSchoolYearId: string | null;
  ruleResults: RuleResultProjection[];
}

export interface PromotionPreviewResponse {
  schoolYearId: string;
  evaluatedAt: string;
  totalStudents: number;
  projections: {
    promoted: number;
    retained: number;
    graduated: number;
  };
  students: StudentProjection[];
}

// ── Statistics ─────────────────────────────────
export interface PromotionStatCount {
  count: number;
  percentage: number;
}

export interface PromotionStatisticsResponse {
  schoolYearId: string;
  totalStudents: number;
  promoted: PromotionStatCount;
  retained: PromotionStatCount;
  graduated: PromotionStatCount;
  overrides: { count: number };
  summaryStale: boolean;
}

// ── History ────────────────────────────────────
export interface PromotionHistoryItem {
  fromSchoolYearId: string;
  toSchoolYearId: string | null;
  result: PromotionResultType;
  isOverride: boolean;
  reason: string | null;
  decidedAt: string;
}

export interface StudentPromotionHistoryResponse {
  studentId: string;
  studentFullName: string;
  results: PromotionHistoryItem[];
  effectiveGraduationDate: string | null;
}

// ── Execute ────────────────────────────────────
export interface ExecutePromotionResponse {
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

// ── Override ───────────────────────────────────
export interface CreatePromotionOverrideDto {
  studentId: string;
  fromSchoolYearId: string;
  result: PromotionResultType;
  reason: string;
  toSchoolYearId?: string;
}

export interface OverrideResponse {
  id: string;
  result: PromotionResultType;
  isOverride: true;
  reason: string;
  decidedAt: string;
}

// ── Filters ────────────────────────────────────
export interface PromotionResultsFilters {
  schoolYearId: string;
  studentId?: string;
  result?: PromotionResultType;
  isOverride?: boolean;
}

// ── Summary (stored as JSON in SchoolYear) ─────
export interface PromotionSummary {
  totalStudents: number;
  promoted: number;
  retained: number;
  graduated: number;
  overrides: number;
  executedAt: string | null;
  executedById: string | null;
}
