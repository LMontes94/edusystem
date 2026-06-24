import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface EffectiveResultFilters {
  studentId?: string;
  result?: string;
  isOverride?: boolean;
}

@Injectable()
export class EffectiveResultViewService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectiveResults(
    schoolYearId: string,
    institutionId: string,
    filters?: EffectiveResultFilters,
  ): Promise<any[]> {
    const hasFilters = filters && (filters.studentId || filters.result || filters.isOverride !== undefined);

    if (!hasFilters) {
      return this.prisma.$queryRaw`
        SELECT DISTINCT ON (pr.student_id, pr.from_school_year_id)
          pr.id,
          pr.institution_id            AS "institutionId",
          pr.student_id                AS "studentId",
          pr.from_school_year_id       AS "fromSchoolYearId",
          pr.to_school_year_id         AS "toSchoolYearId",
          pr.from_course_student_id    AS "fromCourseStudentId",
          pr.to_course_student_id      AS "toCourseStudentId",
          pr.from_level_grade_id       AS "fromLevelGradeId",
          pr.to_level_grade_id         AS "toLevelGradeId",
          pr.result,
          pr.criteria,
          pr.evaluation_snapshot       AS "evaluationSnapshot",
          pr.reason,
          pr.is_override               AS "isOverride",
          pr.decided_by_id             AS "decidedById",
          pr.decided_at                AS "decidedAt"
        FROM promotion_results pr
        WHERE pr.from_school_year_id = ${schoolYearId}
          AND pr.institution_id = ${institutionId}
        ORDER BY
          pr.student_id,
          pr.from_school_year_id,
          pr.decided_at DESC,
          pr.id DESC
      `;
    }

    // When filters are present, wrap DISTINCT ON in a subquery
    // so filters apply to the effective (latest) result per student
    const outerConditions: string[] = [];
    const params: unknown[] = [schoolYearId, institutionId];
    let paramIndex = 3;

    if (filters.studentId) {
      outerConditions.push(`effective."studentId" = $${paramIndex++}`);
      params.push(filters.studentId);
    }
    if (filters.result) {
      outerConditions.push(`effective.result = $${paramIndex++}`);
      params.push(filters.result);
    }
    if (filters.isOverride !== undefined) {
      outerConditions.push(`effective."isOverride" = $${paramIndex++}`);
      params.push(filters.isOverride);
    }

    const whereClause = `WHERE ${outerConditions.join(' AND ')}`;

    return this.prisma.$queryRawUnsafe(
      `
        SELECT * FROM (
          SELECT DISTINCT ON (pr.student_id, pr.from_school_year_id)
            pr.id,
            pr.institution_id            AS "institutionId",
            pr.student_id                AS "studentId",
            pr.from_school_year_id       AS "fromSchoolYearId",
            pr.to_school_year_id         AS "toSchoolYearId",
            pr.from_course_student_id    AS "fromCourseStudentId",
            pr.to_course_student_id      AS "toCourseStudentId",
            pr.from_level_grade_id       AS "fromLevelGradeId",
            pr.to_level_grade_id         AS "toLevelGradeId",
            pr.result,
            pr.criteria,
            pr.evaluation_snapshot       AS "evaluationSnapshot",
            pr.reason,
            pr.is_override               AS "isOverride",
            pr.decided_by_id             AS "decidedById",
            pr.decided_at                AS "decidedAt"
          FROM promotion_results pr
          WHERE pr.from_school_year_id = $1
            AND pr.institution_id = $2
          ORDER BY pr.student_id, pr.from_school_year_id, pr.decided_at DESC, pr.id DESC
        ) effective
        ${whereClause}
        ORDER BY effective."studentId"
      `,
      ...params,
    );
  }

  async getEffectiveResultWithTenant(
    studentId: string,
    fromSchoolYearId: string,
    institutionId: string,
  ): Promise<any | null> {
    const results = await this.prisma.$queryRaw`
      SELECT
        id,
        institution_id            AS "institutionId",
        student_id                AS "studentId",
        from_school_year_id       AS "fromSchoolYearId",
        to_school_year_id         AS "toSchoolYearId",
        from_course_student_id    AS "fromCourseStudentId",
        to_course_student_id      AS "toCourseStudentId",
        from_level_grade_id       AS "fromLevelGradeId",
        to_level_grade_id         AS "toLevelGradeId",
        result,
        criteria,
        evaluation_snapshot       AS "evaluationSnapshot",
        reason,
        is_override               AS "isOverride",
        decided_by_id             AS "decidedById",
        decided_at                AS "decidedAt"
      FROM promotion_results
      WHERE student_id = ${studentId}
        AND from_school_year_id = ${fromSchoolYearId}
        AND institution_id = ${institutionId}
      ORDER BY decided_at DESC, id DESC
      LIMIT 1
    `;
    return (results as any[])[0] ?? null;
  }
}
