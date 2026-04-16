// src/modules/notifications/notification-queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService, PushPayload } from './fcm.service';
import { NotificationType } from '@prisma/client';

export interface NotifyParams {
  userIds:       string[];          // destinatarios
  type:          NotificationType;
  title:         string;
  body:          string;
  data?:         Record<string, string>;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm:    FcmService,
  ) {}

  // ── Método principal: persiste + envía push ───
  async notify(params: NotifyParams): Promise<void> {
    if (params.userIds.length === 0) return;

    const { userIds, type, title, body, data } = params;

    // 1. Persistir en DB para todos los destinatarios
    try {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({ userId, type, title, body, data })),
        skipDuplicates: true,
      });
    } catch (err) {
      this.logger.error('Error persistiendo notificaciones', err);
    }

    // 2. Obtener push tokens activos de los destinatarios
    try {
      const pushTokens = await this.prisma.pushToken.findMany({
        where: { userId: { in: userIds }, isActive: true },
        select: { token: true },
      });

      const tokens = pushTokens.map((pt) => pt.token);
      if (tokens.length > 0) {
        const payload: PushPayload = { title, body, data };
        await this.fcm.sendToTokens(tokens, payload);
      }
    } catch (err) {
      this.logger.error('Error enviando push notifications', err);
    }
  }

  // ── Helpers para resolver destinatarios ───────

  /** Directivos (DIRECTOR + ADMIN) de una institución */
  async getDirectivosIds(institutionId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        institutionId,
        role:      { in: ['DIRECTOR', 'ADMIN'] },
        status:    'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /** Preceptor(es) asignados a un curso */
  async getPreceptoresIdsByCourse(courseId: string): Promise<string[]> {
    // Los preceptores están relacionados a través de CourseSubject como teachers
    // o directamente como usuarios con rol PRECEPTOR en la institución del curso.
    // Buscamos usuarios PRECEPTOR de la institución del curso.
    const course = await this.prisma.course.findUnique({
      where:  { id: courseId },
      select: { institutionId: true },
    });
    if (!course) return [];

    const users = await this.prisma.user.findMany({
      where: {
        institutionId: course.institutionId,
        role:          'PRECEPTOR',
        status:        'ACTIVE',
        deletedAt:     null,
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /** Tutores/padres (GUARDIAN) vinculados a un alumno */
  async getGuardiansIds(studentId: string): Promise<string[]> {
    const guardians = await this.prisma.guardian.findMany({
      where:  { studentId },
      select: { userId: true },
    });
    return guardians.map((g) => g.userId);
  }

  /** Todos los destinatarios para un evento de alumno en un curso */
  async getRecipientsForStudent(params: {
    studentId:     string;
    courseId:      string;
    institutionId: string;
  }): Promise<string[]> {
    const [directivos, preceptores, guardians] = await Promise.all([
      this.getDirectivosIds(params.institutionId),
      this.getPreceptoresIdsByCourse(params.courseId),
      this.getGuardiansIds(params.studentId),
    ]);

    // Deduplicar
    return [...new Set([...directivos, ...preceptores, ...guardians])];
  }
}