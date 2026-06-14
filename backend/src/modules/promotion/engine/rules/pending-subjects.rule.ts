import { BaseRule } from './base-rule';
import { StudentEvaluationData, PromotionCriteria, RuleResult } from '../../promotion.types';

export class PendingSubjectsRule extends BaseRule {
  get name(): string {
    return 'pendingSubjects';
  }

  evaluate(student: StudentEvaluationData, criteria: PromotionCriteria): Omit<RuleResult, 'rule'> {
    const pending = student.pendingSubjects.notCompleted;
    const passed = pending <= criteria.maxPendingSubjects;
    return {
      passed,
      reason: passed ? undefined : `${pending} materias previas pendientes (máx. ${criteria.maxPendingSubjects})`,
      metadata: {
        total: student.pendingSubjects.total,
        completed: student.pendingSubjects.completed,
        notCompleted: student.pendingSubjects.notCompleted,
        maxPendingSubjects: criteria.maxPendingSubjects,
      },
    };
  }
}
