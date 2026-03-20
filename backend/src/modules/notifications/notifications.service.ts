import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listar notificaciones del usuario ────────
  async findAll(user: RequestUser) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
  }

  // ── Marcar como leída ────────────────────────
  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  // ── Marcar todas como leídas ─────────────────
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true },
    });
    return { message: 'Todas las notificaciones marcadas como leídas' };
  }

  // ── Contador de no leídas ────────────────────
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  // ── Registrar push token ─────────────────────
  async registerPushToken(userId: string, token: string, platform: 'IOS' | 'ANDROID' | 'WEB') {
    return this.prisma.pushToken.upsert({
      where: { token } as any,
      create: { userId, token, platform, isActive: true },
      update: { isActive: true, userId },
    });
  }
}
