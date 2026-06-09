import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AcademicStructureValidationResult,
  buildAcademicValidationResult,
} from './academic-structure.validation';

@Injectable()
export class AcademicStructureValidator {
  constructor(private readonly prisma: PrismaService) {}

  async validateInstitution(
    institutionId: string,
  ): Promise<AcademicStructureValidationResult> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        id: true,
        name: true,
        _count: { select: { educationLevels: true } },
      },
    });

    if (!institution) {
      return {
        institutionId,
        institutionName: 'Unknown',
        educationLevels: 0,
        levelGrades: 0,
        expectedEducationLevels: 3,
        expectedLevelGrades: 14,
        status: 'INVALID',
        issues: ['Institution not found'],
      };
    }

    const lgCount = await this.prisma.levelGrade.count({
      where: { educationLevel: { institutionId } },
    });

    return buildAcademicValidationResult({
      institutionId: institution.id,
      institutionName: institution.name,
      educationLevels: institution._count.educationLevels,
      levelGrades: lgCount,
    });
  }

  async validateAll(): Promise<AcademicStructureValidationResult[]> {
    const institutions = await this.prisma.institution.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        _count: { select: { educationLevels: true } },
        educationLevels: {
          select: { _count: { select: { levelGrades: true } } },
        },
      },
    });

    return institutions.map((inst) => {
      const levelGrades = inst.educationLevels.reduce(
        (sum, el) => sum + el._count.levelGrades,
        0,
      );

      return buildAcademicValidationResult({
        institutionId: inst.id,
        institutionName: inst.name,
        educationLevels: inst._count.educationLevels,
        levelGrades,
      });
    });
  }
}
