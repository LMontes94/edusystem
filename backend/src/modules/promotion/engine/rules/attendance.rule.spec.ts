import { AttendanceRule } from './attendance.rule';
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

describe('AttendanceRule', () => {
  const rule = new AttendanceRule();

  it('returns pass when attendance is above minimum', () => {
    const student = baseStudent({ attendancePercentage: 95 });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns pass when attendance equals minimum', () => {
    const student = baseStudent({ attendancePercentage: 80 });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(true);
  });

  it('returns fail when attendance is below minimum', () => {
    const student = baseStudent({ attendancePercentage: 60 });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('por debajo del mínimo');
    expect(result.metadata).toEqual({
      attendancePercentage: 60,
      attendanceMinimum: 80,
    });
  });
});
