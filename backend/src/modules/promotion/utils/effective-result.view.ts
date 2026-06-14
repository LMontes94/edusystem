import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EffectiveResultViewService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectiveResults(schoolYearId: string, institutionId: string): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT DISTINCT ON (pr.student_id, pr.from_school_year_id)
        pr.*
      FROM promotion_results pr
      WHERE pr.from_school_year_id = ${schoolYearId}::uuid
        AND pr.institution_id = ${institutionId}
      ORDER BY
        pr.student_id,
        pr.from_school_year_id,
        pr.decided_at DESC,
        pr.id DESC
    `;
  }

  async getEffectiveResult(studentId: string, fromSchoolYearId: string): Promise<any | null> {
    const results = await this.prisma.$queryRaw`
      SELECT *
      FROM promotion_results
      WHERE student_id = ${studentId}::uuid
        AND from_school_year_id = ${fromSchoolYearId}::uuid
      ORDER BY decided_at DESC, id DESC
      LIMIT 1
    `;
    return (results as any[])[0] ?? null;
  }

  async getEffectiveResultWithTenant(
    studentId: string,
    fromSchoolYearId: string,
    institutionId: string,
  ): Promise<any | null> {
    const results = await this.prisma.$queryRaw`
      SELECT *
      FROM promotion_results
      WHERE student_id = ${studentId}::uuid
        AND from_school_year_id = ${fromSchoolYearId}::uuid
        AND institution_id = ${institutionId}
      ORDER BY decided_at DESC, id DESC
      LIMIT 1
    `;
    return (results as any[])[0] ?? null;
  }
}
