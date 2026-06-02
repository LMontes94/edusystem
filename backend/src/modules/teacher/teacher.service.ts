import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePendingSubjectDto, UpdatePendingStatusDto, UpdatePendingProgressDto } from './dto/teacher.dto';

@Injectable()
export class TeacherService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      students:       enrollments.map((e) => e.student),
      pendingSubjects,
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

  async createPendingSubject(dto: CreatePendingSubjectDto, institutionId: string) {
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

    return this.prisma.pendingSubject.create({
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
  }

  async updatePendingStatus(id: string, dto: UpdatePendingStatusDto) {
    const existing = await this.prisma.pendingSubject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('PendingSubject no encontrado');

    return this.prisma.pendingSubject.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async updatePendingProgress(id: string, dto: UpdatePendingProgressDto) {
    const existing = await this.prisma.pendingSubject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('PendingSubject no encontrado');

    return this.prisma.pendingSubject.update({
      where: { id },
      data: {
        march:        dto.march,
        august:       dto.august,
        november:     dto.november,
        december:     dto.december,
        february:     dto.february,
        finalScore:   dto.finalScore,
        closingSabers: dto.closingSabers,
      },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async deletePendingSubject(id: string) {
    await this.prisma.pendingSubject.delete({ where: { id } });
  }

  async getStudentPendingSubjects(studentId: string, schoolYearId: string) {
    return this.prisma.pendingSubject.findMany({
      where: { studentId, schoolYearId },
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

  async getEligibleSubjects(studentId: string, schoolYearId: string) {
    const closingGrades = await this.prisma.closingGrade.findMany({
      where: {
        studentId,
        isClosed: true,
        closingScore: { lt: 7 },
        courseSubject: { course: { schoolYearId } },
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
