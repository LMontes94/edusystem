import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateGradeDto, UpdateGradeDto, GradeQueryDto } from './dto/grade.dto';
import { QUEUES, JOBS, JOB_OPTIONS } from '../../queues/queue.constants';
import { StudentCourseSubjectsService } from '../student-course-subjects/student-course-subjects.service';

@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentSubjectsService: StudentCourseSubjectsService,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly notificationQueue: Queue,
    @InjectQueue(QUEUES.AUDIT)         private readonly auditQueue: Queue,
    @InjectQueue(QUEUES.GRADES)        private readonly gradeQueue: Queue,
  ) {}

  async findAll(
    institutionId: string,
    user: RequestUser,
    query: GradeQueryDto,
  ) {
    const where: any = {};
  
    // ── Filtros básicos ─────────────────────────
    if (query.studentId) {
      where.studentId = query.studentId;
    }
  
    if (query.periodId) {
      where.periodId = query.periodId;
    }
  
    if (query.courseSubjectId) {
      where.courseSubjectId = query.courseSubjectId;
    }
  
    // ── Filtros relacionales ────────────────────
    if (query.courseId || query.subjectId) {
      where.courseSubject = {};
  
      if (query.courseId) {
        where.courseSubject.courseId = query.courseId;
      }
  
      if (query.subjectId) {
        where.courseSubject.subjectId = query.subjectId;
      }
    }
  
    // ── GUARDIAN ────────────────────────────────
    if (user.role === 'GUARDIAN') {
      const childrenIds = await this.getGuardianChildrenIds(
        user.id,
        institutionId,
      );
  
      where.studentId = {
        in: childrenIds,
      };
  
      return this.prisma.grade.findMany({
        where,
        include: this.gradeIncludes(),
        orderBy: {
          date: 'desc',
        },
      });
    }
  
    // ── TEACHER ─────────────────────────────────
    if (user.role === 'TEACHER') {
      const courseSubjects =
        await this.prisma.courseSubject.findMany({
          where: {
            teacherId: user.id,
          },
          select: {
            id: true,
          },
        });
  
      const courseSubjectIds =
        courseSubjects.map((cs) => cs.id);
  
      // Si no tiene materias asignadas
      if (courseSubjectIds.length === 0) {
        return [];
      }
  
      // Buscar recursantes
      const recursingStudents =
        await this.prisma.studentCourseSubject.findMany({
          where: {
            courseSubjectId: {
              in: courseSubjectIds,
            },
            type: 'RECURSE',
          },
          select: {
            studentId: true,
            courseSubjectId: true,
          },
        });
  
      // Condiciones OR
      const orConditions: any[] = [
        {
          ...where,
          courseSubject: {
            ...(where.courseSubject || {}),
            teacherId: user.id,
          },
        },
      ];
  
      // Agregar recursantes
      for (const rs of recursingStudents) {
        orConditions.push({
          ...where,
          studentId: rs.studentId,
          courseSubjectId: rs.courseSubjectId,
        });
      }
  
      return this.prisma.grade.findMany({
        where: {
          OR: orConditions,
        },
        include: this.gradeIncludes(),
        orderBy: {
          date: 'desc',
        },
      });
    }
  
    // ── ADMIN / DIRECTIVOS ──────────────────────
    return this.prisma.grade.findMany({
      where,
      include: this.gradeIncludes(),
      orderBy: {
        date: 'desc',
      },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const grade = await this.prisma.grade.findUnique({
      where: { id },
      include: {
        ...this.gradeIncludes(),
        courseSubject: {
          include: {
            subject: true,
            teacher: { select: { id: true, firstName: true, lastName: true } },
            course:  { select: { id: true, name: true, grade: true, division: true } },
          },
        },
      },
    });

    if (!grade) throw new NotFoundException('Nota no encontrada');
    await this.verifyAccess(grade, user);
    return grade;
  }

  async create(dto: CreateGradeDto, user: RequestUser, institutionId: string) {
  const courseSubject = await this.prisma.courseSubject.findFirst({
    where: { id: dto.courseSubjectId, course: { institutionId } },
    include: { course: true },
  });
  if (!courseSubject) throw new NotFoundException('Materia/curso no encontrado');

  if (user.role === 'TEACHER') {
    if (courseSubject.teacherId !== user.id) {
      throw new ForbiddenException('Solo podés cargar notas de tus propias materias');
    }

    const activeIds = await this.studentSubjectsService.getActiveSubjectIds(dto.studentId);
    if (!activeIds.includes(dto.courseSubjectId)) {
      throw new ForbiddenException(
        'El alumno no tiene asignada esta materia (no es de su curso ni la recursa)',
      );
    }
  }

  const student = await this.prisma.student.findFirst({
    where: { id: dto.studentId, institutionId },
  });
  if (!student) throw new NotFoundException('Alumno no encontrado');

  const period = await this.prisma.period.findFirst({
    where: { id: dto.periodId, schoolYear: { institutionId } },
  });
  if (!period) throw new NotFoundException('Período no encontrado');

  const grade = await this.prisma.grade.upsert({
    where: {
      studentId_courseSubjectId_periodId_type_date: {
        studentId:       dto.studentId,
        courseSubjectId: dto.courseSubjectId,
        periodId:        dto.periodId,
        type:            dto.type as any,
        date:            new Date(dto.date),
      },
    },
    create: {
      studentId:       dto.studentId,
      courseSubjectId: dto.courseSubjectId,
      periodId:        dto.periodId,
      score:           dto.score,
      type:            dto.type,
      description:     dto.description,
      date:            new Date(dto.date),
    } as any,
    update: {
      score:       dto.score,
      description: dto.description,
    },
    include: this.gradeIncludes(),
  });

  await Promise.all([
    this.notificationQueue.add(
      JOBS.GRADE_CREATED,
      { gradeId: grade.id, studentId: dto.studentId, institutionId },
      JOB_OPTIONS.DEFAULT,
    ),
    this.auditQueue.add(
      JOBS.AUDIT_LOG,
      { institutionId, userId: user.id, action: 'CREATE', resource: 'Grade', resourceId: grade.id, after: grade },
      JOB_OPTIONS.CRITICAL,
    ),
    this.gradeQueue.add(
      JOBS.RECALCULATE_AVERAGE,
      { studentId: dto.studentId, periodId: dto.periodId },
      JOB_OPTIONS.DEFAULT,
    ),
  ]);

  return grade;
}

  async update(id: string, dto: UpdateGradeDto, user: RequestUser) {
    const grade = await this.prisma.grade.findUnique({
      where: { id },
      include: { courseSubject: true },
    });
    if (!grade) throw new NotFoundException('Nota no encontrada');
    await this.verifyWriteAccess(grade, user);

    const updated = await this.prisma.grade.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.date && { date: new Date(dto.date) }),
      },
      include: this.gradeIncludes(),
    });

    // Emitir auditoría y recálculo
    const student = await this.prisma.student.findUnique({
      where: { id: grade.studentId },
      select: { institutionId: true },
    });

    await Promise.all([
      this.auditQueue.add(
        JOBS.AUDIT_LOG,
        {
          institutionId: student?.institutionId,
          userId: user.id,
          action: 'UPDATE',
          resource: 'Grade',
          resourceId: id,
          before: grade,
          after: updated,
        },
        JOB_OPTIONS.CRITICAL,
      ),
      this.gradeQueue.add(
        JOBS.RECALCULATE_AVERAGE,
        { studentId: grade.studentId, periodId: grade.periodId },
        JOB_OPTIONS.DEFAULT,
      ),
    ]);

    return updated;
  }

  async remove(id: string, user: RequestUser) {
    const grade = await this.prisma.grade.findUnique({
      where: { id },
      include: { courseSubject: true },
    });
    if (!grade) throw new NotFoundException('Nota no encontrada');
    await this.verifyWriteAccess(grade, user);
    await this.prisma.grade.delete({ where: { id } });
  }

  async getAverage(studentId: string, periodId: string, user: RequestUser, institutionId: string) {
    if (user.role === 'GUARDIAN') {
      const childrenIds = await this.getGuardianChildrenIds(user.id, institutionId);
      if (!childrenIds.includes(studentId)) throw new ForbiddenException();
    }

    const grades = await this.prisma.grade.findMany({
      where: { studentId, periodId },
      select: { score: true, type: true, courseSubject: { select: { subject: { select: { name: true } } } } },
    });

    if (grades.length === 0) return { average: null, total: 0 };
    const sum = grades.reduce((acc, g) => acc + Number(g.score), 0);
    return {
      average: Math.round((sum / grades.length) * 100) / 100,
      total: grades.length,
      grades,
    };
  }

  private async verifyAccess(grade: any, user: RequestUser) {
    if (user.role === 'SUPER_ADMIN') return;
    const student = await this.prisma.student.findUnique({
      where: { id: grade.studentId },
      select: { institutionId: true },
    });
    if (student?.institutionId !== user.institutionId) throw new ForbiddenException();
    if (user.role === 'GUARDIAN') {
      const link = await this.prisma.guardian.findFirst({
        where: { userId: user.id, studentId: grade.studentId },
      });
      if (!link) throw new ForbiddenException('Solo podés ver notas de tus hijos');
    }
  }

  private async verifyWriteAccess(grade: any, user: RequestUser) {
    await this.verifyAccess(grade, user);
    if (user.role === 'TEACHER' && grade.courseSubject?.teacherId !== user.id) {
      throw new ForbiddenException('Solo podés modificar notas de tus propias materias');
    }
  }

  private async getGuardianChildrenIds(userId: string, institutionId: string): Promise<string[]> {
    const guardians = await this.prisma.guardian.findMany({
      where: { userId, student: { institutionId } },
      select: { studentId: true },
    });
    return guardians.map((g) => g.studentId);
  }

  private gradeIncludes() {
    return {
      student:       { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
      period:        { select: { id: true, name: true, type: true } },
      courseSubject: {
        select: {
          id: true,
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    };
  }
}
