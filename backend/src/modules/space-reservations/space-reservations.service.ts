import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
  } from '@nestjs/common';
  import { ReservationStatus, Role } from '@prisma/client';
  import { PrismaService } from '../../prisma/prisma.service';
  import { NotificationQueueService } from '../notifications/notification-queue.service';
  import {
    CreateSpaceReservationDto,
    GetReservationsQueryDto,
    UpdateReservationStatusDto,
    UpdateSpaceReservationDto,
  } from './dto/space-reservation.dto';
  
  @Injectable()
  export class SpaceReservationsService {
    constructor(
      private readonly prisma: PrismaService,
      private readonly notificationQueue: NotificationQueueService,
    ) {}
  
    // ─── Helpers ──────────────────────────────────────────────────────────────
  
    private toUtcNoon(dateStr: string): Date {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
  
    private toMin(time: string): number {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    }
  
    private hasOverlap(sA: string, eA: string, sB: string, eB: string): boolean {
      return this.toMin(sA) < this.toMin(eB) && this.toMin(eA) > this.toMin(sB);
    }
  
    private async checkConflicts(
      spaceId: string,
      date: Date,
      startTime: string,
      endTime: string,
      excludeId?: string,
    ): Promise<void> {
      const existing = await this.prisma.spaceReservation.findMany({
        where: {
          spaceId,
          date,
          deletedAt: null,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, startTime: true, endTime: true, title: true },
      });
  
      for (const res of existing) {
        if (this.hasOverlap(startTime, endTime, res.startTime, res.endTime)) {
          throw new ConflictException(
            `El espacio ya está reservado de ${res.startTime} a ${res.endTime} ("${res.title}"). Por favor elegí otro horario.`,
          );
        }
      }
    }
  
    // ─── Queries ──────────────────────────────────────────────────────────────
  
    async findAll(institutionId: string, query: GetReservationsQueryDto) {
      const where: any = { institutionId, deletedAt: null };
  
      if (query.spaceId) where.spaceId = query.spaceId;
  
      if (query.month) {
        const [year, month] = query.month.split('-').map(Number);
        where.date = {
          gte: new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)),
          lte: new Date(Date.UTC(year, month, 0, 12, 0, 0)), // último día del mes
        };
      } else if (query.dateFrom || query.dateTo) {
        where.date = {};
        if (query.dateFrom) where.date.gte = this.toUtcNoon(query.dateFrom);
        if (query.dateTo) where.date.lte = this.toUtcNoon(query.dateTo);
      }
  
      return this.prisma.spaceReservation.findMany({
        where,
        include: {
          space: { select: { id: true, name: true, capacity: true } },
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });
    }
  
    async findOne(id: string, institutionId: string) {
      const reservation = await this.prisma.spaceReservation.findFirst({
        where: { id, institutionId, deletedAt: null },
        include: {
          space: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
      if (!reservation) throw new NotFoundException('Reserva no encontrada');
      return reservation;
    }
  
    // ─── Mutations ────────────────────────────────────────────────────────────
  
    async create(
      institutionId: string,
      userId: string,
      dto: CreateSpaceReservationDto,
    ) {
      const space = await this.prisma.space.findFirst({
        where: { id: dto.spaceId, institutionId, deletedAt: null },
      });
      if (!space) throw new NotFoundException('Espacio no encontrado');
      if (!space.isAvailable)
        throw new ForbiddenException('El espacio no está disponible para reservas');
  
      const date = this.toUtcNoon(dto.date);
  
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (date < today)
        throw new BadRequestException('No se puede reservar en una fecha pasada');
  
      await this.checkConflicts(dto.spaceId, date, dto.startTime, dto.endTime);
  
      const reservation = await this.prisma.spaceReservation.create({
        data: {
          institutionId,
          spaceId: dto.spaceId,
          userId,
          date,
          startTime: dto.startTime,
          endTime: dto.endTime,
          title: dto.title,
          description: dto.description,
          status: ReservationStatus.PENDING,
        },
        include: {
          space: { select: { id: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
  
      await this.notifyAdmins(institutionId, reservation);
  
      return reservation;
    }
  
    async update(
      id: string,
      institutionId: string,
      userId: string,
      userRole: Role,
      dto: UpdateSpaceReservationDto,
    ) {
      const reservation = await this.findOne(id, institutionId);
  
      const adminRoles: Role[] = [Role.ADMIN, Role.DIRECTOR, Role.SECRETARY];
      const isAdmin = adminRoles.includes(userRole);
      if (reservation.userId !== userId && !isAdmin)
        throw new ForbiddenException('Solo podés editar tus propias reservas');
  
      if (reservation.status === ReservationStatus.CANCELLED)
        throw new BadRequestException('No se puede editar una reserva cancelada');
  
      const startTime = dto.startTime ?? reservation.startTime;
      const endTime = dto.endTime ?? reservation.endTime;
      const date = dto.date ? this.toUtcNoon(dto.date) : reservation.date;
  
      await this.checkConflicts(reservation.spaceId, date, startTime, endTime, id);
  
      return this.prisma.spaceReservation.update({
        where: { id },
        data: { ...dto, date, startTime, endTime },
        include: {
          space: { select: { id: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    }
  
    async updateStatus(
      id: string,
      institutionId: string,
      dto: UpdateReservationStatusDto,
    ) {
      const reservation = await this.findOne(id, institutionId);
  
      if (reservation.status === ReservationStatus.CANCELLED)
        throw new BadRequestException('La reserva ya está cancelada');
  
      const updated = await this.prisma.spaceReservation.update({
        where: { id },
        data: { status: dto.status as ReservationStatus },
        include: {
          space: { select: { id: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
  
      const isConfirmed = dto.status === 'CONFIRMED';
      await this.notificationQueue.notify({
        userIds: [reservation.userId],
        type: 'SYSTEM',
        title: isConfirmed ? '✅ Reserva confirmada' : '❌ Reserva cancelada',
        body: isConfirmed
          ? `Tu reserva "${reservation.title}" en ${updated.space.name} fue confirmada.`
          : `Tu reserva "${reservation.title}" en ${updated.space.name} fue cancelada.`,
        data: { reservationId: id, spaceId: reservation.spaceId },
      });
  
      return updated;
    }
  
    async cancel(
      id: string,
      institutionId: string,
      userId: string,
      userRole: Role,
    ) {
      const reservation = await this.findOne(id, institutionId);
  
      const adminRoles: Role[] = [Role.ADMIN, Role.DIRECTOR, Role.SECRETARY];
      const isAdmin = adminRoles.includes(userRole);
      if (reservation.userId !== userId && !isAdmin)
        throw new ForbiddenException('Solo podés cancelar tus propias reservas');
  
      if (reservation.status === ReservationStatus.CANCELLED)
        throw new BadRequestException('La reserva ya está cancelada');
  
      return this.updateStatus(id, institutionId, { status: 'CANCELLED' });
    }
  
    async remove(id: string, institutionId: string) {
      await this.findOne(id, institutionId);
      return this.prisma.spaceReservation.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }
  
    // ─── Notificaciones ───────────────────────────────────────────────────────
  
    private async notifyAdmins(institutionId: string, reservation: any) {
      const admins = await this.prisma.user.findMany({
        where: {
          institutionId,
          deletedAt: null,
          role: { in: [Role.ADMIN, Role.DIRECTOR, Role.SECRETARY] },
        },
        select: { id: true },
      });
  
      const userName = `${reservation.user.firstName} ${reservation.user.lastName}`;
  
      for (const admin of admins) {
        await this.notificationQueue.notify({
          userIds: [admin.id],
          type: 'SYSTEM',
          title: '📅 Nueva reserva pendiente',
          body: `${userName} reservó "${reservation.space.name}" — ${reservation.startTime} a ${reservation.endTime} ("${reservation.title}")`,
          data: { reservationId: reservation.id, spaceId: reservation.spaceId },
        });
      }
    }
  }