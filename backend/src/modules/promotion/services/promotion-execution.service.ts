import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PromotionEngine } from '../engine/promotion-engine';
import { DestinationResolver } from '../utils/destination-resolver';
import { QUEUES, JOBS, JOB_OPTIONS } from '../../../queues/queue.constants';
import { StudentEvaluationData, PromotionCriteria, StudentEvaluation } from '../promotion.types';
import { ExecuteResponse } from '../dto/preview-response.dto';

@Injectable()
export class PromotionExecutionService {
  private readonly logger = new Logger(PromotionExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionEngine: PromotionEngine,
    private readonly destinationResolver: DestinationResolver,
    @InjectQueue(QUEUES.AUDIT) private readonly auditQueue: Queue,
  ) {}

  async execute(
    schoolYearId: string,
    institutionId: string,
    userId: string,
  ): Promise<ExecuteResponse> {
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: schoolYearId, institutionId },
    });

    if (!schoolYear) {
      throw new BadRequestException('SCHOOL_YEAR_NOT_FOUND');
    }

    if (schoolYear.status !== 'CLOSED') {
      throw new BadRequestException('SCHOOL_YEAR_NOT_CLOSED');
    }

    if (schoolYear.promotionStatus !== 'PREVIEWED') {
      throw new BadRequestException('PROMOTION_NOT_PREVIEWED');
    }

    await this.handleStaleHeartbeat(institutionId);

    const lockResult = await this.prisma.schoolYear.updateMany({
      where: {
        id: schoolYearId,
        promotionStatus: 'PREVIEWED',
      },
      data: {
        promotionStatus: 'EXECUTING',
        promotionLockedAt: new Date(),
        promotionHeartbeatAt: new Date(),
      },
    });

    if (lockResult.count === 0) {
      throw new ConflictException('CONCURRENT_EXECUTION');
    }

    await this.auditQueue.add(JOBS.AUDIT_LOG, {
      institutionId, userId,
      action: 'UPDATE',
      resource: 'SchoolYear',
      resourceId: schoolYearId,
      before: { promotionStatus: 'PREVIEWED' },
      after: { promotionStatus: 'EXECUTING' },
    }, JOB_OPTIONS.CRITICAL);

    try {
      const courseStudents = await this.prisma.courseStudent.findMany({
        where: {
          course: { schoolYearId, institutionId },
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          course: {
            select: {
              levelGradeId: true,
              levelGrade: { select: { id: true, isGraduating: true, nextLevelGradeId: true } },
            },
          },
        },
      });

      const criteria = this.buildCriteria();

      const evaluations: StudentEvaluation[] = [];
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

        const dest = await this.destinationResolver.resolveDestination(
          engineResult.result,
          studentData.fromLevelGradeId,
          schoolYearId,
          institutionId,
        );

        evaluations.push({
          studentId: cs.student.id,
          fromSchoolYearId: schoolYearId,
          fromCourseStudentId: cs.id,
          fromLevelGradeId: studentData.fromLevelGradeId,
          toSchoolYearId: dest.toSchoolYearId,
          engineResult,
          student: cs.student,
        });
      }

      const destinationMap = await this.destinationResolver.preResolveDestinations(
        evaluations.map((e) => ({
          fromLevelGradeId: e.fromLevelGradeId,
          result: e.engineResult.result,
        })),
        schoolYearId,
        institutionId,
      );

      const summary = {
        totalStudents: evaluations.length,
        promoted: 0,
        retained: 0,
        graduated: 0,
        errors: 0,
        skipped: 0,
      };

      for (let i = 0; i < evaluations.length; i++) {
        const evalResult = evaluations[i];
        try {
          const processed = await this.processStudentTransaction(
            evalResult, destinationMap, institutionId, userId,
          );
          if (processed === 'skipped') {
            summary.skipped++;
          } else if (processed === 'created') {
            if (evalResult.engineResult.result === 'PROMOTED') summary.promoted++;
            else if (evalResult.engineResult.result === 'RETAINED') summary.retained++;
            else if (evalResult.engineResult.result === 'GRADUATED') summary.graduated++;
          }
        } catch (err) {
          this.logger.error(`Error processing student ${evalResult.studentId}`, err);
          summary.errors++;
        }

        if ((i + 1) % 100 === 0) {
          await this.prisma.schoolYear.update({
            where: { id: schoolYearId },
            data: { promotionHeartbeatAt: new Date() },
          });
        }
      }

      const summaryJson = {
        totalStudents: summary.totalStudents,
        promoted: summary.promoted,
        retained: summary.retained,
        graduated: summary.graduated,
        overrides: 0,
        executedAt: new Date().toISOString(),
        executedById: userId,
      };

      await this.prisma.schoolYear.update({
        where: { id: schoolYearId },
        data: {
          promotionStatus: 'COMPLETED',
          promotionLockedAt: new Date(),
          promotionSummary: summaryJson as unknown as Prisma.InputJsonValue,
          promotionSummaryStale: false,
        },
      });

      await this.auditQueue.add(JOBS.AUDIT_LOG, {
        institutionId, userId,
        action: 'UPDATE',
        resource: 'SchoolYear',
        resourceId: schoolYearId,
        before: { promotionStatus: 'EXECUTING' },
        after: { promotionStatus: 'COMPLETED', summary: summaryJson },
      }, JOB_OPTIONS.CRITICAL);

      return {
        schoolYearId,
        executedAt: new Date().toISOString(),
        summary,
      };
    } catch (err) {
      this.logger.error('Execution failed, re-setting EXECUTING', err);
      await this.prisma.schoolYear.update({
        where: { id: schoolYearId },
        data: { promotionStatus: 'PREVIEWED', promotionLockedAt: null },
      }).catch(() => {});
      throw err;
    }
  }

  private async processStudentTransaction(
    evaluation: StudentEvaluation,
    destinationMap: Map<string, string>,
    institutionId: string,
    userId: string,
  ): Promise<'created' | 'skipped'> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await (tx as any).promotionResult.findFirst({
        where: {
          studentId: evaluation.studentId,
          fromSchoolYearId: evaluation.fromSchoolYearId,
        },
      });
      if (existing) return 'skipped' as const;

      let toCourseStudentId: string | null = null;

      if (
        evaluation.engineResult.result === 'PROMOTED' ||
        evaluation.engineResult.result === 'RETAINED'
      ) {
        if (evaluation.toSchoolYearId && evaluation.engineResult.toLevelGradeId) {
          const destKey = `${evaluation.toSchoolYearId}:${evaluation.engineResult.toLevelGradeId}`;
          const courseId = destinationMap.get(destKey);

          if (courseId) {
            const courseStudent = await (tx as any).courseStudent.create({
              data: {
                courseId,
                studentId: evaluation.studentId,
              },
            });
            toCourseStudentId = courseStudent.id;

            await this.copyStudentSubjectAssignments(
              tx,
              evaluation.studentId,
              evaluation.fromSchoolYearId,
              evaluation.toSchoolYearId,
              courseId,
              userId,
            );
          }
        }
      }

      const result = await (tx as any).promotionResult.create({
        data: {
          institutionId,
          studentId: evaluation.studentId,
          fromSchoolYearId: evaluation.fromSchoolYearId,
          toSchoolYearId: evaluation.toSchoolYearId,
          fromCourseStudentId: evaluation.fromCourseStudentId,
          toCourseStudentId,
          fromLevelGradeId: evaluation.fromLevelGradeId,
          toLevelGradeId: evaluation.engineResult.toLevelGradeId,
          result: evaluation.engineResult.result,
          criteria: evaluation.engineResult.criteriaSnapshot as unknown as Prisma.InputJsonValue,
          evaluationSnapshot: evaluation.engineResult.evaluationSnapshot as unknown as Prisma.InputJsonValue,
          isOverride: false,
          decidedById: userId,
        },
      });

      await this.auditQueue.add(JOBS.AUDIT_LOG, {
        institutionId, userId,
        action: 'CREATE',
        resource: 'PromotionResult',
        resourceId: result.id,
        after: {
          id: result.id,
          studentId: evaluation.studentId,
          result: result.result,
          isOverride: false,
        },
      }, JOB_OPTIONS.CRITICAL);

      return 'created' as const;
    });
  }

  private async copyStudentSubjectAssignments(
    tx: any,
    studentId: string,
    fromSchoolYearId: string,
    toSchoolYearId: string,
    destCourseId: string,
    userId: string,
  ): Promise<void> {
    const sourceAssignments = await tx.studentCourseSubject.findMany({
      where: { studentId, schoolYearId: fromSchoolYearId },
      include: {
        courseSubject: { select: { subjectId: true } },
      },
    });

    if (sourceAssignments.length === 0) return;

    const sourceSubjectIds = sourceAssignments.map((sa: any) => sa.courseSubject.subjectId);

    const destCourseSubjects = await tx.courseSubject.findMany({
      where: {
        courseId: destCourseId,
        subjectId: { in: sourceSubjectIds },
      },
      select: { id: true, subjectId: true },
    });

    const existingDestAssignments = await tx.studentCourseSubject.findMany({
      where: {
        studentId,
        schoolYearId: toSchoolYearId,
      },
      select: { courseSubjectId: true },
    });
    const existingDestIds = new Set(existingDestAssignments.map((a: any) => a.courseSubjectId));

    for (const dcs of destCourseSubjects) {
      if (!existingDestIds.has(dcs.id)) {
        await tx.studentCourseSubject.create({
          data: {
            studentId,
            courseSubjectId: dcs.id,
            schoolYearId: toSchoolYearId,
            createdById: userId,
          },
        });
      }
    }
  }

  private async handleStaleHeartbeat(institutionId: string): Promise<void> {
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
    const staleExecution = await this.prisma.schoolYear.findFirst({
      where: {
        institutionId,
        promotionStatus: 'EXECUTING',
        promotionHeartbeatAt: { lt: staleThreshold },
      },
    });

    if (staleExecution) {
      this.logger.warn(`Stale execution detected for schoolYear ${staleExecution.id}, resetting to PREVIEWED`);
      await this.prisma.schoolYear.update({
        where: { id: staleExecution.id },
        data: { promotionStatus: 'PREVIEWED', promotionLockedAt: null },
      });
    }
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
        courseSubject: { course: { schoolYearId } },
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
      where: { studentId, course: { schoolYearId } },
      select: { status: true },
    });

    const totalAttendance = attendanceRecords.length;
    const attendancePercentage = totalAttendance > 0
      ? (attendanceRecords.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length / totalAttendance) * 100
      : 100;

    const closingGrades = await this.prisma.closingGrade.findMany({
      where: {
        studentId,
        courseSubject: { course: { schoolYearId } },
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
}
