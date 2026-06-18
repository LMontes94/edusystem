import { AverageScoreRule } from './average-score.rule';
import { StudentEvaluationData, PromotionCriteria } from '../../promotion.types';

const baseStudent = (overrides: Partial<StudentEvaluationData>): StudentEvaluationData => ({
  studentId: 's1',
  courseStudentId: 'cs1',
  fromLevelGradeId: null,
  averageScore: 0,
  totalGrades: 0,
  pendingSubjects: { total: 0, completed: 0, notCompleted: 0 },
  failedCoreSubjectIds: [],
  attendancePercentage: 100,
  closingGradesEvaluated: 0,
  closingGradesPassed: 0,
  closingGradesFailed: 0,
  ...overrides,
});

const criteria: PromotionCriteria = {
  engineVersion: '1.0',
  minAverageScore: 7.0,
  maxPendingSubjects: 2,
  coreSubjects: [],
  attendanceMinimum: 80,
  closingGradeMinimum: 6,
};

describe('AverageScoreRule', () => {
  const rule = new AverageScoreRule();

  it('returns pass when score is above minimum', () => {
    const student = baseStudent({ averageScore: 8.5, totalGrades: 5 });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.metadata).toEqual({
      averageScore: 8.5,
      minAverageScore: 7,
    });
  });

  it('returns pass when score equals minimum', () => {
    const student = baseStudent({ averageScore: 7.0, totalGrades: 3 });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(true);
  });

  it('returns fail when score is below minimum', () => {
    const student = baseStudent({ averageScore: 5.0, totalGrades: 4 });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('por debajo del mínimo');
    expect(result.metadata).toEqual({
      averageScore: 5,
      minAverageScore: 7,
    });
  });
});
