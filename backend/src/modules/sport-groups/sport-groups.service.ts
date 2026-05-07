import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma }         from '@prisma/client';
import { PrismaService }  from '../../prisma/prisma.service';
import { RequestUser }    from '../../common/decorators/current-user.decorator';
import { JustificationsService } from '../attendance/justifications.service';
import {
  CreateSportGroupDto,
  UpdateSportGroupDto,
  AddStudentsDto,
  RemoveStudentDto,
  SportGroupQueryDto,
  BulkSportAttendanceDto,
  SportAttendanceQueryDto,
} from './dto/sport-group.dto';

@Injectable()
export class SportGroupsService {
  constructor(
    private readonly prisma:                PrismaService,
    private readonly justificationsService: JustificationsService,
  ) {}

  // ─── Includes reutilizables ───────────────────────────────────────────────

  private groupIncludes() {
    return {
      sport:      { select: { id: true, name: true } },
      schoolYear: { select: { id: true, year: true } },
      teachers: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      students: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
        },
        orderBy: { student: { lastName: Prisma.SortOrder.asc } },
      },
      _count: { select: { students: true, attendances: true } },
    };
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findAll(institutionId: string, user: RequestUser, query: SportGroupQueryDto) {
    const where: any = { institutionId };

    if (query.sportId)      where.sportId      = query.sportId;
    if (query.schoolYearId) where.schoolYearId = query.schoolYearId;

    // TEACHER: solo ve los grupos donde está asignado
    if (user.role === 'TEACHER') {
      where.teachers = { some: { userId: user.id } };
    }

    return this.prisma.sportGroup.findMany({
      where,
      include: this.groupIncludes(),
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, institutionId: string) {
    const group = await this.prisma.sportGroup.findFirst({
      where: { id, institutionId },
      include: this.groupIncludes(),
    });
    if (!group) throw new NotFoundException('Grupo de deporte no encontrado');
    return group;
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async create(institutionId: string, dto: CreateSportGroupDto) {
    // Verificar que el deporte pertenece a la institución
    const sport = await this.prisma.sport.findFirst({
      where: { id: dto.sportId, institutionId, deletedAt: null },
    });
    if (!sport) throw new NotFoundException('Deporte no encontrado');

    // Verificar que el año lectivo pertenece a la institución
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: dto.schoolYearId, institutionId },
    });
    if (!schoolYear) throw new NotFoundException('Año lectivo no encontrado');

    return this.prisma.sportGroup.create({
      data: {
        institutionId,
        sportId:      dto.sportId,
        schoolYearId: dto.schoolYearId,
        name:         dto.name,
        teachers: {
          create: dto.teacherIds.map(userId => ({ userId })),
        },
        students: {
          create: dto.studentIds.map(studentId => ({ studentId })),
        },
      },
      include: this.groupIncludes(),
    });
  }

  async update(id: string, institutionId: string, dto: UpdateSportGroupDto) {
    await this.findOne(id, institutionId);

    return this.prisma.$transaction(async (tx) => {
      // Actualizar nombre si viene
      if (dto.name) {
        await tx.sportGroup.update({ where: { id }, data: { name: dto.name } });
      }

      // Reemplazar docentes si vienen
      if (dto.teacherIds) {
        await tx.sportGroupTeacher.deleteMany({ where: { sportGroupId: id } });
        await tx.sportGroupTeacher.createMany({
          data: dto.teacherIds.map(userId => ({ sportGroupId: id, userId })),
        });
      }

      // Reemplazar alumnos si vienen
      if (dto.studentIds) {
        await tx.sportGroupStudent.deleteMany({ where: { sportGroupId: id } });
        await tx.sportGroupStudent.createMany({
          data: dto.studentIds.map(studentId => ({ sportGroupId: id, studentId })),
          skipDuplicates: true,
        });
      }

      return tx.sportGroup.findFirst({
        where: { id },
        include: this.groupIncludes(),
      });
    });
  }

  async remove(id: string, institutionId: string) {
    await this.findOne(id, institutionId);
    return this.prisma.$transaction(async (tx) => {
      await tx.sportGroupTeacher.deleteMany({ where: { sportGroupId: id } });
      await tx.sportGroupStudent.deleteMany({ where: { sportGroupId: id } });
      return tx.sportGroup.delete({ where: { id } });
    });
  }

  // ─── Gestión de alumnos ───────────────────────────────────────────────────

  async addStudents(id: string, institutionId: string, dto: AddStudentsDto) {
    await this.findOne(id, institutionId);

    // Verificar que los alumnos no están ya en OTRO grupo del mismo deporte+año
    const group = await this.prisma.sportGroup.findUnique({
      where: { id },
      select: { sportId: true, schoolYearId: true },
    });

    const conflicts = await this.prisma.sportGroupStudent.findMany({
      where: {
        studentId: { in: dto.studentIds },
        sportGroup: {
          sportId:      group!.sportId,
          schoolYearId: group!.schoolYearId,
          id:           { not: id }, // excluir el grupo actual
        },
      },
      include: {
        student:    { select: { firstName: true, lastName: true } },
        sportGroup: { select: { name: true } },
      },
    });

    if (conflicts.length > 0) {
      const names = conflicts
        .map(c => `${c.student.firstName} ${c.student.lastName} (${c.sportGroup.name})`)
        .join(', ');
      throw new ConflictException(
        `Los siguientes alumnos ya están en otro grupo del mismo deporte: ${names}`,
      );
    }

    await this.prisma.sportGroupStudent.createMany({
      data: dto.studentIds.map(studentId => ({ sportGroupId: id, studentId })),
      skipDuplicates: true,
    });

    return this.findOne(id, institutionId);
  }

  async removeStudent(id: string, institutionId: string, studentId: string) {
    await this.findOne(id, institutionId);
    await this.prisma.sportGroupStudent.delete({
      where: { sportGroupId_studentId: { sportGroupId: id, studentId } },
    });
    return this.findOne(id, institutionId);
  }

  // ─── Asistencia de deportes ───────────────────────────────────────────────

  async getAttendance(institutionId: string, user: RequestUser, query: SportAttendanceQueryDto) {
    const where: any = {
      sportGroupId: { not: null },
      course: { institutionId },
    };

    if (query.sportGroupId) where.sportGroupId = query.sportGroupId;
    if (query.date)         where.date = new Date(query.date);
    if (query.dateFrom || query.dateTo) {
      where.date = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo   && { lte: new Date(query.dateTo) }),
      };
    }

    // TEACHER: solo sus grupos
    if (user.role === 'TEACHER') {
      const groupIds = await this.getTeacherGroupIds(user.id);
      where.sportGroupId = { in: groupIds };
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        student:    { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
        course:     { select: { id: true, name: true, grade: true, division: true } },
        sportGroup: { select: { id: true, name: true, sport: { select: { name: true } } } },
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async bulkAttendance(dto: BulkSportAttendanceDto, user: RequestUser, institutionId: string) {
    // Verificar que el docente pertenece al grupo
    await this.verifySportGroupAccess(dto.sportGroupId, user);

    // Verificar que el curso pertenece a la institución
    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, institutionId },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    const [year, month, day] = dto.date.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    const results = await this.prisma.$transaction(
      dto.records.map(record =>
        this.prisma.attendance.upsert({
          where: {
            studentId_courseId_date_sportGroupId: {
              studentId:    record.studentId,
              courseId:     dto.courseId,
              date,
              sportGroupId: dto.sportGroupId,
            },
          },
          create: {
            studentId:    record.studentId,
            courseId:     dto.courseId,
            sportGroupId: dto.sportGroupId,
            date,
            status:       record.status,
            arrivalTime:  record.arrivalTime
              ? new Date(`1970-01-01T${record.arrivalTime}:00Z`)
              : undefined,
            recordedById: user.id,
          } as any,
          update: {
            status:      record.status,
            arrivalTime: record.arrivalTime
              ? new Date(`1970-01-01T${record.arrivalTime}:00Z`)
              : undefined,
            recordedById: user.id,
          },
        }),
      ),
    );

    // Verificar actas para ausentes (igual que attendance normal)
    const absentStudents = dto.records.filter(r => r.status === 'ABSENT');
    await Promise.all(
      absentStudents.map(r =>
        this.justificationsService.checkAndGenerateRecord(
          r.studentId, dto.courseId, institutionId,
        ),
      ),
    );

    return {
      total:        results.length,
      date:         dto.date,
      sportGroupId: dto.sportGroupId,
      courseId:     dto.courseId,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async verifySportGroupAccess(sportGroupId: string, user: RequestUser) {
    if (['ADMIN', 'DIRECTOR', 'SECRETARY', 'PRECEPTOR'].includes(user.role)) return;

    if (user.role === 'TEACHER') {
      const assignment = await this.prisma.sportGroupTeacher.findUnique({
        where: { sportGroupId_userId: { sportGroupId, userId: user.id } },
      });
      if (!assignment) {
        throw new ForbiddenException('Solo podés registrar asistencia en tus grupos de deporte');
      }
    }
  }

  private async getTeacherGroupIds(userId: string): Promise<string[]> {
    const assignments = await this.prisma.sportGroupTeacher.findMany({
      where: { userId },
      select: { sportGroupId: true },
    });
    return assignments.map(a => a.sportGroupId);
  }
}