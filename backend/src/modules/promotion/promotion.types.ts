import { PromotionOutcome } from '@prisma/client';

export interface StudentEvaluationData {
  studentId: string;
  courseStudentId: string;
  fromLevelGradeId: string | null;
  averageScore: number;
  totalGrades: number;
  pendingSubjects: PendingSubjectsData;
  failedCoreSubjectIds: string[];
  attendancePercentage: number;
  closingGradesEvaluated: number;
  closingGradesPassed: number;
  closingGradesFailed: number;
}

export interface PendingSubjectsData {
  total: number;
  completed: number;
  notCompleted: number;
}

export interface PromotionCriteria {
  engineVersion: string;
  minAverageScore: number;
  maxPendingSubjects: number;
  coreSubjects: string[];
  attendanceMinimum: number;
  closingGradeMinimum: number;
}

export interface StudentEvaluation {
  studentId: string;
  fromSchoolYearId: string;
  fromCourseStudentId: string;
  fromLevelGradeId: string | null;
  toSchoolYearId: string | null;
  engineResult: PromotionEngineResult;
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface PromotionEngineResult {
  result: PromotionOutcome;
  toLevelGradeId: string | null;
  ruleResults: RuleResult[];
  criteriaSnapshot: Record<string, unknown>;
  evaluationSnapshot: Record<string, unknown>;
}

export interface RuleResult {
  rule: string;
  passed: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface Destination {
  toSchoolYearId: string | null;
  toLevelGradeId: string | null;
}

export interface PromotionExecutionSummary {
  totalStudents: number;
  promoted: number;
  retained: number;
  graduated: number;
  errors: number;
  skipped: number;
}
