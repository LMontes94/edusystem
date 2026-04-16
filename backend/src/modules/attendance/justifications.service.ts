// src/modules/attendance/justifications.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService }              from '../../prisma/prisma.service';
import { RequestUser }                from '../../common/decorators/current-user.decorator';
import { NotificationQueueService }   from '../notifications/notification-queue.service';

@Injectable()
export class JustificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifQueue: NotificationQueueService,
  ) {}

  // ── Justificar una inasistencia ───────────────
  async justify(data: {
    attendanceId: string;
    reason:       string;
    fileUrl?:     string;
    source?:      string;
  }, user: RequestUser) {
    const attendance = await this.prisma.attendance.findFirst({
      where: { id: data.attendanceId, course: { institutionId: user.institutionId } },
    });
    if (!attendance) throw new NotFoundException('Registro de asistencia no encontrado');
    if (attendance.status !== 'ABSENT') {
      throw new BadRequestException('Solo se pueden justificar inasistencias');
    }

    const existing = await this.prisma.justification.findFirst({
      where: { attendanceId: data.attendanceId },
    });
    if (existing) throw new BadRequestException('Esta inasistencia ya tiene justificación');

    const [justification] = await this.prisma.$transaction([
      this.prisma.justification.create({
        data: {
          attendanceId:  data.attendanceId,
          studentId:     attendance.studentId,
          institutionId: user.institutionId,
          reason:        data.reason,
          fileUrl:       data.fileUrl,
          source:        data.source ?? 'manual',
          status:        'approved',
          reviewedBy:    user.id,
          reviewedAt:    new Date(),
        },
      }),
      this.prisma.attendance.update({
        where: { id: data.attendanceId },
        data:  { status: 'JUSTIFIED' },
      }),
    ]);

    return justification;
  }

  // ── Listar justificaciones de un alumno ───────
  async findByStudent(studentId: string, institutionId: string) {
    return this.prisma.justification.findMany({
      where: { studentId, institutionId },
      include: {
        attendance: {
          select: { date: true, course: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Eliminar justificación (revierte a ABSENT) ─
  async remove(id: string, user: RequestUser) {
    const just = await this.prisma.justification.findFirst({
      where: { id, institutionId: user.institutionId },
    });
    if (!just) throw new NotFoundException('Justificación no encontrada');

    await this.prisma.$transaction([
      this.prisma.justification.delete({ where: { id } }),
      this.prisma.attendance.update({
        where: { id: just.attendanceId },
        data:  { status: 'ABSENT' },
      }),
    ]);
  }

  // ── ACTAS DE INASISTENCIA ─────────────────────

  private async getThresholds(institutionId: string): Promise<number[]> {
    const institution = await this.prisma.institution.findUnique({
      where:  { id: institutionId },
      select: { settings: true },
    });
    const settings = (institution?.settings as any) ?? {};
    return settings.absenceThresholds ?? [10, 20, 30];
  }

  async checkAndGenerateRecord(
    studentId:     string,
    courseId:      string,
    institutionId: string,
  ) {
    const thresholds = await this.getThresholds(institutionId);

    const absenceCount = await this.prisma.attendance.count({
      where: { studentId, courseId, status: 'ABSENT' },
    });

    for (const threshold of thresholds.sort((a, b) => a - b)) {
      if (absenceCount >= threshold) {
        const existing = await this.prisma.absenceRecord.findFirst({
          where: { studentId, courseId, threshold },
        });

        if (!existing) {
          // Crear el acta
          const record = await this.prisma.absenceRecord.create({
            data: { studentId, courseId, institutionId, absenceCount, threshold },
          });

          // Disparar notificación de forma no bloqueante
          this.sendAbsenceRecordNotification({
            studentId,
            courseId,
            institutionId,
            absenceCount,
            threshold,
          }).catch(() => {}); // no bloquea si falla
        }
      }
    }
  }

  private async sendAbsenceRecordNotification(params: {
    studentId:     string;
    courseId:      string;
    institutionId: string;
    absenceCount:  number;
    threshold:     number;
  }) {
    const { studentId, courseId, institutionId, absenceCount, threshold } = params;

    // Obtener nombre del alumno y curso
    const [student, course] = await Promise.all([
      this.prisma.student.findUnique({
        where:  { id: studentId },
        select: { firstName: true, lastName: true },
      }),
      this.prisma.course.findUnique({
        where:  { id: courseId },
        select: { name: true },
      }),
    ]);

    if (!student || !course) return;

    const studentName = `${student.firstName} ${student.lastName}`;
    const title       = '⚠️ Acta de inasistencia generada';
    const body        = `${studentName} alcanzó ${absenceCount} inasistencias en ${course.name} (umbral: ${threshold})`;

    const userIds = await this.notifQueue.getRecipientsForStudent({
      studentId,
      courseId,
      institutionId,
    });

    await this.notifQueue.notify({
      userIds,
      type:  'ATTENDANCE',
      title,
      body,
      data: {
        type:      'absence_record',
        studentId,
        courseId,
        threshold: String(threshold),
      },
    });
  }

  // ── Listar actas ──────────────────────────────
  async findRecords(institutionId: string, filters: {
    courseId?:  string;
    studentId?: string;
  }) {
    const where: any = { institutionId };
    if (filters.courseId)  where.courseId  = filters.courseId;
    if (filters.studentId) where.studentId = filters.studentId;

    return this.prisma.absenceRecord.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        course:  { select: { id: true, name: true, grade: true, division: true } },
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  // ── Actualizar umbrales ───────────────────────
  async updateThresholds(institutionId: string, thresholds: number[]) {
    const institution = await this.prisma.institution.findUnique({
      where:  { id: institutionId },
      select: { settings: true },
    });
    const currentSettings = (institution?.settings as any) ?? {};

    await this.prisma.institution.update({
      where: { id: institutionId },
      data: {
        settings: { ...currentSettings, absenceThresholds: thresholds },
      },
    });

    return { message: 'Umbrales actualizados', thresholds };
  }
}