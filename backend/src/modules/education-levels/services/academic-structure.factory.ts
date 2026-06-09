import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LEVEL_CATALOG } from '../../../common/validators/academic-structure.constants';

function ordinalSuffix(n: number): string {
  const map: Record<number, string> = { 1: 'ro', 2: 'do', 3: 'ro', 4: 'to' };
  return map[n] ?? 'to';
}

function levelGradeName(grade: number): string {
  return `${grade}${ordinalSuffix(grade)}`;
}

@Injectable()
export class AcademicStructureFactory {
  async provision(
    tx: Prisma.TransactionClient,
    institutionId: string,
  ): Promise<void> {
    for (const [index, catalog] of LEVEL_CATALOG.entries()) {
      const educationLevel = await tx.educationLevel.upsert({
        where: {
          institutionId_slug: {
            institutionId,
            slug: catalog.slug,
          },
        },
        create: {
          institutionId,
          slug: catalog.slug,
          name: catalog.slug.charAt(0).toUpperCase() + catalog.slug.slice(1),
          displayOrder: index + 1,
          status: 'ACTIVE',
        },
        update: {},
      });

      for (let g = 1; g <= catalog.maxGrade; g++) {
        const name = levelGradeName(g);
        const existing = await tx.levelGrade.findFirst({
          where: { educationLevelId: educationLevel.id, name },
        });
        if (!existing) {
          await tx.levelGrade.create({
            data: {
              educationLevelId: educationLevel.id,
              name,
              displayOrder: g,
              status: 'ACTIVE',
            },
          });
        }
      }
    }
  }
}
