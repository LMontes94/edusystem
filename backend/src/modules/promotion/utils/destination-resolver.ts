import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PromotionOutcome, Level } from '@prisma/client';
import { Destination } from '../promotion.types';

@Injectable()
export class DestinationResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveDestination(
    result: PromotionOutcome,
    fromLevelGradeId: string | null,
    fromSchoolYearId: string,
    institutionId: string,
  ): Promise<Destination> {
    if (result === PromotionOutcome.GRADUATED) {
      return { toSchoolYearId: null, toLevelGradeId: null };
    }

    if (result === PromotionOutcome.RETAINED) {
      const nextSchoolYear = await this.findNextSchoolYear(fromSchoolYearId, institutionId);
      if (!nextSchoolYear) {
        throw new BadRequestException('NO_TARGET_SCHOOL_YEAR');
      }
      return {
        toSchoolYearId: nextSchoolYear.id,
        toLevelGradeId: fromLevelGradeId,
      };
    }

    if (result === PromotionOutcome.PROMOTED) {
      if (!fromLevelGradeId) {
        throw new BadRequestException('NO_TARGET_SCHOOL_YEAR');
      }

      const levelGrade = await this.prisma.levelGrade.findUnique({
        where: { id: fromLevelGradeId },
        select: { nextLevelGradeId: true },
      });

      if (!levelGrade || !levelGrade.nextLevelGradeId) {
        throw new BadRequestException('INVALID_LEVEL_GRADE_PROGRESSION');
      }

      await this.validateLevelGradeInstitution(levelGrade.nextLevelGradeId, institutionId);

      const nextSchoolYear = await this.findNextSchoolYear(fromSchoolYearId, institutionId);
      if (!nextSchoolYear) {
        throw new BadRequestException('NO_TARGET_SCHOOL_YEAR');
      }

      return {
        toSchoolYearId: nextSchoolYear.id,
        toLevelGradeId: levelGrade.nextLevelGradeId,
      };
    }

    throw new BadRequestException('INVALID_PROMOTION_OUTCOME');
  }

  async preResolveDestinations(
    evaluations: Array<{ fromLevelGradeId: string | null; result: PromotionOutcome }>,
    fromSchoolYearId: string,
    institutionId: string,
  ): Promise<Map<string, string>> {
    const destinationMap = new Map<string, string>();

    const uniquePairs = new Set<string>();
    for (const evalResult of evaluations) {
      try {
        const dest = await this.resolveDestination(
          evalResult.result,
          evalResult.fromLevelGradeId,
          fromSchoolYearId,
          institutionId,
        );
        if (dest.toSchoolYearId && dest.toLevelGradeId) {
          uniquePairs.add(`${dest.toSchoolYearId}:${dest.toLevelGradeId}`);
        }
      } catch {
        continue;
      }
    }

    for (const pair of uniquePairs) {
      const [schoolYearId, levelGradeId] = pair.split(':');
      const courseId = await this.findOrCreateCourse(schoolYearId, levelGradeId, institutionId);
      destinationMap.set(pair, courseId);
    }

    return destinationMap;
  }

  async findOrCreateCourse(
    schoolYearId: string,
    levelGradeId: string,
    institutionId: string,
  ): Promise<string> {
    const existing = await this.prisma.course.findFirst({
      where: { schoolYearId, levelGradeId, institutionId },
      select: { id: true },
    });

    if (existing) return existing.id;

    const levelGrade = await this.prisma.levelGrade.findUnique({
      where: { id: levelGradeId },
      select: {
        name: true,
        displayOrder: true,
        educationLevel: { select: { slug: true } },
      },
    });

    const level = this.mapEducationSlugToLevel(levelGrade?.educationLevel?.slug);

    const created = await this.prisma.course.create({
      data: {
        institutionId,
        schoolYearId,
        levelGradeId,
        name: levelGrade?.name ?? `Grado ${levelGradeId}`,
        grade: levelGrade?.displayOrder ?? 1,
        division: 'U',
        level,
      },
      select: { id: true },
    });

    return created.id;
  }

  private async findNextSchoolYear(
    fromSchoolYearId: string,
    institutionId: string,
  ): Promise<{ id: string } | null> {
    const currentYear = await this.prisma.schoolYear.findUnique({
      where: { id: fromSchoolYearId },
      select: { year: true },
    });

    if (!currentYear) return null;

    return this.prisma.schoolYear.findFirst({
      where: {
        institutionId,
        year: currentYear.year + 1,
      },
      select: { id: true },
    });
  }

  async validateLevelGradeInstitution(levelGradeId: string, institutionId: string): Promise<void> {
    const lg = await this.prisma.levelGrade.findUnique({
      where: { id: levelGradeId },
      select: {
        educationLevel: {
          select: { institutionId: true },
        },
      },
    });

    if (!lg || lg.educationLevel.institutionId !== institutionId) {
      throw new BadRequestException('INVALID_LEVEL_GRADE_PROGRESSION');
    }
  }

  private mapEducationSlugToLevel(slug: string | undefined): Level {
    switch (slug) {
      case 'inicial': return Level.INICIAL;
      case 'primaria': return Level.PRIMARIA;
      case 'secundaria': return Level.SECUNDARIA;
      default: return Level.PRIMARIA;
    }
  }
}
