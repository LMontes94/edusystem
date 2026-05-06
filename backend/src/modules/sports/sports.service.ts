import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSportDto, UpdateSportDto } from './dto/sport.dto';

@Injectable()
export class SportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(institutionId: string) {
    return this.prisma.sport.findMany({
      where: { institutionId, deletedAt: null },
      include: { _count: { select: { groups: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, institutionId: string) {
    const sport = await this.prisma.sport.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: { _count: { select: { groups: true } } },
    });
    if (!sport) throw new NotFoundException('Deporte no encontrado');
    return sport;
  }

  async create(institutionId: string, dto: CreateSportDto) {
    const existing = await this.prisma.sport.findFirst({
      where: { name: dto.name, institutionId, deletedAt: null },
    });
    if (existing) throw new ConflictException('Ya existe un deporte con ese nombre');

    return this.prisma.sport.create({
      data: { name: dto.name, institutionId },
    });
  }

  async update(id: string, institutionId: string, dto: UpdateSportDto) {
    await this.findOne(id, institutionId);
    return this.prisma.sport.update({ where: { id }, data: dto });
  }

  async remove(id: string, institutionId: string) {
    await this.findOne(id, institutionId);

    const activeGroups = await this.prisma.sportGroup.count({
      where: { sportId: id },
    });
    if (activeGroups > 0) {
      throw new ConflictException(
        'No se puede eliminar un deporte con grupos activos',
      );
    }

    return this.prisma.sport.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}