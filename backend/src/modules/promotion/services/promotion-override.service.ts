import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EffectiveResultViewService } from '../utils/effective-result.view';
import { QUEUES, JOBS, JOB_OPTIONS } from '../../../queues/queue.constants';
import { CreateOverrideDto } from '../dto/create-override.dto';
import { OverrideResponse } from '../dto/preview-response.dto';

@Injectable()
export class PromotionOverrideService {
  private readonly logger = new Logger(PromotionOverrideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly effectiveResultView: EffectiveResultViewService,
    @InjectQueue(QUEUES.AUDIT) private readonly auditQueue: Queue,
  ) {}

  async createOverride(
    dto: CreateOverrideDto,
    institutionId: string,
    userId: string,
  ): Promise<OverrideResponse> {
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: dto.fromSchoolYearId, institutionId },
    });

    if (!schoolYear) {
      throw new BadRequestException('SCHOOL_YEAR_NOT_FOUND');
    }

    if (schoolYear.promotionStatus === 'EXECUTING') {
      throw new BadRequestException('OVERRIDE_FORBIDDEN_DURING_EXECUTION');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, institutionId },
    });

    if (!student) {
      throw new BadRequestException('STUDENT_NOT_FOUND');
    }

    if (dto.result === 'GRADUATED') {
      const effective = await this.effectiveResultView.getEffectiveResultWithTenant(
        dto.studentId, dto.fromSchoolYearId, institutionId,
      );
      if (effective && effective.result === 'GRADUATED') {
        throw new BadRequestException('STUDENT_ALREADY_GRADUATED');
      }
    }

    let fromCourseStudentId: string;
    let fromLevelGradeId: string | null = null;

    const priorResult = await this.prisma.promotionResult.findFirst({
      where: {
        studentId: dto.studentId,
        fromSchoolYearId: dto.fromSchoolYearId,
        institutionId,
        isOverride: false,
      },
      orderBy: [
        { decidedAt: 'desc' },
        { id: 'desc' },
      ],
    });

    if (priorResult) {
      fromCourseStudentId = priorResult.fromCourseStudentId;
      fromLevelGradeId = priorResult.fromLevelGradeId;
    } else {
      const activeCourseStudent = await this.prisma.courseStudent.findFirst({
        where: {
          studentId: dto.studentId,
          course: { schoolYearId: dto.fromSchoolYearId },
        },
        include: {
          course: { select: { levelGradeId: true } },
        },
      });

      if (!activeCourseStudent) {
        throw new BadRequestException('STUDENT_NOT_ENROLLED_IN_YEAR');
      }

      fromCourseStudentId = activeCourseStudent.id;
      fromLevelGradeId = activeCourseStudent.course.levelGradeId;
    }

    const criteria: Prisma.InputJsonValue = priorResult
      ? (priorResult.criteria as Prisma.InputJsonValue)
      : (this.buildDefaultCriteria() as unknown as Prisma.InputJsonValue);

    const toSchoolYearId = dto.toSchoolYearId
      ? dto.toSchoolYearId
      : await this.resolveToSchoolYearId(dto.fromSchoolYearId, institutionId);

    const result = await this.prisma.$transaction(async (tx) => {
      const overrideResult = await tx.promotionResult.create({
        data: {
          institutionId,
          studentId: dto.studentId,
          fromSchoolYearId: dto.fromSchoolYearId,
          toSchoolYearId,
          fromCourseStudentId,
          toCourseStudentId: null,
          fromLevelGradeId,
          toLevelGradeId: fromLevelGradeId,
          result: dto.result,
          criteria,
          evaluationSnapshot: {} as Prisma.InputJsonValue,
          reason: dto.reason,
          isOverride: true,
          decidedById: userId,
        },
      });

      await tx.schoolYear.update({
        where: { id: dto.fromSchoolYearId },
        data: { promotionSummaryStale: true },
      });

      return overrideResult;
    });

    const before = priorResult
      ? { id: priorResult.id, studentId: priorResult.studentId, result: priorResult.result }
      : null;

    await this.auditQueue.add(JOBS.AUDIT_LOG, {
      institutionId, userId,
      action: 'CREATE',
      resource: 'PromotionResult',
      resourceId: result.id,
      before,
      after: {
        id: result.id,
        studentId: dto.studentId,
        result: dto.result,
        reason: dto.reason,
        isOverride: true,
      },
    }, JOB_OPTIONS.CRITICAL);

    return {
      id: result.id,
      result: dto.result,
      isOverride: true,
      reason: dto.reason,
      decidedAt: result.decidedAt.toISOString(),
    };
  }

  private async resolveToSchoolYearId(
    fromSchoolYearId: string,
    institutionId: string,
  ): Promise<string | null> {
    const currentYear = await this.prisma.schoolYear.findUnique({
      where: { id: fromSchoolYearId },
      select: { year: true },
    });
    if (!currentYear) return null;

    const nextYear = await this.prisma.schoolYear.findFirst({
      where: { institutionId, year: currentYear.year + 1 },
      select: { id: true },
    });

    return nextYear?.id ?? null;
  }

  private buildDefaultCriteria(): Record<string, unknown> {
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
