import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import {
  CreateAttendanceDto,
  BulkAttendanceDto,
  UpdateAttendanceDto,
  AttendanceQueryDto,
} from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listar asistencias ───────────────────────
  async findAll(institutionId: string, user: RequestUser, query: AttendanceQueryDto) {
    const where: any = { institutionId };

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

    return this.prisma.attendance.upsert({
      where: {
        studentId_courseId_date: {
          studentId: dto.studentId,
          courseId: dto.courseId,
          date: new Date(dto.date),
        },
      },
      create: {
        studentId:    dto.studentId,
        courseId:     dto.courseId,
        institutionId,
        date:         new Date(dto.date),
        status:       dto.status,
        justification: dto.justification,
        recordedById: user.id,
      } as any,
      update: {
        status:        dto.status,
        justification: dto.justification,
        recordedById:  user.id,
      },
      include: this.attendanceIncludes(),
    });
  }

  // ── Carga masiva por curso ───────────────────
  // El flujo más común: el docente toma lista de todo el curso en un día
  async bulkCreate(dto: BulkAttendanceDto, user: RequestUser, institutionId: string) {
    await this.verifyCourseAccess(dto.courseId, user, institutionId);

    const date = new Date(dto.date);

    const results = await this.prisma.$transaction(
      dto.records.map((record) =>
        this.prisma.attendance.upsert({
          where: {
            studentId_courseId_date: {
              studentId: record.studentId,
              courseId: dto.courseId,
              date,
            },
          },
          create: {
            studentId:     record.studentId,
            courseId:      dto.courseId,
            institutionId,
            date,
            status:        record.status,
            arrivalTime:   record.arrivalTime ? new Date(`1970-01-01T${record.arrivalTime}:00Z`) : undefined,
            justification: record.justification,
            recordedById:  user.id,
          } as any,
          update: {
            status:        record.status,
            arrivalTime:   record.arrivalTime ? new Date(`1970-01-01T${record.arrivalTime}:00Z`) : undefined,
            justification: record.justification,
            recordedById:  user.id,
          },
        }),
      ),
    );

    // TODO Fase 6: emitir evento para notificar ausencias a padres
    // const absences = dto.records.filter(r => r.status === 'ABSENT')
    // await this.notificationQueue.add('attendance.recorded', { absences, date, courseId: dto.courseId })

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
      select: { institutionId: true },
    });
    await this.verifyCourseAccess(attendance.courseId, user, course!.institutionId);

    return this.prisma.attendance.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.arrivalTime && {
          arrivalTime: new Date(`1970-01-01T${dto.arrivalTime}:00Z`),
        }),
      },
      include: this.attendanceIncludes(),
    });
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
      include: { courseSubjects: { select: { teacherId: true } } },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    // TEACHER: solo puede registrar asistencia en sus cursos
    if (user.role === 'TEACHER') {
      const isTeacher = course.courseSubjects.some((cs) => cs.teacherId === user.id);
      if (!isTeacher) {
        throw new ForbiddenException('Solo podés registrar asistencia en tus propios cursos');
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
