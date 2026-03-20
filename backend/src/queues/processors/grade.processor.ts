import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS } from '../queue.constants';

interface RecalculateAveragePayload {
  studentId: string;
  periodId:  string;
}

// ──────────────────────────────────────────────
// GradeProcessor — recalcula promedios en background
// cuando se carga o modifica una nota.
// ──────────────────────────────────────────────

@Processor(QUEUES.GRADES)
export class GradeProcessor {
  private readonly logger = new Logger(GradeProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process(JOBS.RECALCULATE_AVERAGE)
  async handleRecalculateAverage(job: Job<RecalculateAveragePayload>) {
    const { studentId, periodId } = job.data;

    try {
      const grades = await this.prisma.grade.findMany({
        where: { studentId, periodId },
        select: { score: true, courseSubject: { select: { subjectId: true } } },
      });

      if (grades.length === 0) return;

      const sum = grades.reduce((acc, g) => acc + Number(g.score), 0);
      const average = Math.round((sum / grades.length) * 100) / 100;

      this.logger.log(
        `Promedio recalculado — estudiante ${studentId}, período ${periodId}: ${average} (${grades.length} notas)`,
      );

      // TODO: guardar el promedio en una tabla GradeAverage si se necesita
      // cache para el frontend sin recalcular en cada request

    } catch (err) {
      this.logger.error(`Error recalculando promedio: ${studentId}/${periodId}`, err);
      throw err;
    }
  }
}
