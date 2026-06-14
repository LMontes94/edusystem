import { BaseRule } from './base-rule';
import { StudentEvaluationData, PromotionCriteria, RuleResult } from '../../promotion.types';

export class AverageScoreRule extends BaseRule {
  get name(): string {
    return 'averageScore';
  }

  evaluate(student: StudentEvaluationData, criteria: PromotionCriteria): Omit<RuleResult, 'rule'> {
    if (student.totalGrades === 0) {
      return { passed: false, reason: 'Sin calificaciones registradas', metadata: { averageScore: 0 } };
    }

    const passed = student.averageScore >= criteria.minAverageScore;
    return {
      passed,
      reason: passed ? undefined : `Promedio ${student.averageScore.toFixed(2)} por debajo del mínimo ${criteria.minAverageScore}`,
      metadata: { averageScore: student.averageScore, minAverageScore: criteria.minAverageScore },
    };
  }
}
