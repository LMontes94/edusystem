import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PromotionStaleHelper {
  constructor(private readonly prisma: PrismaService) {}

  async markStaleIfCompleted(schoolYearId: string): Promise<void> {
    await this.prisma.schoolYear.updateMany({
      where: { id: schoolYearId, promotionStatus: 'COMPLETED' },
      data: { promotionSummaryStale: true },
    });
  }
}
