import { BadRequestException } from '@nestjs/common';
import { PromotionOutcome } from '@prisma/client';
import { DestinationResolver } from './destination-resolver';

const makePrismaMock = () => ({
  levelGrade: {
    findUnique: jest.fn(),
  },
  schoolYear: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  course: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
});

describe('DestinationResolver', () => {
  it('returns null destination for GRADUATED', async () => {
    const prisma = makePrismaMock();
    const resolver = new DestinationResolver(prisma as any);

    const result = await resolver.resolveDestination(
      PromotionOutcome.GRADUATED,
      'lg-1',
      'sy-2025',
      'inst-1',
    );

    expect(result).toEqual({ toSchoolYearId: null, toLevelGradeId: null });
    expect(prisma.levelGrade.findUnique).not.toHaveBeenCalled();
  });

  it('returns same LevelGrade for RETAINED', async () => {
    const prisma = makePrismaMock();
    prisma.schoolYear.findUnique.mockResolvedValue({ year: 2025 });
    prisma.schoolYear.findFirst.mockResolvedValue({ id: 'sy-2026' });
    const resolver = new DestinationResolver(prisma as any);

    const result = await resolver.resolveDestination(
      PromotionOutcome.RETAINED,
      'lg-1',
      'sy-2025',
      'inst-1',
    );

    expect(result).toEqual({ toSchoolYearId: 'sy-2026', toLevelGradeId: 'lg-1' });
  });

  it('resolves next LevelGrade for PROMOTED', async () => {
    const prisma = makePrismaMock();
    prisma.levelGrade.findUnique
      .mockResolvedValueOnce({ nextLevelGradeId: 'lg-2' })
      .mockResolvedValueOnce({
        educationLevel: { institutionId: 'inst-1' },
      });
    prisma.schoolYear.findUnique.mockResolvedValue({ year: 2025 });
    prisma.schoolYear.findFirst.mockResolvedValue({ id: 'sy-2026' });
    const resolver = new DestinationResolver(prisma as any);

    const result = await resolver.resolveDestination(
      PromotionOutcome.PROMOTED,
      'lg-1',
      'sy-2025',
      'inst-1',
    );

    expect(result).toEqual({ toSchoolYearId: 'sy-2026', toLevelGradeId: 'lg-2' });
  });

  it('throws when next LevelGrade is missing for PROMOTED', async () => {
    const prisma = makePrismaMock();
    prisma.levelGrade.findUnique.mockResolvedValue({
      nextLevelGradeId: null,
    });
    const resolver = new DestinationResolver(prisma as any);

    await expect(
      resolver.resolveDestination(
        PromotionOutcome.PROMOTED,
        'lg-1',
        'sy-2025',
        'inst-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
