import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { QUEUES, JOBS, JOB_OPTIONS } from '../../queues/queue.constants';
import { CreateIndicatorDto } from './dto/create-indicator.dto';
import { UpdateIndicatorDto } from './dto/update-indicator.dto';
import { ReorderIndicatorsDto } from './dto/reorder-indicators.dto';
import { UpsertObservationDto } from './dto/upsert-observation.dto';

@Injectable()
export class IndicatorsService {
  private readonly logger = new Logger(IndicatorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.AUDIT) private readonly auditQueue: Queue,
  ) {}

  // ── Helpers de validación tenant ──────────────────────────────

  private async assertIndicatorBelongsToInstitution(
    indicatorId: string,
    institutionId: string,
  ): Promise<void> {
    const indicator = await this.prisma.indicator.findUnique({
      where: { id: indicatorId },
      include: { subject: { select: { institutionId: true } } },
    });
    if (!indicator || indicator.subject.institutionId !== institutionId) {
      throw new NotFoundException('Indicador no encontrado');
    }
  }

  private async assertCourseBelongsToInstitution(
    courseId: string,
    institutionId: string,
  ): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { institutionId: true },
    });
    if (!course || course.institutionId !== institutionId) {
      throw new NotFoundException('Curso no encontrado');
    }
  }

  private async assertStudentBelongsToInstitution(
    studentId: string,
    institutionId: string,
  ): Promise<void> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { institutionId: true },
    });
    if (!student || student.institutionId !== institutionId) {
      throw new NotFoundException('Estudiante no encontrado');
    }
  }

  // ── Listar indicadores por materia y año ──────────────────────

  async findAll(subjectId: string, schoolYearId: string, grade: number, institutionId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { institutionId: true },
    });
    if (!subject || subject.institutionId !== institutionId) {
      throw new NotFoundException('Materia no encontrada');
    }

    return this.prisma.indicator.findMany({
      where:   { subjectId, schoolYearId, grade },
      orderBy: { order: 'asc' },
    });
  }

  // ── Crear indicador ──────────────────────────────────────────

  async create(
    dto: CreateIndicatorDto,
    institutionId: string,
    userId: string,
  ) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
      select: { institutionId: true },
    });
    if (!subject || subject.institutionId !== institutionId) {
      throw new NotFoundException('Materia no encontrada');
    }

    const order = dto.order ?? (
      ((await this.prisma.indicator.findFirst({
        where: { subjectId: dto.subjectId, schoolYearId: dto.schoolYearId },
        orderBy: { order: 'desc' },
      }))?.order ?? 0) + 1
    );

    const indicator = await this.prisma.indicator.create({
      data: {
        subjectId:    dto.subjectId,
        schoolYearId: dto.schoolYearId,
        grade:        dto.grade,
        description:  dto.description,
        order,
      },
    });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId,
        action: 'CREATE',
        resource: 'Indicator',
        resourceId: indicator.id,
        after: indicator,
      },
      JOB_OPTIONS.CRITICAL,
    );

    return indicator;
  }

  // ── Actualizar indicador ─────────────────────────────────────

  async update(id: string, dto: UpdateIndicatorDto, institutionId: string, userId: string) {
    await this.assertIndicatorBelongsToInstitution(id, institutionId);

    let updated: any;
    try {
      updated = await this.prisma.indicator.update({
        where: { id },
        data: { description: dto.description },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Indicador no encontrado');
      }
      throw err;
    }

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId,
        action: 'UPDATE',
        resource: 'Indicator',
        resourceId: id,
        after: updated,
      },
      JOB_OPTIONS.CRITICAL,
    );

    return updated;
  }

  // ── Reordenar indicadores ────────────────────────────────────

  async reorder(dto: ReorderIndicatorsDto, institutionId: string, userId: string) {
    for (const id of dto.ids) {
      await this.assertIndicatorBelongsToInstitution(id, institutionId);
    }

    const previousOrder = await this.prisma.indicator.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true, order: true, subjectId: true },
      orderBy: { order: 'asc' },
    });

    if (previousOrder.length === 0) {
      throw new NotFoundException('No se encontraron indicadores para reordenar');
    }

    const beforeIds = previousOrder.map((i) => i.id);
    const subjectId = previousOrder[0].subjectId;

    await Promise.all(
      dto.ids.map((id, index) =>
        this.prisma.indicator.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
    );

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId,
        action: 'UPDATE',
        resource: 'Indicator',
        resourceId: subjectId,

        before: {
          reorderedIds: beforeIds,
        },

        after: {
          operation: 'REORDER',
          reorderedIds: dto.ids,
        },
      },
      JOB_OPTIONS.CRITICAL,
    );

    return { message: 'Indicadores reordenados' };
  }

  // ── Eliminar indicador ───────────────────────────────────────

  async remove(id: string, institutionId: string, userId: string) {
    await this.assertIndicatorBelongsToInstitution(id, institutionId);

    try {
      await this.prisma.indicator.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Indicador no encontrado');
      }
      throw err;
    }

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId,
        action: 'DELETE',
        resource: 'Indicator',
        resourceId: id,
      },
      JOB_OPTIONS.CRITICAL,
    );
  }

  // ── Guardar evaluación de un alumno ─────────────────────────

  async upsertEvaluation(data: {
    indicatorId: string;
    studentId:   string;
    periodId:    string;
    value:       string;
  }) {
    return this.prisma.indicatorEvaluation.upsert({
      where: {
        indicatorId_studentId_periodId: {
          indicatorId: data.indicatorId,
          studentId:   data.studentId,
          periodId:    data.periodId,
        },
      },
      create: data,
      update: { value: data.value },
    });
  }

  // ── Guardar evaluaciones masivas ─────────────────────────────

  async bulkUpsertEvaluations(
    evaluations: {
      indicatorId: string;
      studentId:   string;
      periodId:    string;
      value:       string;
    }[],
    institutionId: string,
    user: RequestUser,
  ) {
    const indicatorIds = [...new Set(evaluations.map((e) => e.indicatorId))];

    const indicators = await this.prisma.indicator.findMany({
      where: { id: { in: indicatorIds } },
      include: { subject: { select: { institutionId: true } } },
    });

    if (indicators.length !== indicatorIds.length) {
      throw new NotFoundException('Algunos indicadores no existen');
    }

    const foreign = indicators.find((i) => i.subject.institutionId !== institutionId);
    if (foreign) {
      throw new NotFoundException('Algunos indicadores no pertenecen a esta institución');
    }

    if (user.role === 'TEACHER') {
      const subjectIds = [...new Set(indicators.map((i) => i.subjectId))];
      if (subjectIds.length > 0) {
        const teacherSubjects = await this.prisma.courseSubject.findMany({
          where: { teacherId: user.id, subjectId: { in: subjectIds } },
          select: { subjectId: true },
        });
        const owned = new Set(teacherSubjects.map((ts) => ts.subjectId));
        const unauthorized = indicators.filter((i) => !owned.has(i.subjectId));
        if (unauthorized.length > 0) {
          throw new ForbiddenException('No tenés permisos para algunas evaluaciones');
        }
      }
    }

    await Promise.all(evaluations.map((e) => this.upsertEvaluation(e)));

    const uniqueStudents = new Set(evaluations.map((e) => e.studentId));
    const uniqueIndicators = new Set(evaluations.map((e) => e.indicatorId));
    const periodId = evaluations[0].periodId;

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId: user.id,
        action: 'UPDATE',
        resource: 'IndicatorEvaluation',
        resourceId: `bulk@${periodId}`,
        after: {
          affectedStudents: uniqueStudents.size,
          affectedIndicators: uniqueIndicators.size,
          totalEvaluations: evaluations.length,
          periodId,
        },
      },
      JOB_OPTIONS.CRITICAL,
    );

    return { message: 'Evaluaciones guardadas', total: evaluations.length };
  }

  // ── Obtener evaluaciones de un alumno ────────────────────────

  async getStudentEvaluations(studentId: string, schoolYearId: string, institutionId: string) {
    await this.assertStudentBelongsToInstitution(studentId, institutionId);

    return this.prisma.indicatorEvaluation.findMany({
      where: {
        studentId,
        indicator: { schoolYearId },
      },
      include: {
        indicator: {
          include: { subject: { select: { id: true, name: true } } },
        },
        period: { select: { id: true, name: true, order: true } },
      },
    });
  }

  // ── Obtener evaluaciones de un curso ─────────────────────────

  async getCourseEvaluations(
    courseId:      string,
    subjectId:     string,
    schoolYearId:  string,
    periodId:      string,
    institutionId: string,
    user:          RequestUser,
  ) {
    await this.assertCourseBelongsToInstitution(courseId, institutionId);

    if (user.role === 'TEACHER') {
      await this.assertTeacherOwnsSubject(subjectId, courseId, user.id, institutionId);
    }

    const course = await this.prisma.course.findUnique({
      where:  { id: courseId },
      select: { levelGradeId: true },
    });
    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }

    const indicators = await this.prisma.indicator.findMany({
      where:   { subjectId, schoolYearId, levelGradeId: course.levelGradeId },
      orderBy: { order: 'asc' },
    });

    const enrollments = await this.prisma.courseStudent.findMany({
      where:   { courseId, status: 'ACTIVE' },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { student: { lastName: 'asc' } },
    });

    const evaluations = await this.prisma.indicatorEvaluation.findMany({
      where: {
        periodId,
        indicatorId: { in: indicators.map((i) => i.id) },
        studentId:   { in: enrollments.map((e) => e.studentId) },
      },
    });

    const evalMap = new Map(
      evaluations.map((e) => [`${e.indicatorId}-${e.studentId}`, e.value]),
    );

    return {
      indicators,
      students: enrollments.map((e) => e.student),
      evaluations: evalMap,
      grid: indicators.map((indicator) => ({
        indicator,
        valuesByStudent: Object.fromEntries(
          enrollments.map((e) => [
            e.studentId,
            evalMap.get(`${indicator.id}-${e.studentId}`) ?? null,
          ]),
        ),
      })),
    };
  }

  // ── Guardar observación ─────────────────────────────────────

  async upsertObservation(
    data: UpsertObservationDto & { authorId: string },
    institutionId: string,
    user: RequestUser,
  ) {
    await this.assertCourseBelongsToInstitution(data.courseId, institutionId);

    if (data.subjectId) {
      const subject = await this.prisma.subject.findUnique({
        where: { id: data.subjectId },
        select: { institutionId: true },
      });
      if (!subject || subject.institutionId !== institutionId) {
        throw new NotFoundException('Materia no encontrada');
      }
    }

    if (user.role === 'TEACHER') {
      if (data.subjectId) {
        await this.assertTeacherOwnsSubject(data.subjectId, data.courseId, user.id, institutionId);
      } else {
        const ownsAny = await this.prisma.courseSubject.findFirst({
          where: { courseId: data.courseId, teacherId: user.id },
        });
        if (!ownsAny) {
          throw new ForbiddenException('No enseñás ninguna materia en este curso');
        }
      }
    }

    const existing = await this.prisma.studentObservation.findUnique({
      where: {
        studentId_periodId_courseId_subjectId: {
          studentId: data.studentId,
          periodId:  data.periodId,
          courseId:  data.courseId,
          subjectId: data.subjectId ?? null,
        },
      },
    });

    const observation = await this.prisma.studentObservation.upsert({
      where: {
        studentId_periodId_courseId_subjectId: {
          studentId: data.studentId,
          periodId:  data.periodId,
          courseId:  data.courseId,
          subjectId: data.subjectId ?? null,
        },
      },
      create: {
        studentId:   data.studentId,
        periodId:    data.periodId,
        courseId:    data.courseId,
        subjectId:   data.subjectId,
        observation: data.observation,
        authorId:    data.authorId,
      },
      update: {
        observation: data.observation,
        authorId:    data.authorId,
      },
    });

    const action = existing ? 'UPDATE' : 'CREATE';

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId: user.id,
        action,
        resource: 'StudentObservation',
        resourceId: observation.id,
        before: existing ?? undefined,
        after: observation,
      },
      JOB_OPTIONS.CRITICAL,
    );

    return observation;
  }

  // ── Obtener observaciones de un curso ───────────────────────

  async getCourseObservations(courseId: string, periodId: string, institutionId: string) {
    await this.assertCourseBelongsToInstitution(courseId, institutionId);

    return this.prisma.studentObservation.findMany({
      where: { courseId, periodId },
      select: {
        studentId:   true,
        observation: true,
        updatedAt:   true,
        author: { select: { firstName: true, lastName: true } },
      },
    });
  }

  // ── Helper: validar ownership docente ────────────────────────

  private async assertTeacherOwnsSubject(
    subjectId:     string,
    courseId:      string,
    teacherId:     string,
    institutionId: string,
  ) {
    const assignment = await this.prisma.courseSubject.findFirst({
      where: { courseId, subjectId, teacherId, course: { institutionId } },
    });
    if (!assignment) {
      throw new ForbiddenException('No enseñás esta materia en este curso');
    }
  }
}
