import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { ClosePeriodDto, ReopenPeriodDto, ClosingGradeQueryDto } from './dto/closing-grade.dto';
import { PromotionStaleHelper } from '../promotion/utils/promotion-stale.helper';

@Injectable()
export class ClosingGradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionStaleHelper: PromotionStaleHelper,
  ) {}

  async findAll(institutionId: string, query: ClosingGradeQueryDto) {
    const where: any = {
      period: { schoolYear: { institutionId } },
    };

    if (query.studentId)       where.studentId = query.studentId;
    if (query.courseSubjectId) where.courseSubjectId = query.courseSubjectId;
    if (query.periodId)        where.periodId = query.periodId;
    if (query.isClosed !== undefined) where.isClosed = query.isClosed;

    return this.prisma.closingGrade.findMany({
      where,
      include: {
        student:    { select: { id: true, firstName: true, lastName: true } },
        courseSubject: { include: { subject: true } },
        period:     { select: { id: true, name: true, type: true } },
        closedBy:   { select: { id: true, firstName: true, lastName: true } },
        reopenedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * SECURITY FINDING — CASL BYPASS via upsert
   *
   * TEACHER has `can(Action.Create, 'ClosingGrade')` but NOT `can(Action.Update, 'ClosingGrade')`.
   * However, `prisma.closingGrade.upsert()` matches on the unique constraint
   * `(studentId, courseSubjectId, periodId)` and overwrites the existing `closingScore`
   * via the `update` branch — effectively performing an UPDATE without the Update permission.
   *
   * This means a TEACHER can re-close a period with a different score after ADMIN/DIRECTOR
   * has already closed it, bypassing the intended authorization boundary.
   *
   * Not fixed in this change. Escalate to security/architecture review.
   */
  async close(dto: ClosePeriodDto, user: RequestUser, institutionId: string) {
    const period = await this.prisma.period.findFirst({
      where: { id: dto.periodId, schoolYear: { institutionId } },
    });
    if (!period) throw new NotFoundException('Período no encontrado');

    const courseSubject = await this.prisma.courseSubject.findFirst({
      where: { id: dto.courseSubjectId, course: { institutionId } },
    });
    if (!courseSubject) throw new NotFoundException('Materia/curso no encontrado');

    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, institutionId },
    });
    if (!student) throw new NotFoundException('Alumno no encontrado');

    if (user.role === 'TEACHER' && courseSubject.teacherId !== user.id) {
      throw new ForbiddenException('Solo podés cerrar períodos de tus propias materias');
    }

    const result = await this.prisma.closingGrade.upsert({
      where: {
        studentId_courseSubjectId_periodId: {
          studentId:       dto.studentId,
          courseSubjectId: dto.courseSubjectId,
          periodId:        dto.periodId,
        },
      },
      create: {
        studentId:       dto.studentId,
        courseSubjectId: dto.courseSubjectId,
        periodId:        dto.periodId,
        closingScore:    dto.closingScore,
        isClosed:        true,
        closedAt:        new Date(),
        closedById:      user.id,
      },
      update: {
        isClosed:     true,
        closingScore: dto.closingScore,
        closedAt:     new Date(),
        closedById:   user.id,
      },
    });

    await this.promotionStaleHelper.markStaleIfCompleted(period.schoolYearId);

    return result;
  }

  async reopen(
    studentId: string,
    courseSubjectId: string,
    periodId: string,
    dto: ReopenPeriodDto,
    user: RequestUser,
    institutionId: string,
  ) {
    const closingGrade = await this.prisma.closingGrade.findUnique({
      where: {
        studentId_courseSubjectId_periodId: {
          studentId,
          courseSubjectId,
          periodId,
        },
      },
    });
    if (!closingGrade) throw new NotFoundException('No hay registro de cierre para este período');
    if (!closingGrade.isClosed) throw new BadRequestException('El período ya se encuentra abierto');

    if (user.role !== 'ADMIN' && user.role !== 'DIRECTOR') {
      throw new ForbiddenException('Solo ADMIN o DIRECTOR pueden reabrir períodos');
    }

    const result = await this.prisma.closingGrade.update({
      where: {
        studentId_courseSubjectId_periodId: {
          studentId,
          courseSubjectId,
          periodId,
        },
      },
      data: {
        isClosed:      false,
        reopenedAt:    new Date(),
        reopenedById:  user.id,
        reopenReason:  dto.reopenReason,
        closedAt:      null,
        closedById:    null,
      },
    });

    const period = await this.prisma.period.findUnique({
      where: { id: periodId },
      select: { schoolYearId: true },
    });
    if (period?.schoolYearId) {
      await this.promotionStaleHelper.markStaleIfCompleted(period.schoolYearId);
    }

    return result;
  }

  async isPeriodClosed(
    studentId: string,
    courseSubjectId: string,
    periodId: string,
  ): Promise<boolean> {
    const closingGrade = await this.prisma.closingGrade.findUnique({
      where: {
        studentId_courseSubjectId_periodId: {
          studentId,
          courseSubjectId,
          periodId,
        },
      },
    });

    return closingGrade?.isClosed ?? false;
  }
}
