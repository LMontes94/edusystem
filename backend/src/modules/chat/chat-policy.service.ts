import { Injectable, NotFoundException } from '@nestjs/common';
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
    let policy = await this.prisma.institutionChatPolicy.findUnique({
      where: { institutionId },
    });

    if (!policy) {
      policy = await this.prisma.institutionChatPolicy.create({
        data: { institutionId },
      });
    }

    return policy;
  }

  async updatePolicy(institutionId: string, dto: UpdateChatPolicyDto) {
    const policy = await this.prisma.institutionChatPolicy.findUnique({
      where: { institutionId },
    });

    if (!policy) {
      throw new NotFoundException('Política de chat no encontrada');
    }

    return this.prisma.institutionChatPolicy.update({
      where: { institutionId },
      data: dto,
    });
  }
}