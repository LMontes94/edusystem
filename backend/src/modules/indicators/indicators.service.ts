// src/modules/indicators/indicators.service.ts
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IndicatorsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listar indicadores por materia y año ──────
  async findAll(subjectId: string, schoolYearId: string) {
    return this.prisma.indicator.findMany({
      where:   { subjectId, schoolYearId },
      orderBy: { order: 'asc' },
    });
  }

  // ── Crear indicador ───────────────────────────
  async create(data: {
    subjectId:    string;
    schoolYearId: string;
    description:  string;
    order?:       number;
  }) {
    // Calcular orden automático si no se especifica
    if (!data.order) {
      const last = await this.prisma.indicator.findFirst({
        where:   { subjectId: data.subjectId, schoolYearId: data.schoolYearId },
        orderBy: { order: 'desc' },
      });
      data.order = (last?.order ?? 0) + 1;
    }

    return this.prisma.indicator.create({ data: data as any });
  }

  // ── Actualizar indicador ──────────────────────
  async update(id: string, description: string) {
    return this.prisma.indicator.update({
      where: { id },
      data:  { description },
    });
  }

  // ── Reordenar indicadores ─────────────────────
  async reorder(ids: string[]) {
    await Promise.all(
      ids.map((id, index) =>
        this.prisma.indicator.update({
          where: { id },
          data:  { order: index + 1 },
        })
      )
    );
    return { message: 'Indicadores reordenados' };
  }

  // ── Eliminar indicador ────────────────────────
  async remove(id: string) {
    await this.prisma.indicator.delete({ where: { id } });
  }

  // ── Guardar evaluación de un alumno ───────────
  async upsertEvaluation(data: {
    indicatorId: string;
    studentId:   string;
    periodId:    string;
    value:       string;
  }) {
    return this.prisma.indicatorEvaluation.upsert({
      where: {
        indicatorId_studentId_periodId: {
          indicatorId: data.indicatorId,
          studentId:   data.studentId,
          periodId:    data.periodId,
        },
      },
      create: data as any,
      update: { value: data.value },
    });
  }

  // ── Guardar evaluaciones masivas ──────────────
  async bulkUpsertEvaluations(evaluations: {
    indicatorId: string;
    studentId:   string;
    periodId:    string;
    value:       string;
  }[]) {
    await Promise.all(evaluations.map((e) => this.upsertEvaluation(e)));
    return { message: 'Evaluaciones guardadas', total: evaluations.length };
  }

  // ── Obtener evaluaciones de un alumno ─────────
  async getStudentEvaluations(studentId: string, schoolYearId: string) {
    return this.prisma.indicatorEvaluation.findMany({
      where: {
        studentId,
        indicator: { schoolYearId },
      },
      include: {
        indicator: {
          include: { subject: { select: { id: true, name: true } } },
        },
        period: { select: { id: true, name: true, order: true } },
      },
    });
  }

  // ── Obtener evaluaciones de un curso ──────────
  // Para que el docente complete las evaluaciones de todo el curso
  async getCourseEvaluations(
    courseId:    string,
    subjectId:   string,
    schoolYearId: string,
    periodId:    string,
  ) {
    // Obtener indicadores de la materia
    const indicators = await this.prisma.indicator.findMany({
      where:   { subjectId, schoolYearId },
      orderBy: { order: 'asc' },
    });

    // Obtener alumnos del curso
    const enrollments = await this.prisma.courseStudent.findMany({
      where:   { courseId, status: 'ACTIVE' },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { student: { lastName: 'asc' } },
    });

    // Obtener evaluaciones existentes
    const evaluations = await this.prisma.indicatorEvaluation.findMany({
      where: {
        periodId,
        indicatorId: { in: indicators.map((i) => i.id) },
        studentId:   { in: enrollments.map((e) => e.studentId) },
      },
    });

    // Armar mapa indicadorId+studentId → value
    const evalMap = new Map(
      evaluations.map((e) => [`${e.indicatorId}-${e.studentId}`, e.value])
    );

    return {
      indicators,
      students: enrollments.map((e) => e.student),
      evaluations: evalMap,
      // Formato para fácil renderizado en frontend
      grid: indicators.map((indicator) => ({
        indicator,
        valuesByStudent: Object.fromEntries(
          enrollments.map((e) => [
            e.studentId,
            evalMap.get(`${indicator.id}-${e.studentId}`) ?? null,
          ])
        ),
      })),
    };
  }
}