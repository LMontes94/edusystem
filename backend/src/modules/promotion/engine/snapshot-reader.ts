import { BadRequestException } from '@nestjs/common';

const SUPPORTED_VERSIONS = ['1.0'];

export class SnapshotReader {
  private constructor(private readonly version: string) {}

  static forVersion(version: string): SnapshotReader {
    if (!SUPPORTED_VERSIONS.includes(version)) {
      throw new BadRequestException(`Versión de snapshot no soportada: ${version}`);
    }
    return new SnapshotReader(version);
  }

  getVersion(): string {
    return this.version;
  }

  getAverageScore(snapshot: Record<string, unknown>): number {
    return (snapshot['averageScore'] as number) ?? 0;
  }

  getTotalGrades(snapshot: Record<string, unknown>): number {
    return (snapshot['totalGrades'] as number) ?? 0;
  }

  getPendingSubjects(snapshot: Record<string, unknown>): { total: number; completed: number; notCompleted: number } {
    const ps = snapshot['pendingSubjects'] as Record<string, unknown> | undefined;
    return {
      total: (ps?.['total'] as number) ?? 0,
      completed: (ps?.['completed'] as number) ?? 0,
      notCompleted: (ps?.['notCompleted'] as number) ?? 0,
    };
  }

  getFailedCoreSubjects(snapshot: Record<string, unknown>): string[] {
    return (snapshot['failedCoreSubjects'] as string[]) ?? [];
  }

  getAttendancePercentage(snapshot: Record<string, unknown>): number {
    return (snapshot['attendancePercentage'] as number) ?? 0;
  }
}
