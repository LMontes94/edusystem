import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser }   from '../../common/decorators/current-user.decorator';
import {
  AssignSubjectDto,
  UpdateSubjectAssignmentDto,
  StudentSubjectQueryDto,
} from './dto/student-course-subject.dto';

@Injectable()
export class StudentCourseSubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Includes reutilizables ───────────────────────────────────────────────

  private assignmentIncludes() {
    return {
      courseSubject: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          course:  { select: { id: true, name: true, grade: true, division: true, levelGrade: { select: { id: true, displayOrder: true, name: true } } } },
        },
      },
      schoolYear: { select: { id: true, year: true } },
      createdBy:  { select: { id: true, firstName: true, lastName: true } },
    };
  }

  // ─── Listar materias de un alumno ─────────────────────────────────────────
  // Combina las materias regulares del curso con las asignaciones individuales

  async findByStudent(
    studentId:     string,
    institutionId: string,
    query:         StudentSubjectQueryDto,
  ) {
    // Verificar que el alumno pertenece a la institución
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      include: {
        courseStudents: {
          where: { status: 'ACTIVE' },
          include: {
            course: {
              include: {
                courseSubjects: {
                  include: {
                    subject: { select: { id: true, name: true, code: true } },
                    teacher: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
                schoolYear: { select: { id: true, year: true } },
                levelGrade: {
                  select: { id: true, displayOrder: true, name: true },
                },
              },
            },
          },
        },
      },
    });
    if (!student) throw new NotFoundException('Alumno no encontrado');

    // Materias individuales (RECURSE / EXEMPT) del alumno
    const individualAssignments = await this.prisma.studentCourseSubject.findMany({
      where: {
        studentId,
        ...(query.schoolYearId && { schoolYearId: query.schoolYearId }),
        ...(query.type         && { type: query.type as any }),
      },
      include: this.assignmentIncludes(),
      orderBy: { createdAt: 'asc' },
    });

    // IDs de courseSubjects eximidas o recursadas para excluirlas de las regulares
    const exemptIds  = individualAssignments.filter(a => a.type === 'EXEMPT').map(a => a.courseSubjectId);
    const recurseIds = individualAssignments.filter(a => a.type === 'RECURSE').map(a => a.courseSubjectId);
    const overriddenIds = new Set([...exemptIds, ...recurseIds]);

    // Construir lista de materias regulares desde el curso activo
    // filtrando las eximidas
    const regularSubjects = student.courseStudents.flatMap(cs =>
      cs.course.courseSubjects
        .filter(csub => !overriddenIds.has(csub.id))
        .map(csub => ({
          id:             `regular-${csub.id}`,
          type:           'REGULAR' as const,
          courseSubjectId: csub.id,
          schoolYearId:   cs.course.schoolYear?.id,
          courseSubject: {
            ...csub,
            course: {
              id:       cs.course.id,
              name:     cs.course.name,
              grade:    cs.course.levelGrade?.displayOrder ?? cs.course.grade,
              division: cs.course.division,
            },
          },
          schoolYear: cs.course.schoolYear,
          createdBy:  null,
          createdAt:  null,
        })),
    );

    return {
      regular: query.type && query.type !== 'REGULAR' ? [] : regularSubjects,
      recurse: individualAssignments.filter(a => a.type === 'RECURSE'),
      exempt:  individualAssignments.filter(a => a.type === 'EXEMPT'),
    };
  }

  // ─── Asignar materia individual (RECURSE o EXEMPT) ────────────────────────

  async assign(
    studentId:     string,
    institutionId: string,
    dto:           AssignSubjectDto,
    user:          RequestUser,
  ) {
    // Verificar alumno
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Alumno no encontrado');

    // Verificar courseSubject pertenece a la institución
    const courseSubject = await this.prisma.courseSubject.findFirst({
      where: { id: dto.courseSubjectId, course: { institutionId } },
      include: { course: { select: { schoolYearId: true } } },
    });
    if (!courseSubject) throw new NotFoundException('Materia/curso no encontrado');

    // Verificar año lectivo
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: dto.schoolYearId, institutionId },
    });
    if (!schoolYear) throw new NotFoundException('Año lectivo no encontrado');

    // Verificar que no exista ya
    const existing = await this.prisma.studentCourseSubject.findUnique({
      where: {
        studentId_courseSubjectId_schoolYearId: {
          studentId,
          courseSubjectId: dto.courseSubjectId,
          schoolYearId:    dto.schoolYearId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('El alumno ya tiene esta materia asignada para este año');
    }

    return this.prisma.studentCourseSubject.create({
      data: {
        studentId,
        courseSubjectId: dto.courseSubjectId,
        schoolYearId:    dto.schoolYearId,
        type:            dto.type,
        createdById:     user.id,
      },
      include: this.assignmentIncludes(),
    });
  }

  // ─── Actualizar tipo (RECURSE ↔ EXEMPT) ───────────────────────────────────

  async update(
    id:  string,
    dto: UpdateSubjectAssignmentDto,
  ) {
    const assignment = await this.prisma.studentCourseSubject.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');

    return this.prisma.studentCourseSubject.update({
      where: { id },
      data:  { type: dto.type },
      include: this.assignmentIncludes(),
    });
  }

  // ─── Eliminar asignación ──────────────────────────────────────────────────

  async remove(id: string, institutionId: string) {
    const assignment = await this.prisma.studentCourseSubject.findFirst({
      where: { id, student: { institutionId } },
    });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');

    return this.prisma.studentCourseSubject.delete({ where: { id } });
  }

  // ─── Helper para grades y attendance ─────────────────────────────────────
  // Devuelve todos los courseSubjectIds activos de un alumno
  // (regulares del curso + recursados, excluyendo eximidos)

  async getActiveSubjectIds(
    studentId:     string,
    schoolYearId?: string,
  ): Promise<string[]> {
    // Materias del curso activo
    const courseStudents = await this.prisma.courseStudent.findMany({
      where: { studentId, status: 'ACTIVE' },
      include: {
        course: {
          include: {
            courseSubjects: { select: { id: true } },
          },
        },
      },
    });

    const regularIds = courseStudents.flatMap(cs =>
      cs.course.courseSubjects.map(csub => csub.id),
    );

    // Asignaciones individuales del año lectivo
    const individual = await this.prisma.studentCourseSubject.findMany({
      where: {
        studentId,
        ...(schoolYearId && { schoolYearId }),
      },
      select: { courseSubjectId: true, type: true },
    });

    const exemptIds  = new Set(individual.filter(a => a.type === 'EXEMPT').map(a => a.courseSubjectId));
    const recurseIds = individual.filter(a => a.type === 'RECURSE').map(a => a.courseSubjectId);

    // Regulares - eximidas + recursadas
    const activeIds = [
      ...regularIds.filter(id => !exemptIds.has(id)),
      ...recurseIds,
    ];

    return [...new Set(activeIds)];
  }
}