import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { PendingSubjectsService } from '../pending-subjects/pending-subjects.service';
import { PromotionStaleHelper } from '../promotion/utils/promotion-stale.helper';
import { QUEUES, JOBS, JOB_OPTIONS } from '../../queues/queue.constants';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import type { CreatePendingSubjectDto, UpdatePendingStatusDto, UpdatePendingProgressDto } from './dto/teacher.dto';

@Injectable()
export class TeacherService {
  private readonly logger = new Logger(TeacherService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly pendingSubjectsService: PendingSubjectsService,
    private readonly promotionStaleHelper: PromotionStaleHelper,
    @InjectQueue(QUEUES.AUDIT) private readonly auditQueue: Queue,
  ) {}

  // ── TEMARIO ───────────────────────────────────

  async getSyllabuses(courseSubjectId: string, periodId: string) {
  return this.prisma.syllabus.findMany({
    where: {
      courseSubjectId,
      periodId,
    },
    orderBy: {
      order: 'asc',
    },
  });
}

  async createSyllabus(data: {
  courseSubjectId: string;
  periodId:        string;
  title:           string;
  contents:        string;
  bibliography?:   string;
}) {
  return this.prisma.syllabus.create({
    data,
    include: { period: { select: { id: true, name: true } } },
  });
}

async updateSyllabus(
  id: string,
  data: {
    title?: string;
    contents?: string;
    bibliography?: string;
  }
) {
  return this.prisma.syllabus.update({
    where: { id },
    data,
  });
}

  async deleteSyllabus(id: string) {
    await this.prisma.syllabus.delete({ where: { id } });
  }

  // ── PENDIENTES ────────────────────────────────

  async getPendingSubjects(
    courseId:     string,
    schoolYearId: string,
    institutionId: string,
  ) {
    const enrollments = await this.prisma.courseStudent.findMany({
      where:   { courseId, status: 'ACTIVE' },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, documentNumber: true },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    const studentIds = enrollments.map((e) => e.studentId);

    const pendingSubjects = await this.prisma.pendingSubject.findMany({
      where: {
        studentId:    { in: studentIds },
        schoolYearId,
        institutionId,
      },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
        closingGrade: {
          include: {
            period: { select: { id: true, name: true } },
            courseSubject: { include: { subject: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    const eligibleStudentIds = [
      ...new Set(
        (await this.prisma.closingGrade.findMany({
          where: {
            studentId: { in: studentIds },
            isClosed: true,
            closingScore: { lt: 7 },
            pendingSubject: null,
            courseSubject: { course: { schoolYearId } },
          },
          select: { studentId: true },
        })).map((cg) => cg.studentId),
      ),
    ];

    return {
      students:       enrollments.map((e) => e.student),
      pendingSubjects,
      eligibleStudentIds,
    };
  }

  async upsertPendingSubject(data: {
    studentId:      string;
    subjectId:      string;
    institutionId:  string;
    schoolYearId:   string;
    initialSabers?: string;
    march?:         string;
    august?:        string;
    november?:      string;
    december?:      string;
    february?:      string;
    finalScore?:    string;
    closingSabers?: string;
    closingGradeId?: string;
  }) {
    const existing = await this.prisma.pendingSubject.findFirst({
      where: {
        studentId:    data.studentId,
        subjectId:    data.subjectId,
        schoolYearId: data.schoolYearId,
      },
    });

    if (existing) {
      return this.prisma.pendingSubject.update({
        where: { id: existing.id },
        data: {
          initialSabers:  data.initialSabers,
          march:          data.march,
          august:         data.august,
          november:       data.november,
          december:       data.december,
          february:       data.february,
          finalScore:     data.finalScore,
          closingSabers:  data.closingSabers,
          closingGradeId: data.closingGradeId,
        },
        include: {
          subject: { select: { id: true, name: true } },
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    }

    return this.prisma.pendingSubject.create({
      data: {
        studentId:      data.studentId,
        subjectId:      data.subjectId,
        institutionId:  data.institutionId,
        schoolYearId:   data.schoolYearId,
        initialSabers:  data.initialSabers,
        march:          data.march,
        august:         data.august,
        november:       data.november,
        december:       data.december,
        february:       data.february,
        finalScore:     data.finalScore,
        closingSabers:  data.closingSabers,
        closingGradeId: data.closingGradeId,
      },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async createPendingSubject(dto: CreatePendingSubjectDto, institutionId: string, user: RequestUser) {
    await this.pendingSubjectsService.validateEnabled(institutionId);

    const cg = await this.prisma.closingGrade.findUnique({
      where: { id: dto.closingGradeId },
      include: {
        courseSubject: {
          include: { course: true, subject: true },
        },
        period: true,
      },
    });

    if (!cg) throw new NotFoundException('ClosingGrade no encontrado');
    if (!cg.isClosed) throw new BadRequestException('El período no está cerrado');
    if (Number(cg.closingScore) >= 7) {
      throw new BadRequestException('La nota es >= 7, no requiere intensificación');
    }

    // Tenant validation
    if (cg.courseSubject.course.institutionId !== institutionId) {
      throw new ForbiddenException('El ClosingGrade no pertenece a esta institución');
    }

    // Check existing PendingSubject for this closingGradeId
    const existing = await this.prisma.pendingSubject.findUnique({
      where: { closingGradeId: dto.closingGradeId },
    });
    if (existing) throw new ConflictException('Ya existe una intensificación para este período');

    const created = await this.prisma.pendingSubject.create({
      data: {
        institutionId,
        studentId:     cg.studentId,
        subjectId:     cg.courseSubject.subjectId,
        schoolYearId:  cg.courseSubject.course.schoolYearId,
        closingGradeId: cg.id,
        status:        'ENROLLED',
      },
      include: {
        closingGrade: {
          include: {
            period: true,
            courseSubject: { include: { subject: true } },
          },
        },
      },
    });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId:      user.id,
        action:      'CREATE',
        resource:    'PendingSubject',
        resourceId:  created.id,
        after:       { closingGradeId: dto.closingGradeId, status: 'ENROLLED' },
      },
      JOB_OPTIONS.CRITICAL,
    ).catch((err) => this.logger.error('Audit dispatch failed', err));

    await this.promotionStaleHelper.markStaleIfCompleted(cg.courseSubject.course.schoolYearId);

    return created;
  }

  async updatePendingStatus(id: string, dto: UpdatePendingStatusDto, institutionId: string, user: RequestUser) {
    await this.pendingSubjectsService.validateEnabled(institutionId);

    const existing = await this.prisma.pendingSubject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('PendingSubject no encontrado');
    if (existing.institutionId !== institutionId) throw new ForbiddenException();

    const updated = await this.prisma.pendingSubject.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId:     user.id,
        action:     'UPDATE',
        resource:   'PendingSubject',
        resourceId: id,
        before:     { status: existing.status },
        after:      { status: dto.status },
      },
      JOB_OPTIONS.CRITICAL,
    ).catch((err) => this.logger.error('Audit dispatch failed', err));

    await this.promotionStaleHelper.markStaleIfCompleted(existing.schoolYearId);

    return updated;
  }

  async updatePendingProgress(id: string, dto: UpdatePendingProgressDto, institutionId: string, user: RequestUser) {
    await this.pendingSubjectsService.validatePeriodEdition(institutionId, id, dto);

    const existing = await this.prisma.pendingSubject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('PendingSubject no encontrado');
    if (existing.institutionId !== institutionId) throw new ForbiddenException();

    const updated = await this.prisma.pendingSubject.update({
      where: { id },
      data: {
        initialSabers: dto.initialSabers,
        march:         dto.march,
        august:        dto.august,
        november:      dto.november,
        december:      dto.december,
        february:      dto.february,
        finalScore:    dto.finalScore,
        closingSabers: dto.closingSabers,
      },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId:     user.id,
        action:     'UPDATE',
        resource:   'PendingSubject',
        resourceId: id,
        before:     {
          march: existing.march, august: existing.august,
          november: existing.november, december: existing.december,
          february: existing.february, initialSabers: existing.initialSabers,
          finalScore: existing.finalScore, closingSabers: existing.closingSabers,
        },
        after:      {
          march: dto.march, august: dto.august,
          november: dto.november, december: dto.december,
          february: dto.february, initialSabers: dto.initialSabers,
          finalScore: dto.finalScore, closingSabers: dto.closingSabers,
        },
      },
      JOB_OPTIONS.CRITICAL,
    ).catch((err) => this.logger.error('Audit dispatch failed', err));

    await this.promotionStaleHelper.markStaleIfCompleted(existing.schoolYearId);

    return updated;
  }

  async deletePendingSubject(id: string, institutionId: string, user: RequestUser) {
    await this.pendingSubjectsService.validateEnabled(institutionId);

    const existing = await this.prisma.pendingSubject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('PendingSubject no encontrado');
    if (existing.institutionId !== institutionId) throw new ForbiddenException();

    await this.prisma.pendingSubject.delete({ where: { id } });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId:     user.id,
        action:     'DELETE',
        resource:   'PendingSubject',
        resourceId: id,
        before:     { status: existing.status, subjectId: existing.subjectId },
      },
      JOB_OPTIONS.CRITICAL,
    ).catch((err) => this.logger.error('Audit dispatch failed', err));

    await this.promotionStaleHelper.markStaleIfCompleted(existing.schoolYearId);
  }

  async getStudentPendingSubjects(studentId: string, schoolYearId: string, institutionId: string) {
    return this.prisma.pendingSubject.findMany({
      where: { studentId, schoolYearId, institutionId },
      include: {
        subject: { select: { id: true, name: true } },
        closingGrade: {
          include: {
            period: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async getEligibleSubjects(studentId: string, schoolYearId: string, institutionId: string) {
    const closingGrades = await this.prisma.closingGrade.findMany({
      where: {
        studentId,
        isClosed: true,
        closingScore: { lt: 7 },
        courseSubject: {
          course: { schoolYearId, institutionId },
        },
        pendingSubject: null,
      },
      include: {
        courseSubject: {
          include: { subject: true },
        },
        period: true,
      },
    });

    return closingGrades.map((cg) => ({
      closingGradeId: cg.id,
      subjectId:      cg.courseSubject.subjectId,
      subjectName:    cg.courseSubject.subject.name,
      periodId:       cg.periodId,
      periodName:     cg.period.name,
      closingScore:   Number(cg.closingScore),
    }));
  }
}
