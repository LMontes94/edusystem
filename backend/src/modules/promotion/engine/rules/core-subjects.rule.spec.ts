import { CoreSubjectsRule } from './core-subjects.rule';
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

const criteriaWithCore = (core: string[]): PromotionCriteria => ({
  engineVersion: '1.0',
  minAverageScore: 7,
  maxPendingSubjects: 2,
  coreSubjects: core,
  attendanceMinimum: 80,
  closingGradeMinimum: 6,
});

describe('CoreSubjectsRule', () => {
  const rule = new CoreSubjectsRule();

  it('returns pass when no core subjects are configured', () => {
    const criteria = criteriaWithCore([]);
    const student = baseStudent({ failedCoreSubjectIds: ['s1', 's2'] });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(true);
  });

  it('returns pass when no core subjects failed', () => {
    const criteria = criteriaWithCore(['math', 'lang']);
    const student = baseStudent({ failedCoreSubjectIds: [] });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns fail when one core subject failed', () => {
    const criteria = criteriaWithCore(['math', 'lang']);
    const student = baseStudent({ failedCoreSubjectIds: ['math'] });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Materias curriculares desaprobadas');
  });

  it('returns fail when multiple core subjects failed', () => {
    const criteria = criteriaWithCore(['math', 'lang', 'science']);
    const student = baseStudent({ failedCoreSubjectIds: ['math', 'science'] });
    const result = rule.evaluate(student, criteria);
    expect(result.passed).toBe(false);
  });
});
