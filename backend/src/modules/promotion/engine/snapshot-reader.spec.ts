import { BadRequestException } from '@nestjs/common';
import { SnapshotReader } from './snapshot-reader';

const v1Snapshot: Record<string, unknown> = {
  engineVersion: '1.0',
  averageScore: 7.5,
  totalGrades: 4,
  pendingSubjects: {
    total: 3,
    completed: 2,
    notCompleted: 1,
  },
  failedCoreSubjects: ['math'],
  attendancePercentage: 88.5,
};

describe('SnapshotReader', () => {
  it('reads a version 1.0 snapshot', () => {
    const reader = SnapshotReader.forVersion('1.0');
    expect(reader.getVersion()).toBe('1.0');
    expect(reader.getAverageScore(v1Snapshot)).toBe(7.5);
    expect(reader.getTotalGrades(v1Snapshot)).toBe(4);
    expect(reader.getPendingSubjects(v1Snapshot)).toEqual({
      total: 3,
      completed: 2,
      notCompleted: 1,
    });
    expect(reader.getFailedCoreSubjects(v1Snapshot)).toEqual(['math']);
    expect(reader.getAttendancePercentage(v1Snapshot)).toBe(88.5);
  });

  it('throws for unknown version', () => {
    expect(() => SnapshotReader.forVersion('2.0')).toThrow(BadRequestException);
    expect(() => SnapshotReader.forVersion('2.0')).toThrow('no soportada');
  });

  it('returns defaults for missing fields', () => {
    const reader = SnapshotReader.forVersion('1.0');
    const empty: Record<string, unknown> = {};
    expect(reader.getAverageScore(empty)).toBe(0);
    expect(reader.getTotalGrades(empty)).toBe(0);
    expect(reader.getPendingSubjects(empty)).toEqual({
      total: 0, completed: 0, notCompleted: 0,
    });
    expect(reader.getFailedCoreSubjects(empty)).toEqual([]);
    expect(reader.getAttendancePercentage(empty)).toBe(0);
  });
});
