import { PendingSubjectsRule } from './pending-subjects.rule';
import { StudentEvaluationData, PromotionCriteria } from '../../promotion.types';

const baseStudent = (overrides: Partial<StudentEvaluationData>): StudentEvaluationData => ({
  studentId: 's1',
  courseStudentId: 'cs1',
  fromLevelGradeId: null,
  averageScore: 8,
  totalGrades: 5,
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
  minAverageScore: 7,
  maxPendingSubjects: 2,
  coreSubjects: [],
  attendanceMinimum: 80,
  closingGradeMinimum: 6,
};

describe('PendingSubjectsRule', () => {
  const rule = new PendingSubjectsRule();

  it('returns pass when zero pending subjects', () => {
    const student = baseStudent({
      pendingSubjects: { total: 5, completed: 5, notCompleted: 0 },
    });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns pass when pending equals max allowed', () => {
    const student = baseStudent({
      pendingSubjects: { total: 5, completed: 3, notCompleted: 2 },
    });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(true);
  });

  it('returns fail when pending exceeds max allowed', () => {
    const student = baseStudent({
      pendingSubjects: { total: 5, completed: 2, notCompleted: 3 },
    });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('materias previas pendientes');
  });
});
