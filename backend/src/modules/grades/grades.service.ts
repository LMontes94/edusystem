import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateGradeDto, UpdateGradeDto, GradeQueryDto } from './dto/grade.dto';

// ──────────────────────────────────────────────
// GradesService — módulo con mayor criticidad de seguridad.
//
// Doble validación ABAC:
//   1. CaslGuard verifica el rol a nivel de endpoint
//   2. El servicio verifica la propiedad del recurso:
//      - TEACHER solo puede gestionar notas de sus materias
//      - GUARDIAN solo puede ver notas de sus hijos
//      - ADMIN puede ver/gestionar todas las notas de su institución
//
// Nunca confiar solo en el guard — el servicio siempre
// verifica que el recurso pertenece al tenant y al usuario.
// ──────────────────────────────────────────────

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listar notas ─────────────────────────────
  async findAll(institutionId: string, user: RequestUser, query: GradeQueryDto) {
    // GUARDIAN: solo puede ver notas de sus hijos
    if (user.role === 'GUARDIAN') {
      const childrenIds = await this.getGuardianChildrenIds(user.id, institutionId);
      return this.prisma.grade.findMany({
        where: {
          studentId: { in: childrenIds },
          ...query,
        },
        include: this.gradeIncludes(),
        orderBy: { date: 'desc' },
      });
    }

    // TEACHER: solo puede ver notas de sus materias
    if (user.role === 'TEACHER') {
      return this.prisma.grade.findMany({
        where: {
          courseSubject: { teacherId: user.id },
          ...query,
        },
        include: this.gradeIncludes(),
        orderBy: { date: 'desc' },
      });
    }

    // ADMIN / SUPER_ADMIN: ve todas las notas del tenant
    return this.prisma.grade.findMany({
      where: {
        student: { institutionId },
        ...query,
      },
      include: this.gradeIncludes(),
      orderBy: { date: 'desc' },
    });
  }

  // ── Obtener una nota ─────────────────────────
  async findOne(id: string, user: RequestUser) {
    const grade = await this.prisma.grade.findUnique({
      where: { id },
      include: {
        ...this.gradeIncludes(),
        courseSubject: {
          include: {
            subject: true,
            teacher: { select: { id: true, firstName: true, lastName: true } },
            course: { select: { id: true, name: true, grade: true, division: true } },
          },
        },
      },
    });

    if (!grade) throw new NotFoundException('Nota no encontrada');

    await this.verifyAccess(grade, user);
    return grade;
  }

  // ── Crear nota ───────────────────────────────
  async create(dto: CreateGradeDto, user: RequestUser, institutionId: string) {
    // Verificar que el courseSubject pertenece al tenant
    const courseSubject = await this.prisma.courseSubject.findFirst({
      where: {
        id: dto.courseSubjectId,
        course: { institutionId },
      },
      include: { course: true },
    });
    if (!courseSubject) throw new NotFoundException('Materia/curso no encontrado');

    // ABAC: TEACHER solo puede cargar notas de sus propias materias
    if (user.role === 'TEACHER' && courseSubject.teacherId !== user.id) {
      throw new ForbiddenException('Solo podés cargar notas en tus propias materias');
    }

    // Verificar que el alumno pertenece al tenant
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, institutionId },
    });
    if (!student) throw new NotFoundException('Alumno no encontrado');

    // Verificar que el período pertenece al tenant
    const period = await this.prisma.period.findFirst({
      where: {
        id: dto.periodId,
        schoolYear: { institutionId },
      },
    });
    if (!period) throw new NotFoundException('Período no encontrado');

    const grade = await this.prisma.grade.create({
      data: {
        studentId: dto.studentId,
        courseSubjectId: dto.courseSubjectId,
        periodId: dto.periodId,
        score: dto.score,
        type: dto.type,
        description: dto.description,
        date: new Date(dto.date),
      } as any,
      include: this.gradeIncludes(),
    });

    // TODO Fase 6: emitir jobs
    // await this.notificationQueue.add('grade.created', { gradeId: grade.id, studentId: grade.studentId })
    // await this.auditQueue.add('audit', { userId: user.id, action: 'CREATE', resource: 'Grade', after: grade })
    // await this.gradeQueue.add('recalculate-average', { studentId: grade.studentId, periodId: grade.periodId })

    return grade;
  }

  // ── Actualizar nota ──────────────────────────
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

    // TODO Fase 6: emitir jobs de auditoría y recálculo de promedio

    return updated;
  }

  // ── Eliminar nota ────────────────────────────
  async remove(id: string, user: RequestUser) {
    const grade = await this.prisma.grade.findUnique({
      where: { id },
      include: { courseSubject: true },
    });
    if (!grade) throw new NotFoundException('Nota no encontrada');

    await this.verifyWriteAccess(grade, user);
    await this.prisma.grade.delete({ where: { id } });
  }

  // ── Promedio por período ─────────────────────
  async getAverage(studentId: string, periodId: string, user: RequestUser, institutionId: string) {
    // GUARDIAN: verificar que el alumno es su hijo
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

  // ── Helpers privados ─────────────────────────

  private async verifyAccess(grade: any, user: RequestUser) {
    if (user.role === 'SUPER_ADMIN') return;

    // Verificar tenant
    const student = await this.prisma.student.findUnique({
      where: { id: grade.studentId },
      select: { institutionId: true },
    });
    if (student?.institutionId !== user.institutionId) {
      throw new ForbiddenException();
    }

    // GUARDIAN: verificar que es su hijo
    if (user.role === 'GUARDIAN') {
      const link = await this.prisma.guardian.findFirst({
        where: { userId: user.id, studentId: grade.studentId },
      });
      if (!link) throw new ForbiddenException('Solo podés ver notas de tus hijos');
    }
  }

  private async verifyWriteAccess(grade: any, user: RequestUser) {
    await this.verifyAccess(grade, user);

    // TEACHER: solo puede modificar notas de sus materias
    if (user.role === 'TEACHER' && grade.courseSubject?.teacherId !== user.id) {
      throw new ForbiddenException('Solo podés modificar notas de tus propias materias');
    }
  }

  private async getGuardianChildrenIds(userId: string, institutionId: string): Promise<string[]> {
    const guardians = await this.prisma.guardian.findMany({
      where: {
        userId,
        student: { institutionId },
      },
      select: { studentId: true },
    });
    return guardians.map((g) => g.studentId);
  }

  private gradeIncludes() {
    return {
      student: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
      period: { select: { id: true, name: true, type: true } },
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
