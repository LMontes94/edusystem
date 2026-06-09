import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Level } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import {
  CreateSchoolYearDto,
  CreateCourseDto,
  UpdateCourseDto,
  AssignTeacherDto,
  CreatePeriodDto,
} from './dto/course.dto';

type ResolvedCourseLevel = {
  levelGradeId: string;
  educationLevelId: string;
  level: Level;
  grade: number;
};

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveLevelGrade(
    params: { levelGradeId?: string; level?: string; grade?: number },
    institutionId: string,
  ): Promise<ResolvedCourseLevel> {
    if (params.levelGradeId) {
      const lg = await this.prisma.levelGrade.findFirst({
        where: {
          id: params.levelGradeId,
          educationLevel: { institutionId },
        },
        include: {
          educationLevel: { select: { id: true, slug: true } },
        },
      });
      if (!lg) {
        throw new BadRequestException('LevelGrade no válido');
      }
      return {
        levelGradeId: lg.id,
        educationLevelId: lg.educationLevel.id,
        level: lg.educationLevel.slug.toUpperCase() as Level,
        grade: lg.displayOrder,
      };
    }

    if (params.level !== undefined && params.grade !== undefined) {
      const lg = await this.prisma.levelGrade.findFirst({
        where: {
          displayOrder: params.grade,
          status: 'ACTIVE',
          educationLevel: {
            slug: params.level.toLowerCase(),
            institutionId,
            status: 'ACTIVE',
          },
        },
        include: {
          educationLevel: { select: { id: true, slug: true } },
        },
      });
      if (!lg) {
        throw new BadRequestException(
          'El nivel/grado especificado no existe, está inactivo o no pertenece a la institución',
        );
      }
      return {
        levelGradeId: lg.id,
        educationLevelId: lg.educationLevel.id,
        level: lg.educationLevel.slug.toUpperCase() as Level,
        grade: lg.displayOrder,
      };
    }

    throw new BadRequestException('Se requiere levelGradeId o (level + grade)');
  }

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
        levelGrade: { include: { educationLevel: { select: { slug: true } } } },
        _count: { select: { courseStudents: true, courseSubjects: true } },
      },
      orderBy: [{ levelGrade: { displayOrder: 'asc' } }, { division: 'asc' }],
    });
  }

  async findOne(id: string, institutionId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, institutionId },
      include: {
        schoolYear: true,
        levelGrade: { include: { educationLevel: { select: { slug: true } } } },
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
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: dto.schoolYearId, institutionId },
    });
    if (!schoolYear) throw new NotFoundException('Año lectivo no encontrado');

    const resolved = await this.resolveLevelGrade(dto, institutionId);

    const course = await this.prisma.course.create({
      data: {
        name: dto.name,
        division: dto.division,
        levelGradeId: resolved.levelGradeId,
        level: resolved.level,
        grade: resolved.grade,
        schoolYearId: dto.schoolYearId,
        institutionId,
      },
    });

    await this.prisma.chatRoom.create({
      data: {
        institutionId,
        type: 'GROUP',
        name: `${dto.name} - ${resolved.grade}° ${dto.division}`,
        courseId: course.id,
        level: resolved.level,
        educationLevelId: resolved.educationLevelId,
      },
    });

    return course;
  }

  async update(id: string, dto: UpdateCourseDto, institutionId: string) {
    await this.findOne(id, institutionId);

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.division !== undefined) data.division = dto.division;

    if (dto.levelGradeId !== undefined || dto.level !== undefined || dto.grade !== undefined) {
      const resolved = await this.resolveLevelGrade(dto, institutionId);
      data.levelGradeId = resolved.levelGradeId;
      data.level = resolved.level;
      data.grade = resolved.grade;
    }

    return this.prisma.course.update({ where: { id }, data });
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

  async getTeacherSubjects(teacherId: string, institutionId: string) {
    const courseSubjects = await this.prisma.courseSubject.findMany({
      where: {
        teacherId,
        course: { institutionId },
      },
      include: {
        subject: true,
        course:  {
          select: {
            id:       true,
            name:     true,
            grade:    true,
            division: true,
            levelGradeId: true,
            courseStudents: {
              where:  { status: 'ACTIVE' },
              select: { id: true },
            },
            levelGrade: {
              include: { educationLevel: { select: { slug: true } } },
            },
          },
        },
      },
    });

    return courseSubjects.map((cs) => ({
      ...cs,
      _count: {
        courseStudents: cs.course.courseStudents?.length ?? 0,
      },
      course: {
        id:       cs.course.id,
        name:     cs.course.name,
        grade:    cs.course.grade,
        division: cs.course.division,
      },
    }));
  }
}
