export interface PreviewResponse {
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

export interface StudentProjection {
  studentId: string;
  studentFullName: string;
  result: string;
  toLevelGradeId: string | null;
  toSchoolYearId: string | null;
  ruleResults: RuleResultProjection[];
}

export interface RuleResultProjection {
  rule: string;
  passed: boolean;
  reason?: string;
}

export interface ExecuteResponse {
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

export interface OverrideResponse {
  id: string;
  result: string;
  isOverride: true;
  reason: string;
  decidedAt: string;
}

export interface PromotionStatistics {
  schoolYearId: string;
  totalStudents: number;
  promoted: { count: number; percentage: number };
  retained: { count: number; percentage: number };
  graduated: { count: number; percentage: number };
  overrides: { count: number };
  summaryStale: boolean;
}

export interface StudentPromotionHistory {
  studentId: string;
  studentFullName: string;
  results: {
    fromSchoolYearId: string;
    toSchoolYearId: string | null;
    result: string;
    isOverride: boolean;
    reason: string | null;
    decidedAt: string;
  }[];
  effectiveGraduationDate: string | null;
}
