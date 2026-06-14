import { BaseRule } from './base-rule';
import { StudentEvaluationData, PromotionCriteria, RuleResult } from '../../promotion.types';

export class CoreSubjectsRule extends BaseRule {
  get name(): string {
    return 'coreSubjects';
  }

  evaluate(student: StudentEvaluationData, criteria: PromotionCriteria): Omit<RuleResult, 'rule'> {
    if (criteria.coreSubjects.length === 0) {
      return { passed: true, metadata: { coreSubjects: [], failedCoreSubjects: [] } };
    }

    const passed = student.failedCoreSubjectIds.length === 0;
    return {
      passed,
      reason: passed ? undefined : `Materias curriculares desaprobadas: ${student.failedCoreSubjectIds.join(', ')}`,
      metadata: {
        coreSubjects: criteria.coreSubjects,
        failedCoreSubjectIds: student.failedCoreSubjectIds,
      },
    };
  }
}
