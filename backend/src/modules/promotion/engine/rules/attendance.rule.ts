import { BaseRule } from './base-rule';
import { StudentEvaluationData, PromotionCriteria, RuleResult } from '../../promotion.types';

export class AttendanceRule extends BaseRule {
  get name(): string {
    return 'attendance';
  }

  evaluate(student: StudentEvaluationData, criteria: PromotionCriteria): Omit<RuleResult, 'rule'> {
    const passed = student.attendancePercentage >= criteria.attendanceMinimum;
    return {
      passed,
      reason: passed ? undefined : `Asistencia ${student.attendancePercentage.toFixed(1)}% por debajo del mínimo ${criteria.attendanceMinimum}%`,
      metadata: {
        attendancePercentage: student.attendancePercentage,
        attendanceMinimum: criteria.attendanceMinimum,
      },
    };
  }
}
