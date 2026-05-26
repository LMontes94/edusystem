import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LinkStudentDto } from './dto/link-student.dto';
import { RequestUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  async findLinkedStudents(userId: string, institutionId: string) {
    return this.prisma.guardian.findMany({
      where: { userId },
      include: {
        student: {
          include: {
            courseStudents: {
              where: { status: 'ACTIVE' },
              include: {
                course: {
                  select: { id: true, name: true, grade: true, division: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async linkStudent(
    userId: string,
    dto: LinkStudentDto,
    institutionId: string,
    currentUser: RequestUser,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado en esta institución');
    if (user.role !== 'GUARDIAN') {
      throw new ForbiddenException('El usuario no tiene rol de tutor');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, institutionId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Alumno no encontrado en esta institución');

    const existing = await this.prisma.guardian.findFirst({
      where: { userId, studentId: dto.studentId },
    });
    if (existing) throw new ConflictException('El tutor ya está vinculado a este alumno');

    return this.prisma.guardian.create({
      data: {
        userId,
        studentId: dto.studentId,
        relationship: dto.relationship,
      },
    });
  }

  async unlinkStudent(
    userId: string,
    studentId: string,
    institutionId: string,
    _currentUser: RequestUser,
  ) {
    const link = await this.prisma.guardian.findFirst({
      where: { userId, studentId },
      include: {
        user: { select: { institutionId: true } },
        student: { select: { institutionId: true } },
      },
    });
    if (!link) throw new NotFoundException('Relación no encontrada');
    if (link.user.institutionId !== institutionId || link.student.institutionId !== institutionId) {
      throw new ForbiddenException('La relación no pertenece a esta institución');
    }

    await this.prisma.guardian.delete({
      where: { userId_studentId: { userId, studentId } },
    });
  }
}
