import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';
import { QUEUES, JOBS, JOB_OPTIONS } from '../../queues/queue.constants';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.NOTIFICATIONS)
    private readonly notificationQueue: Queue,
  ) {}

  async findAll(institutionId: string, user: RequestUser) {
    const where: any = { institutionId, deletedAt: null };

    // TEACHER: solo ve comunicados de sus cursos e institución
    if (user.role === 'TEACHER') {
      where.OR = [
        { scope: 'INSTITUTION' },
        {
          scope: 'COURSE',
          course: { courseSubjects: { some: { teacherId: user.id } } },
        },
      ];
    }

    // GUARDIAN: solo ve comunicados de los cursos de sus hijos
    if (user.role === 'GUARDIAN') {
      const childrenCourseIds = await this.getGuardianCourseIds(user.id, institutionId);
      where.OR = [
        { scope: 'INSTITUTION' },
        { scope: 'COURSE', courseId: { in: childrenCourseIds } },
      ];
    }

    return this.prisma.announcement.findMany({
      where,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        course: { select: { id: true, name: true, grade: true, division: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, institutionId: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        course: { select: { id: true, name: true, grade: true, division: true } },
      },
    });
    if (!announcement) throw new NotFoundException('Comunicado no encontrado');
    return announcement;
  }

  async create(dto: CreateAnnouncementDto, user: RequestUser, institutionId: string) {
    // TEACHER: solo puede crear comunicados de curso (no institucionales)
    if (user.role === 'TEACHER' && dto.scope === 'INSTITUTION') {
      throw new ForbiddenException('Los docentes solo pueden crear comunicados de curso');
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        institutionId,
        authorId:    user.id,
        courseId:    dto.courseId,
        title:       dto.title,
        content:     dto.content,
        scope:       dto.scope,
        attachments: dto.attachments ?? [],
      } as any,
    });

    return announcement;
  }

  async publish(id: string, user: RequestUser, institutionId: string) {
    const announcement = await this.findOne(id, institutionId);

    if (announcement.publishedAt) {
      throw new ForbiddenException('El comunicado ya fue publicado');
    }

    // Solo el autor o un ADMIN puede publicar
    if (user.role === 'TEACHER' && announcement.authorId !== user.id) {
      throw new ForbiddenException();
    }

    const published = await this.prisma.announcement.update({
      where: { id },
      data:  { publishedAt: new Date() },
    });

    // Emitir job para notificar — event-driven ⚡
    await this.notificationQueue.add(
      JOBS.ANNOUNCEMENT_PUBLISHED,
      { announcementId: id, institutionId },
      JOB_OPTIONS.DEFAULT,
    );

    return published;
  }

  async update(id: string, dto: UpdateAnnouncementDto, user: RequestUser, institutionId: string) {
    const announcement = await this.findOne(id, institutionId);

    if (user.role === 'TEACHER' && announcement.authorId !== user.id) {
      throw new ForbiddenException();
    }

    return this.prisma.announcement.update({
      where: { id },
      data:  dto as any,
    });
  }

  async remove(id: string, user: RequestUser, institutionId: string) {
    const announcement = await this.findOne(id, institutionId);

    if (user.role === 'TEACHER' && announcement.authorId !== user.id) {
      throw new ForbiddenException();
    }

    await this.prisma.announcement.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
  }

  private async getGuardianCourseIds(userId: string, institutionId: string): Promise<string[]> {
    const enrollments = await this.prisma.courseStudent.findMany({
      where: {
        status: 'ACTIVE',
        student: { institutionId, guardians: { some: { userId } } },
      },
      select: { courseId: true },
    });
    return enrollments.map((e) => e.courseId);
  }
}
