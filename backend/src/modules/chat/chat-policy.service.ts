import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface UpdateChatPolicyDto {
  guardiansCanMessageTeachers?: boolean;
  guardiansCanMessageDirectors?: boolean;
  guardiansCanMessageSecretariat?: boolean;
  guardiansCanMessageAdmin?: boolean;
  teachersCanMessageGuardians?: boolean;
  teachersCanMessageOtherTeachers?: boolean;
  teachersCanMessageStudents?: boolean;
  studentsCanMessageTeachers?: boolean;
  studentsCanMessageOtherStudents?: boolean;
  studentsCanCreateRooms?: boolean;
  requireModerationForNewRooms?: boolean;
  allowAnonymousReporting?: boolean;
}

@Injectable()
export class ChatPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicy(institutionId: string) {
    return this.prisma.institutionChatPolicy.upsert({
      where: { institutionId },
      create: { institutionId },
      update: {},
    });
  }

  async updatePolicy(institutionId: string, dto: UpdateChatPolicyDto) {
    try {
      return await this.prisma.institutionChatPolicy.update({
        where: { institutionId },
        data: dto,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Política de chat no encontrada');
      }
      throw err;
    }
  }
}