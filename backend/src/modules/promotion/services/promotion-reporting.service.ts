import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { RequestUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { EffectiveResultViewService } from '../utils/effective-result.view';
import { ResultQueryDto } from '../dto/query-results.dto';
import { PromotionStatistics, StudentPromotionHistory } from '../dto/preview-response.dto';

@Injectable()
export class PromotionReportingService {
  private readonly logger = new Logger(PromotionReportingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly effectiveResultView: EffectiveResultViewService,
  ) {}

  async getResults(
    filters: ResultQueryDto,
    institutionId: string,
  ): Promise<any[]> {
    const where = filters.includeHistory
      ? this.buildRawWhere(filters, institutionId)
      : this.buildEffectiveWhere(filters, institutionId);

    if (filters.includeHistory) {
      return this.prisma.promotionResult.findMany({
        where,
        orderBy: { decidedAt: 'desc' },
        take: filters.limit,
        skip: (filters.page - 1) * filters.limit,
      });
    }

    return this.effectiveResultView.getEffectiveResults(
      filters.schoolYearId,
      institutionId,
    );
  }

  async getStatistics(
    schoolYearId: string,
    institutionId: string,
  ): Promise<PromotionStatistics> {
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: schoolYearId, institutionId },
      select: {
        promotionSummary: true,
        promotionSummaryStale: true,
      },
    });

    if (!schoolYear) {
      throw new BadRequestException('SCHOOL_YEAR_NOT_FOUND');
    }

    if (schoolYear.promotionSummary) {
      const summary = schoolYear.promotionSummary as Record<string, unknown>;
      const total = (summary['totalStudents'] as number) ?? 0;
      const promoted = (summary['promoted'] as number) ?? 0;
      const retained = (summary['retained'] as number) ?? 0;
      const graduated = (summary['graduated'] as number) ?? 0;
      const overrides = (summary['overrides'] as number) ?? 0;

      return {
        schoolYearId,
        totalStudents: total,
        promoted: { count: promoted, percentage: total > 0 ? Math.round((promoted / total) * 100 * 100) / 100 : 0 },
        retained: { count: retained, percentage: total > 0 ? Math.round((retained / total) * 100 * 100) / 100 : 0 },
        graduated: { count: graduated, percentage: total > 0 ? Math.round((graduated / total) * 100 * 100) / 100 : 0 },
        overrides: { count: overrides },
        summaryStale: schoolYear.promotionSummaryStale,
      };
    }

    const results = await this.effectiveResultView.getEffectiveResults(schoolYearId, institutionId);
    const rows = results as any[];

    const total = rows.length;
    const promoted = rows.filter((r) => r.result === 'PROMOTED').length;
    const retained = rows.filter((r) => r.result === 'RETAINED').length;
    const graduated = rows.filter((r) => r.result === 'GRADUATED').length;
    const overrides = rows.filter((r) => r.isOverride).length;

    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100 * 100) / 100 : 0;

    return {
      schoolYearId,
      totalStudents: total,
      promoted: { count: promoted, percentage: pct(promoted) },
      retained: { count: retained, percentage: pct(retained) },
      graduated: { count: graduated, percentage: pct(graduated) },
      overrides: { count: overrides },
      summaryStale: false,
    };
  }

  async getStudentHistory(
    studentId: string,
    institutionId: string,
    user: RequestUser,
  ): Promise<StudentPromotionHistory> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!student) {
      throw new BadRequestException('STUDENT_NOT_FOUND');
    }

    if (user.role === 'GUARDIAN') {
      const link = await this.prisma.guardian.findFirst({
        where: { userId: user.id, studentId },
      });
      if (!link) {
        throw new ForbiddenException('Solo podés ver el historial de tus hijos');
      }
    }

    const results = await this.prisma.promotionResult.findMany({
      where: { studentId, institutionId },
      orderBy: { decidedAt: 'desc' },
      select: {
        fromSchoolYearId: true,
        toSchoolYearId: true,
        result: true,
        isOverride: true,
        reason: true,
        decidedAt: true,
      },
    });

    const graduationResult = results.find(
      (r) => r.result === 'GRADUATED',
    );

    return {
      studentId: student.id,
      studentFullName: `${student.firstName} ${student.lastName}`,
      results: results.map((r) => ({
        fromSchoolYearId: r.fromSchoolYearId,
        toSchoolYearId: r.toSchoolYearId,
        result: r.result,
        isOverride: r.isOverride,
        reason: r.reason,
        decidedAt: r.decidedAt.toISOString(),
      })),
      effectiveGraduationDate: graduationResult?.decidedAt.toISOString() ?? null,
    };
  }

  async getEffectiveResult(
    studentId: string,
    schoolYearId: string,
    institutionId: string,
  ): Promise<any | null> {
    return this.effectiveResultView.getEffectiveResultWithTenant(
      studentId, schoolYearId, institutionId,
    );
  }

  async recalculateSummary(schoolYearId: string, institutionId: string): Promise<void> {
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: schoolYearId, institutionId },
      select: { promotionSummaryStale: true },
    });

    if (!schoolYear) {
      throw new BadRequestException('SCHOOL_YEAR_NOT_FOUND');
    }

    if (!schoolYear.promotionSummaryStale) return;

    const results = await this.effectiveResultView.getEffectiveResults(schoolYearId, institutionId);
    const rows = results as any[];

    const total = rows.length;
    const promoted = rows.filter((r) => r.result === 'PROMOTED').length;
    const retained = rows.filter((r) => r.result === 'RETAINED').length;
    const graduated = rows.filter((r) => r.result === 'GRADUATED').length;
    const overrides = rows.filter((r) => r.isOverride).length;

    const summary = {
      totalStudents: total,
      promoted,
      retained,
      graduated,
      overrides,
      executedAt: new Date().toISOString(),
      executedById: null,
    };

    await this.prisma.schoolYear.update({
      where: { id: schoolYearId },
      data: {
        promotionSummary: summary,
        promotionSummaryStale: false,
      },
    });
  }

  private buildEffectiveWhere(filters: ResultQueryDto, institutionId: string): any {
    return { institutionId };
  }

  private buildRawWhere(filters: ResultQueryDto, institutionId: string): any {
    const where: any = { institutionId };

    if (filters.schoolYearId) {
      where.fromSchoolYearId = filters.schoolYearId;
    }
    if (filters.studentId) {
      where.studentId = filters.studentId;
    }
    if (filters.result) {
      where.result = filters.result;
    }
    if (filters.isOverride !== undefined) {
      where.isOverride = filters.isOverride;
    }

    return where;
  }
}
