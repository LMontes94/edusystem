import { Injectable } from '@nestjs/common';
import { PromotionOutcome } from '@prisma/client';
import { BaseRule } from './rules/base-rule';
import { StudentEvaluationData, PromotionCriteria, PromotionEngineResult, RuleResult } from '../promotion.types';
import { AverageScoreRule } from './rules/average-score.rule';
import { PendingSubjectsRule } from './rules/pending-subjects.rule';
import { CoreSubjectsRule } from './rules/core-subjects.rule';
import { AttendanceRule } from './rules/attendance.rule';

@Injectable()
export class PromotionEngine {
  private readonly rules: BaseRule[];

  constructor() {
    this.rules = [
      new AverageScoreRule(),
      new PendingSubjectsRule(),
      new CoreSubjectsRule(),
      new AttendanceRule(),
    ];
  }

  evaluate(
    student: StudentEvaluationData,
    criteria: PromotionCriteria,
    isGraduatingLevel: boolean,
    nextLevelGradeId: string | null,
  ): PromotionEngineResult {
    const results: RuleResult[] = [];
    let allPassed = true;

    for (const rule of this.rules) {
      const ruleResult = rule.evaluate(student, criteria);
      results.push({ ...ruleResult, rule: rule.name });
      if (!ruleResult.passed) allPassed = false;
    }

    const criteriaSnapshot: Record<string, unknown> = {
      engineVersion: criteria.engineVersion,
      minAverageScore: criteria.minAverageScore,
      maxPendingSubjects: criteria.maxPendingSubjects,
      coreSubjects: criteria.coreSubjects,
      attendanceMinimum: criteria.attendanceMinimum,
      closingGradeMinimum: criteria.closingGradeMinimum,
    };

    const evaluationSnapshot: Record<string, unknown> = {
      engineVersion: criteria.engineVersion,
      averageScore: student.averageScore,
      totalGrades: student.totalGrades,
      pendingSubjects: {
        total: student.pendingSubjects.total,
        completed: student.pendingSubjects.completed,
        notCompleted: student.pendingSubjects.notCompleted,
      },
      failedCoreSubjects: student.failedCoreSubjectIds,
      attendancePercentage: student.attendancePercentage,
      closingGradesEvaluated: student.closingGradesEvaluated,
      closingGradesPassed: student.closingGradesPassed,
      closingGradesFailed: student.closingGradesFailed,
    };

    if (isGraduatingLevel && allPassed) {
      return {
        result: PromotionOutcome.GRADUATED,
        toLevelGradeId: null,
        ruleResults: results,
        criteriaSnapshot,
        evaluationSnapshot,
      };
    }

    if (allPassed) {
      return {
        result: PromotionOutcome.PROMOTED,
        toLevelGradeId: nextLevelGradeId,
        ruleResults: results,
        criteriaSnapshot,
        evaluationSnapshot,
      };
    }

    return {
      result: PromotionOutcome.RETAINED,
      toLevelGradeId: student.fromLevelGradeId,
      ruleResults: results,
      criteriaSnapshot,
      evaluationSnapshot,
    };
  }
}
