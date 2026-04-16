// src/modules/convivencias/convivencias.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { NotificationQueueService } from '../notifications/notification-queue.service';

const CONVIVENCIA_INCLUDE = {
  student: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
  course:  { select: { id: true, name: true, grade: true, division: true } },
  author:  { select: { id: true, firstName: true, lastName: true, role: true } },
};

function normalizeDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

@Injectable()
export class ConvivenciasService {
  constructor(private readonly prisma: PrismaService,
    private readonly notifQueue:  NotificationQueueService,
  ) {}

  // ── Listar por institución ────────────────────
  async findAll(institutionId: string, filters: {
    courseId?:  string;
    studentId?: string;
    type?:      string;
    dateFrom?:  string;
    dateTo?:    string;
  }) {
    const where: any = { institutionId, deletedAt: null };

    if (filters.courseId)  where.courseId  = filters.courseId;
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.type)      where.type      = filters.type;
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo)   where.date.lte = new Date(filters.dateTo);
    }

    return this.prisma.convivencia.findMany({
      where,
      include:  CONVIVENCIA_INCLUDE,
      orderBy:  { date: 'desc' },
    });
  }

  // ── Listar por alumno ─────────────────────────
  async findByStudent(studentId: string, institutionId: string) {
    return this.prisma.convivencia.findMany({
      where:   { studentId, institutionId, deletedAt: null },
      include: CONVIVENCIA_INCLUDE,
      orderBy: { date: 'desc' },
    });
  }

  // ── Crear ─────────────────────────────────────
  async create(data: {
    studentId: string;
    courseId:  string;
    type:      string;
    date:      string;
    reason:    string;
  }, user: RequestUser) {
    return this.prisma.convivencia.create({
      data: {
        institutionId: user.institutionId,
        studentId:     data.studentId,
        courseId:      data.courseId,
        authorId:      user.id,
        type:          data.type,
        date:          normalizeDate(data.date),
        reason:        data.reason,
        savedAt:       new Date(),
      },
      include: CONVIVENCIA_INCLUDE,
    });
  }

  // ── Actualizar ────────────────────────────────
  async update(id: string, data: {
    type?:   string;
    date?:   string;
    reason?: string;
  }, user: RequestUser) {
    const conv = await this.prisma.convivencia.findFirst({
      where: { id, institutionId: user.institutionId, deletedAt: null },
    });
    if (!conv) throw new NotFoundException('Convivencia no encontrada');
    return this.prisma.convivencia.update({
      where: { id },
      data: {
        type:   data.type,
        reason: data.reason,
        date:   data.date ? normalizeDate(data.date) : undefined,
      },
      include: CONVIVENCIA_INCLUDE,
    });
  }

  // ── Eliminar (soft delete) ────────────────────
  async remove(id: string, user: RequestUser) {
    const conv = await this.prisma.convivencia.findFirst({
      where: { id, institutionId: user.institutionId, deletedAt: null },
    });
    if (!conv) throw new NotFoundException('Convivencia no encontrada');

    await this.prisma.convivencia.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
  }

  // ── Estadísticas por curso ────────────────────
  async getStats(institutionId: string, courseId?: string) {
    const where: any = { institutionId, deletedAt: null };
    if (courseId) where.courseId = courseId;

    const [total, byType, byCourse] = await Promise.all([
      this.prisma.convivencia.count({ where }),

      this.prisma.convivencia.groupBy({
        by:    ['type'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      this.prisma.convivencia.groupBy({
        by:    ['courseId'],
        where: { institutionId, deletedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    return { total, byType, byCourse };
  }

  private async sendConvivenciaNotification(convivencia: {
    id:            string;
    studentId:     string;
    courseId:      string;
    institutionId: string;
    type:          string;
    reason:        string;
  }) {
    const [student, course] = await Promise.all([
      this.prisma.student.findUnique({
        where:  { id: convivencia.studentId },
        select: { firstName: true, lastName: true },
      }),
      this.prisma.course.findUnique({
        where:  { id: convivencia.courseId },
        select: { name: true },
      }),
    ]);
   
    if (!student || !course) return;
   
    const studentName = `${student.firstName} ${student.lastName}`;
   
    const typeLabels: Record<string, { emoji: string; label: string }> = {
      suspension:     { emoji: '🚫', label: 'Suspensión'        },
      parent_meeting: { emoji: '📋', label: 'Citación de padres' },
    };
   
    const { emoji, label } = typeLabels[convivencia.type] ?? { emoji: '📢', label: convivencia.type };
   
    const title = `${emoji} ${label} — ${studentName}`;
    const body  = `${course.name}: ${convivencia.reason}`;
   
    const userIds = await this.notifQueue.getRecipientsForStudent({
      studentId:     convivencia.studentId,
      courseId:      convivencia.courseId,
      institutionId: convivencia.institutionId,
    });
   
    await this.notifQueue.notify({
      userIds,
      type:  'SYSTEM',
      title,
      body,
      data: {
        type:           'convivencia',
        convivenciaId:  convivencia.id,
        convivenciaType: convivencia.type,
        studentId:      convivencia.studentId,
      },
    });
  }
}