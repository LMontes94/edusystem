import { PromotionEngine } from './promotion-engine';
import { PromotionOutcome } from '@prisma/client';
import { StudentEvaluationData, PromotionCriteria } from '../promotion.types';

const passingStudent: StudentEvaluationData = {
  studentId: 's1',
  courseStudentId: 'cs1',
  fromLevelGradeId: 'lg-1',
  averageScore: 8.5,
  totalGrades: 5,
  pendingSubjects: { total: 3, completed: 3, notCompleted: 0 },
  failedCoreSubjectIds: [],
  attendancePercentage: 95,
  closingGradesEvaluated: 5,
  closingGradesPassed: 5,
  closingGradesFailed: 0,
};

const criteria: PromotionCriteria = {
  engineVersion: '1.0',
  minAverageScore: 7,
  maxPendingSubjects: 2,
  coreSubjects: [],
  attendanceMinimum: 80,
  closingGradeMinimum: 6,
};

describe('PromotionEngine', () => {
  const engine = new PromotionEngine();

  it('returns PROMOTED when all rules pass and not graduating level', () => {
    const result = engine.evaluate(passingStudent, criteria, false, 'lg-2');
    expect(result.result).toBe(PromotionOutcome.PROMOTED);
    expect(result.toLevelGradeId).toBe('lg-2');
  });

  it('returns GRADUATED when all rules pass and is graduating level', () => {
    const result = engine.evaluate(passingStudent, criteria, true, null);
    expect(result.result).toBe(PromotionOutcome.GRADUATED);
    expect(result.toLevelGradeId).toBeNull();
  });

  it('returns RETAINED when one rule fails', () => {
    const lowAttendance = { ...passingStudent, attendancePercentage: 30 };
    const result = engine.evaluate(lowAttendance, criteria, false, 'lg-2');
    expect(result.result).toBe(PromotionOutcome.RETAINED);
    expect(result.toLevelGradeId).toBe('lg-1');
  });

  it('returns RETAINED when multiple rules fail', () => {
    const lowScore = { ...passingStudent, averageScore: 4, attendancePercentage: 30 };
    const result = engine.evaluate(lowScore, criteria, false, 'lg-2');
    expect(result.result).toBe(PromotionOutcome.RETAINED);
  });

  it('includes all rule results in the output', () => {
    const result = engine.evaluate(passingStudent, criteria, false, 'lg-2');
    expect(result.ruleResults).toHaveLength(4);
    expect(result.ruleResults.map((r) => r.rule)).toEqual([
      'averageScore',
      'pendingSubjects',
      'coreSubjects',
      'attendance',
    ]);
    expect(result.criteriaSnapshot).toBeDefined();
    expect(result.evaluationSnapshot).toBeDefined();
  });
});
