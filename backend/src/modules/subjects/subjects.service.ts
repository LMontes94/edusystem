import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubjectDto, UpdateSubjectDto } from '../courses/dto/course.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(institutionId: string) {
    return this.prisma.subject.findMany({
      where: { institutionId },
      include: { _count: { select: { courseSubjects: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, institutionId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, institutionId },
      include: {
        courseSubjects: {
          include: {
            course: { select: { id: true, name: true, grade: true, division: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!subject) throw new NotFoundException('Materia no encontrada');
    return subject;
  }

  async create(dto: CreateSubjectDto, institutionId: string) {
    const existing = await this.prisma.subject.findFirst({
      where: { code: dto.code, institutionId },
    });
    if (existing) throw new ConflictException(`El código ${dto.code} ya existe en esta institución`);

    return this.prisma.subject.create({ 
      data: {
        name: dto.name!,
        code: dto.code!,
        description: dto.description,
        color: dto.color,
        institutionId,
      } as any,
    });
  }

  async update(id: string, dto: UpdateSubjectDto, institutionId: string) {
    await this.findOne(id, institutionId);
    return this.prisma.subject.update({ where: { id }, data: dto });
  }

  async remove(id: string, institutionId: string) {
    await this.findOne(id, institutionId);
    await this.prisma.subject.delete({ where: { id } });
  }
}
