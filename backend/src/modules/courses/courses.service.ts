import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import {
  CreateSchoolYearDto,
  CreateCourseDto,
  UpdateCourseDto,
  AssignTeacherDto,
  CreatePeriodDto,
} from './dto/course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── School Years ─────────────────────────────
  async findAllSchoolYears(institutionId: string) {
    return this.prisma.schoolYear.findMany({
      where: { institutionId },
      include: { _count: { select: { courses: true, periods: true } } },
      orderBy: { year: 'desc' },
    });
  }

  async createSchoolYear(dto: CreateSchoolYearDto, institutionId: string) {
    const existing = await this.prisma.schoolYear.findUnique({
      where: { institutionId_year: { institutionId, year: dto.year } },
    });
    if (existing) throw new ConflictException(`El año lectivo ${dto.year} ya existe`);

    return this.prisma.schoolYear.create({
      data: {
        institutionId,
        year: dto.year,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async setActiveSchoolYear(schoolYearId: string, institutionId: string) {
    // Desactivar todos y activar solo el seleccionado
    await this.prisma.$transaction([
      this.prisma.schoolYear.updateMany({
        where: { institutionId },
        data: { isActive: false },
      }),
      this.prisma.schoolYear.update({
        where: { id: schoolYearId },
        data: { isActive: true },
      }),
    ]);
    return { message: 'Año lectivo activado' };
  }

  // ── Courses ───────────────────────────────────
  async findAll(institutionId: string, schoolYearId?: string) {
    return this.prisma.course.findMany({
      where: {
        institutionId,
        ...(schoolYearId && { schoolYearId }),
      },
      include: {
        schoolYear: { select: { year: true, isActive: true } },
        _count: { select: { courseStudents: true, courseSubjects: true } },
      },
      orderBy: [{ grade: 'asc' }, { division: 'asc' }],
    });
  }

  async findOne(id: string, institutionId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, institutionId },
      include: {
        schoolYear: true,
        courseStudents: {
          where: { status: 'ACTIVE' },
          include: { student: { select: { id: true, firstName: true, lastName: true, documentNumber: true } } },
        },
        courseSubjects: {
          include: {
            subject: true,
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return course;
  }

  async create(dto: CreateCourseDto, institutionId: string) {
    // Verificar que el año lectivo pertenece a la institución
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: dto.schoolYearId, institutionId },
    });
    if (!schoolYear) throw new NotFoundException('Año lectivo no encontrado');

    return this.prisma.course.create({
      data: {
        name: dto.name!,
        grade: dto.grade!,
        division: dto.division!,
        level: dto.level!,
        schoolYearId: dto.schoolYearId!,
        institutionId,
      } as any,
    });
  }

  async update(id: string, dto: UpdateCourseDto, institutionId: string) {
    await this.findOne(id, institutionId);
    return this.prisma.course.update({ where: { id }, data: dto });
  }

  async remove(id: string, institutionId: string) {
    await this.findOne(id, institutionId);
    await this.prisma.course.delete({ where: { id } });
  }

  // ── Teacher assignment ────────────────────────
  async assignTeacher(courseId: string, dto: AssignTeacherDto, institutionId: string) {
    await this.findOne(courseId, institutionId);

    // Verificar que la materia pertenece a la institución
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, institutionId },
    });
    if (!subject) throw new NotFoundException('Materia no encontrada');

    // Verificar que el docente pertenece a la institución
    const teacher = await this.prisma.user.findFirst({
      where: { id: dto.teacherId, institutionId, role: 'TEACHER' },
    });
    if (!teacher) throw new NotFoundException('Docente no encontrado en esta institución');

    return this.prisma.courseSubject.upsert({
      where: { courseId_subjectId: { courseId, subjectId: dto.subjectId } },
      create: { courseId, subjectId: dto.subjectId, teacherId: dto.teacherId, hoursPerWeek: dto.hoursPerWeek },
      update: { teacherId: dto.teacherId, hoursPerWeek: dto.hoursPerWeek },
    });
  }

  // ── Courses del docente (para TEACHER) ────────
  async findByTeacher(teacherId: string, institutionId: string) {
    return this.prisma.course.findMany({
      where: {
        institutionId,
        courseSubjects: { some: { teacherId } },
      },
      include: {
        courseSubjects: {
          where: { teacherId },
          include: { subject: true },
        },
        _count: { select: { courseStudents: true } },
      },
    });
  }

  // ── Periods ───────────────────────────────────
  async createPeriod(dto: CreatePeriodDto, institutionId: string) {
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: dto.schoolYearId, institutionId },
    });
    if (!schoolYear) throw new NotFoundException('Año lectivo no encontrado');

    return this.prisma.period.create({
      data: {
        name: dto.name!,
        type: dto.type!,
        order: dto.order!,
        startDate: new Date(dto.startDate!),
        endDate: new Date(dto.endDate!),
        schoolYearId: dto.schoolYearId!,
      } as any,
    });
  }

  async findPeriods(schoolYearId: string, institutionId: string) {
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: schoolYearId, institutionId },
    });
    if (!schoolYear) throw new NotFoundException('Año lectivo no encontrado');

    return this.prisma.period.findMany({
      where: { schoolYearId },
      orderBy: { order: 'asc' },
    });
  }
}
