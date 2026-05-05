import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSpaceDto, UpdateSpaceDto } from './dto/space.dto';

@Injectable()
export class SpacesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(institutionId: string) {
    return this.prisma.space.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, institutionId: string) {
    const space = await this.prisma.space.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
    if (!space) throw new NotFoundException('Espacio no encontrado');
    return space;
  }

  async create(institutionId: string, dto: CreateSpaceDto) {
    const existing = await this.prisma.space.findFirst({
      where: { name: dto.name, institutionId, deletedAt: null },
    });
    if (existing) throw new ConflictException('Ya existe un espacio con ese nombre');

    return this.prisma.space.create({
      data: {
        institutionId,
        name: dto.name,
        description: dto.description,
        capacity: dto.capacity,
        color: dto.color ?? '#6366f1',
        isAvailable: dto.isAvailable ?? true,
      },
    });
  }

  async update(id: string, institutionId: string, dto: UpdateSpaceDto) {
    await this.findOne(id, institutionId);
    return this.prisma.space.update({ where: { id }, data: dto });
  }

  async remove(id: string, institutionId: string) {
    await this.findOne(id, institutionId);

    const activeReservations = await this.prisma.spaceReservation.count({
      where: {
        spaceId: id,
        deletedAt: null,
        status: { in: ['PENDING', 'CONFIRMED'] },
        date: { gte: new Date() },
      },
    });

    if (activeReservations > 0) {
      throw new ForbiddenException(
        'No se puede eliminar un espacio con reservas activas',
      );
    }

    return this.prisma.space.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async toggleAvailability(id: string, institutionId: string) {
    const space = await this.findOne(id, institutionId);
    return this.prisma.space.update({
      where: { id },
      data: { isAvailable: !space.isAvailable },
    });
  }
}