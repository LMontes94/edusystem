import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from '../../modules/notifications/fcm.service';
import { QUEUES, JOBS } from '../queue.constants';

// ──────────────────────────────────────────────
// NotificationProcessor — procesa jobs de notificación
// en background. Corre en el contenedor worker.
//
// Flujo:
//   1. API emite job con los datos mínimos (IDs)
//   2. Worker carga los datos completos desde DB
//   3. Envía push via FCM y guarda in-app notification
// ──────────────────────────────────────────────

interface GradeCreatedPayload {
  gradeId:     string;
  studentId:   string;
  institutionId: string;
}

interface AttendanceRecordedPayload {
  studentId:    string;
  courseId:     string;
  date:         string;
  status:       string;
  institutionId: string;
}

interface AnnouncementPublishedPayload {
  announcementId: string;
  institutionId:  string;
}

@Processor(QUEUES.NOTIFICATIONS)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  // ── Nota creada → notificar al padre ─────────
  @Process(JOBS.GRADE_CREATED)
  async handleGradeCreated(job: Job<GradeCreatedPayload>) {
    const { gradeId, studentId } = job.data;
    this.logger.log(`Procesando notificación de nota: ${gradeId}`);

    try {
      // Cargar datos completos
      const grade = await this.prisma.grade.findUnique({
        where: { id: gradeId },
        include: {
          student: { select: { firstName: true, lastName: true } },
          courseSubject: { include: { subject: { select: { name: true } } } },
          period: { select: { name: true } },
        },
      });

      if (!grade) return;

      // Buscar guardianes del alumno
      const guardians = await this.prisma.guardian.findMany({
        where: { studentId },
        include: {
          user: {
            include: {
              pushTokens: { where: { isActive: true } },
            },
          },
        },
      });

      const title = `Nueva nota — ${grade.courseSubject.subject.name}`;
      const body  = `${grade.student.firstName} obtuvo ${grade.score} en ${grade.period.name}`;

      // Enviar push + guardar notificación in-app para cada tutor
      await Promise.all(
        guardians.map(async (guardian) => {
          // Guardar notificación in-app
          await this.prisma.notification.create({
            data: {
              userId:        guardian.userId,
              institutionId: job.data.institutionId,
              type:          'GRADE',
              title,
              body,
              data:          { gradeId, studentId },
            } as any,
          });

          // Enviar push si tiene tokens activos
          const tokens = guardian.user.pushTokens.map((t) => t.token);
          if (tokens.length > 0) {
            await this.fcm.sendToTokens(tokens, { title, body, data: { gradeId } });
          }
        }),
      );

      this.logger.log(`Notificaciones enviadas para nota ${gradeId} — ${guardians.length} tutores`);
    } catch (err) {
      this.logger.error(`Error procesando grade.created: ${gradeId}`, err);
      throw err; // re-throw para que BullMQ reintente
    }
  }

  // ── Ausencia registrada → notificar al padre ──
  @Process(JOBS.ATTENDANCE_RECORDED)
  async handleAttendanceRecorded(job: Job<AttendanceRecordedPayload>) {
    const { studentId, status, date } = job.data;

    // Solo notificar ausencias
    if (status !== 'ABSENT') return;

    this.logger.log(`Procesando notificación de ausencia: ${studentId} - ${date}`);

    try {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { firstName: true, lastName: true },
      });

      if (!student) return;

      const guardians = await this.prisma.guardian.findMany({
        where: { studentId },
        include: {
          user: { include: { pushTokens: { where: { isActive: true } } } },
        },
      });

      const title = 'Ausencia registrada';
      const body  = `${student.firstName} ${student.lastName} estuvo ausente el ${new Date(date).toLocaleDateString('es-AR')}`;

      await Promise.all(
        guardians.map(async (guardian) => {
          await this.prisma.notification.create({
            data: {
              userId:        guardian.userId,
              institutionId: job.data.institutionId,
              type:          'ATTENDANCE',
              title,
              body,
              data:          { studentId, date, status },
            } as any,
          });

          const tokens = guardian.user.pushTokens.map((t) => t.token);
          if (tokens.length > 0) {
            await this.fcm.sendToTokens(tokens, { title, body });
          }
        }),
      );
    } catch (err) {
      this.logger.error(`Error procesando attendance.recorded`, err);
      throw err;
    }
  }

  // ── Comunicado publicado → notificar al curso ─
  @Process(JOBS.ANNOUNCEMENT_PUBLISHED)
  async handleAnnouncementPublished(job: Job<AnnouncementPublishedPayload>) {
    const { announcementId, institutionId } = job.data;
    this.logger.log(`Procesando notificación de comunicado: ${announcementId}`);

    try {
      const announcement = await this.prisma.announcement.findUnique({
        where: { id: announcementId },
        include: {
          course: {
            include: {
              courseStudents: {
                where: { status: 'ACTIVE' },
                include: {
                  student: {
                    include: {
                      guardians: {
                        include: {
                          user: { include: { pushTokens: { where: { isActive: true } } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!announcement) return;

      // Recopilar todos los tutores únicos del curso
      const guardiansMap = new Map<string, any>();
      announcement.course?.courseStudents.forEach((cs) => {
        cs.student.guardians.forEach((g) => {
          guardiansMap.set(g.userId, g);
        });
      });

      const title = `Nuevo comunicado`;
      const body  = announcement.title;

      await Promise.all(
        Array.from(guardiansMap.values()).map(async (guardian) => {
          await this.prisma.notification.create({
            data: {
              userId:        guardian.userId,
              institutionId,
              type:          'ANNOUNCEMENT',
              title,
              body,
              data:          { announcementId },
            } as any,
          });

          const tokens = guardian.user.pushTokens.map((t: any) => t.token);
          if (tokens.length > 0) {
            await this.fcm.sendToTokens(tokens, { title, body });
          }
        }),
      );

      this.logger.log(`Comunicado ${announcementId} notificado a ${guardiansMap.size} tutores`);
    } catch (err) {
      this.logger.error(`Error procesando announcement.published`, err);
      throw err;
    }
  }
}
