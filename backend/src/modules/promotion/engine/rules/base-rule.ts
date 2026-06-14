import { StudentEvaluationData, PromotionCriteria, RuleResult } from '../../promotion.types';

export abstract class BaseRule {
  abstract get name(): string;
  abstract evaluate(student: StudentEvaluationData, criteria: PromotionCriteria): Omit<RuleResult, 'rule'>;
}

export type { RuleResult };
