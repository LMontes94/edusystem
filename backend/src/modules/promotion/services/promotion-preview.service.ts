import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PromotionEngine } from '../engine/promotion-engine';
import { StudentEvaluationData, PromotionCriteria } from '../promotion.types';
import { PreviewResponse, StudentProjection } from '../dto/preview-response.dto';

@Injectable()
export class PromotionPreviewService {
  private readonly logger = new Logger(PromotionPreviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionEngine: PromotionEngine,
  ) {}

  async preview(
    schoolYearId: string,
    institutionId: string,
    userId: string,
  ): Promise<PreviewResponse> {
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: schoolYearId, institutionId },
    });

    if (!schoolYear) {
      throw new BadRequestException('SCHOOL_YEAR_NOT_FOUND');
    }

    if (schoolYear.status !== 'CLOSED') {
      throw new BadRequestException('SCHOOL_YEAR_NOT_CLOSED');
    }

    if (schoolYear.promotionStatus === 'EXECUTING') {
      throw new BadRequestException('PROMOTION_ALREADY_EXECUTING');
    }

    if (schoolYear.promotionStatus === 'COMPLETED') {
      return this.buildCachedPreview(schoolYear, schoolYearId);
    }

    const courseStudents = await this.prisma.courseStudent.findMany({
      where: {
        course: { schoolYearId, institutionId },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true },
        },
        course: {
          select: {
            levelGradeId: true,
            levelGrade: {
              select: { id: true, isGraduating: true, nextLevelGradeId: true },
            },
          },
        },
      },
    });

    const criteria = this.buildCriteria();
    const projections = { promoted: 0, retained: 0, graduated: 0 };
    const students: StudentProjection[] = [];

    for (const cs of courseStudents) {
      const studentData = await this.buildStudentEvaluationData(
        cs.studentId, schoolYearId, institutionId, cs.id,
      );
      studentData.fromLevelGradeId = cs.course.levelGrade?.id ?? null;

      const isGraduating = cs.course.levelGrade?.isGraduating ?? false;
      const nextLevelGradeId = cs.course.levelGrade?.nextLevelGradeId ?? null;

      const engineResult = this.promotionEngine.evaluate(
        studentData, criteria, isGraduating, nextLevelGradeId,
      );

      const resultStr = engineResult.result;
      if (resultStr === 'PROMOTED') projections.promoted++;
      else if (resultStr === 'RETAINED') projections.retained++;
      else if (resultStr === 'GRADUATED') projections.graduated++;

      students.push({
        studentId: cs.student.id,
        studentFullName: `${cs.student.firstName} ${cs.student.lastName}`,
        result: resultStr,
        toLevelGradeId: engineResult.toLevelGradeId,
        toSchoolYearId: null,
        ruleResults: engineResult.ruleResults.map((rr) => ({
          rule: rr.rule,
          passed: rr.passed,
          reason: rr.reason,
        })),
      });
    }

    if (!schoolYear.promotionStatus) {
      await this.prisma.schoolYear.update({
        where: { id: schoolYearId },
        data: {
          promotionStatus: 'PREVIEWED',
          promotionSummary: {
            totalStudents: courseStudents.length,
            promoted: projections.promoted,
            retained: projections.retained,
            graduated: projections.graduated,
            overrides: 0,
            executedAt: null,
            executedById: null,
          } as unknown as Prisma.InputJsonValue,
          promotionSummaryStale: false,
        },
      });
    }

    return {
      schoolYearId,
      evaluatedAt: new Date().toISOString(),
      totalStudents: courseStudents.length,
      projections,
      students,
    };
  }

  private async buildStudentEvaluationData(
    studentId: string,
    schoolYearId: string,
    institutionId: string,
    courseStudentId: string,
  ): Promise<StudentEvaluationData> {
    const grades = await this.prisma.grade.findMany({
      where: {
        studentId,
        courseSubject: {
          course: { schoolYearId },
        },
      },
      select: { score: true },
    });

    const totalGrades = grades.length;
    const averageScore = totalGrades > 0
      ? grades.reduce((sum, g) => sum + Number(g.score), 0) / totalGrades
      : 0;

    const pendingSubjects = await this.prisma.pendingSubject.findMany({
      where: { studentId, schoolYearId },
      select: { status: true },
    });

    const completedPS = pendingSubjects.filter(
      (ps) => ps.status === 'COMPLETED',
    ).length;

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        studentId,
        course: { schoolYearId },
      },
      select: { status: true },
    });

    const totalAttendance = attendanceRecords.length;
    const attendancePercentage = totalAttendance > 0
      ? (attendanceRecords.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length / totalAttendance) * 100
      : 100;

    const closingGrades = await this.prisma.closingGrade.findMany({
      where: {
        studentId,
        courseSubject: {
          course: { schoolYearId },
        },
      },
      select: { closingScore: true },
    });

    const closingGradesEvaluated = closingGrades.length;
    const closingGradesPassed = closingGrades.filter(
      (cg) => (cg.closingScore ? Number(cg.closingScore) : 0) >= 6,
    ).length;

    return {
      studentId,
      courseStudentId,
      fromLevelGradeId: null,
      averageScore,
      totalGrades,
      pendingSubjects: {
        total: pendingSubjects.length,
        completed: completedPS,
        notCompleted: pendingSubjects.length - completedPS,
      },
      failedCoreSubjectIds: [],
      attendancePercentage,
      closingGradesEvaluated,
      closingGradesPassed,
      closingGradesFailed: closingGradesEvaluated - closingGradesPassed,
    };
  }

  private buildCriteria(): PromotionCriteria {
    return {
      engineVersion: '1.0',
      minAverageScore: 7.0,
      maxPendingSubjects: 2,
      coreSubjects: [],
      attendanceMinimum: 80.0,
      closingGradeMinimum: 6.0,
    };
  }

  private buildCachedPreview(schoolYear: any, schoolYearId: string): PreviewResponse {
    const summary = (schoolYear.promotionSummary as Record<string, unknown>) ?? {};
    return {
      schoolYearId,
      evaluatedAt: (summary['executedAt'] as string) ?? new Date().toISOString(),
      totalStudents: (summary['totalStudents'] as number) ?? 0,
      projections: {
        promoted: (summary['promoted'] as number) ?? 0,
        retained: (summary['retained'] as number) ?? 0,
        graduated: (summary['graduated'] as number) ?? 0,
      },
      students: [],
    };
  }
}
