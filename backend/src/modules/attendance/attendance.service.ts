import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JustificationsService }    from './justifications.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PromotionStaleHelper } from '../promotion/utils/promotion-stale.helper';
import {
  CreateAttendanceDto,
  BulkAttendanceDto,
  UpdateAttendanceDto,
  AttendanceQueryDto,
} from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma:                PrismaService,
    private readonly justificationsService: JustificationsService,
    private readonly promotionStaleHelper:  PromotionStaleHelper,
  ) {}

  // ── Listar asistencias ───────────────────────
  async findAll(institutionId: string, user: RequestUser, query: AttendanceQueryDto) {
    const where: any = { course: { institutionId } };

    if (query.studentId) where.studentId = query.studentId;
    if (query.courseId)  where.courseId  = query.courseId;
    if (query.date)      where.date      = new Date(query.date);
    if (query.dateFrom || query.dateTo) {
      where.date = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo   && { lte: new Date(query.dateTo) }),
      };
    }

    // GUARDIAN: solo sus hijos
    if (user.role === 'GUARDIAN') {
      const childrenIds = await this.getGuardianChildrenIds(user.id, institutionId);
      where.studentId = { in: childrenIds };
    }

    // TEACHER: solo sus cursos
    if (user.role === 'TEACHER') {
      const courseIds = await this.getTeacherCourseIds(user.id, institutionId);
      where.courseId = { in: courseIds };
    }

    return this.prisma.attendance.findMany({
      where,
      include: this.attendanceIncludes(),
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ── Registrar asistencia individual ─────────
  async create(dto: CreateAttendanceDto, user: RequestUser, institutionId: string) {
    await this.verifyCourseAccess(dto.courseId, user, institutionId);

    // Verificar que el alumno pertenece al tenant
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, institutionId },
    });
    if (!student) throw new NotFoundException('Alumno no encontrado');

    const attendance = await this.prisma.attendance.upsert({
      where: {
        studentId_courseId_date_sportGroupId: {
          studentId: dto.studentId,
          courseId: dto.courseId,
          date: new Date(dto.date),
          sportGroupId: null,
        },
      },
      create: {
        studentId:    dto.studentId,
        courseId:     dto.courseId,
        institutionId,
        date:         new Date(dto.date),
        status:       dto.status,
        recordedById: user.id,
      } as any,
      update: {
        status:        dto.status,
        recordedById:  user.id,
      },
      include: this.attendanceIncludes(),
    });

    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: { schoolYearId: true },
    });
    if (course?.schoolYearId) {
      await this.promotionStaleHelper.markStaleIfCompleted(course.schoolYearId);
    }

    return attendance;
  }

  // ── Carga masiva por curso ───────────────────
  // ── Carga masiva por curso ───────────────────
// ── Carga masiva por curso ───────────────────
async bulkCreate(
  dto: BulkAttendanceDto,
  user: RequestUser,
  institutionId: string,
) {
  await this.verifyCourseAccess(
    dto.courseId,
    user,
    institutionId,
  );

  const [year, month, day] = dto.date
    .split('-')
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day, 12, 0, 0),
  );

  const results = [];

  for (const record of dto.records) {
    const existing =
      await this.prisma.attendance.findFirst({
        where: {
          studentId: record.studentId,
          courseId: dto.courseId,
          date,
          sportGroupId: null,
        },
      });

    const arrivalTime = record.arrivalTime
      ? new Date(
          `1970-01-01T${record.arrivalTime}:00Z`,
        )
      : undefined;

    if (existing) {
      const updated =
        await this.prisma.attendance.update({
          where: {
            id: existing.id,
          },
          data: {
            status: record.status,
            arrivalTime,
            recordedById: user.id,
          },
        });

      results.push(updated);
    } else {
      const created =
        await this.prisma.attendance.create({
          data: {
            studentId: record.studentId,
            courseId: dto.courseId,
            sportGroupId: null,
            date,
            status: record.status,
            arrivalTime,
            recordedById: user.id,
          },
        });

      results.push(created);
    }
  }

  // Obtener registros creados/actualizados
  const createdRecords =
    await this.prisma.attendance.findMany({
      where: {
        courseId: dto.courseId,
        date,
      },
      select: {
        studentId: true,
        status: true,
      },
    });

  // Generar actas automáticas
  const absentStudents = createdRecords.filter(
    (r) => r.status === 'ABSENT',
  );

  await Promise.all(
    absentStudents.map((r) =>
      this.justificationsService.checkAndGenerateRecord(
        r.studentId,
        dto.courseId,
        institutionId,
      ),
    ),
  );

  const course = await this.prisma.course.findUnique({
    where: { id: dto.courseId },
    select: { schoolYearId: true },
  });
  if (course?.schoolYearId) {
    await this.promotionStaleHelper.markStaleIfCompleted(course.schoolYearId);
  }

  return {
    total: results.length,
    date: dto.date,
    courseId: dto.courseId,
  };
}

  // ── Actualizar asistencia ────────────────────
  async update(id: string, dto: UpdateAttendanceDto, user: RequestUser) {
    const attendance = await this.prisma.attendance.findUnique({ where: { id } });
    if (!attendance) throw new NotFoundException('Registro de asistencia no encontrado');

    const course = await this.prisma.course.findUnique({
      where: { id: attendance.courseId },
      select: { institutionId: true, schoolYearId: true },
    });
    await this.verifyCourseAccess(attendance.courseId, user, course!.institutionId);

    const updated = await this.prisma.attendance.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.arrivalTime && {
          arrivalTime: new Date(`1970-01-01T${dto.arrivalTime}:00Z`),
        }),
      },
      include: this.attendanceIncludes(),
    });

    if (course?.schoolYearId) {
      await this.promotionStaleHelper.markStaleIfCompleted(course.schoolYearId);
    }

    return updated;
  }

  // ── Resumen de asistencia por alumno ─────────
  async getSummary(studentId: string, user: RequestUser, institutionId: string) {
    // GUARDIAN: verificar que es su hijo
    if (user.role === 'GUARDIAN') {
      const link = await this.prisma.guardian.findFirst({
        where: { userId: user.id, studentId },
      });
      if (!link) throw new ForbiddenException();
    }

    const records = await this.prisma.attendance.findMany({
      where: {
        studentId,
        course: { institutionId },
      },
      select: { status: true, date: true },
    });

    const summary = records.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        acc.total++;
        return acc;
      },
      { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0, total: 0 } as Record<string, number>,
    );

    const attendanceRate =
      summary.total > 0
        ? Math.round(((summary.PRESENT + summary.LATE) / summary.total) * 100)
        : 0;

    return { ...summary, attendanceRate };
  }

  // ── Helpers privados ─────────────────────────

  private async verifyCourseAccess(courseId: string, user: RequestUser, institutionId: string) {
  const course = await this.prisma.course.findFirst({
    where: { id: courseId, institutionId },
    include: { courseSubjects: { select: { id: true, teacherId: true } } },
  });
  if (!course) throw new NotFoundException('Curso no encontrado');

  if (user.role === 'TEACHER') {
    // Verificar si es docente de alguna materia del curso
    const isTeacherOfCourse = course.courseSubjects.some(cs => cs.teacherId === user.id);

    if (!isTeacherOfCourse) {
      // Verificar si tiene algún recursante en este curso
      const courseSubjectIds = course.courseSubjects.map(cs => cs.id);

      const hasRecursingStudents = await this.prisma.studentCourseSubject.findFirst({
        where: {
          courseSubjectId: { in: courseSubjectIds },
          courseSubject:   { teacherId: user.id },
          type:            'RECURSE',
        },
      });

      if (!hasRecursingStudents) {
        throw new ForbiddenException('Solo podés registrar asistencia en tus propios cursos');
      }
    }
  }
}

  private async getGuardianChildrenIds(userId: string, institutionId: string): Promise<string[]> {
    const guardians = await this.prisma.guardian.findMany({
      where: { userId, student: { institutionId } },
      select: { studentId: true },
    });
    return guardians.map((g) => g.studentId);
  }

  private async getTeacherCourseIds(teacherId: string, institutionId: string): Promise<string[]> {
    const courseSubjects = await this.prisma.courseSubject.findMany({
      where: { teacherId, course: { institutionId } },
      select: { courseId: true },
    });
    return [...new Set(courseSubjects.map((cs) => cs.courseId))];
  }

  private attendanceIncludes() {
    return {
      student: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
      course:  { select: { id: true, name: true, grade: true, division: true } },
      recordedBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }
}
