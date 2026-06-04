import { PrismaClient } from '@prisma/client';
import { levelEnumToSlug } from './_helpers';

const prisma = new PrismaClient();

interface BackfillStats {
  total: number;
  autoResolvedStep1: number;
  autoResolvedStep2: number;
  manualReview: number;
  resolutionRate: number;
}

interface ResolutionResult {
  indicatorId: string;
  description: string;
  levelGradeId: string | null;
  resolution: 'STEP1_DIRECT' | 'STEP2_SIBLING' | 'MANUAL_REVIEW';
  courseId: string | null;
  courseName: string | null;
  subjectId: string;
  schoolYearId: string;
  reason: string;
}

async function dryRun(): Promise<{ stats: BackfillStats; unresolved: ResolutionResult[] }> {
  const indicators = await prisma.indicator.findMany({
    include: { subject: true },
  });

  const allCourseSubjects = await prisma.courseSubject.findMany({
    include: { course: true },
  });

  const csBySubject = new Map<string, typeof allCourseSubjects>();
  for (const cs of allCourseSubjects) {
    const arr = csBySubject.get(cs.subjectId) ?? [];
    arr.push(cs);
    csBySubject.set(cs.subjectId, arr);
  }

  const csBySubjectAndSchoolYear = new Map<string, typeof allCourseSubjects>();
  for (const cs of allCourseSubjects) {
    const key = `${cs.subjectId}:${cs.course.schoolYearId}`;
    const arr = csBySubjectAndSchoolYear.get(key) ?? [];
    arr.push(cs);
    csBySubjectAndSchoolYear.set(key, arr);
  }

  const allLevelGrades = await prisma.levelGrade.findMany({
    include: { educationLevel: true },
  });

  const lgByEduLevelSlugAndGrade = new Map<string, string>();
  for (const lg of allLevelGrades) {
    const slug = lg.educationLevel.slug;
    const parsedGrade = parseInt(lg.name.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsedGrade)) {
      lgByEduLevelSlugAndGrade.set(`${slug}:${parsedGrade}`, lg.id);
    }
  }

  const results: ResolutionResult[] = [];
  let step1 = 0;
  let step2 = 0;
  let manual = 0;

  for (const indicator of indicators) {
    const gradeValue = indicator.grade;
    const step1Result = resolveStep1(indicator, csBySubject, lgByEduLevelSlugAndGrade, gradeValue);

    if (step1Result) {
      step1++;
      results.push(step1Result);
      continue;
    }

    const step2Result = resolveStep2(indicator, csBySubjectAndSchoolYear, lgByEduLevelSlugAndGrade, gradeValue);

    if (step2Result) {
      step2++;
      results.push(step2Result);
      continue;
    }

    manual++;
    results.push({
      indicatorId: indicator.id,
      description: indicator.description,
      levelGradeId: null,
      resolution: 'MANUAL_REVIEW',
      courseId: null,
      courseName: null,
      subjectId: indicator.subjectId,
      schoolYearId: indicator.schoolYearId,
      reason: 'No matching CourseSubject found for subject or sibling inference failed',
    });
  }

  const total = indicators.length;
  const autoResolved = step1 + step2;

  return {
    stats: {
      total,
      autoResolvedStep1: step1,
      autoResolvedStep2: step2,
      manualReview: manual,
      resolutionRate: total > 0 ? Math.round((autoResolved / total) * 10000) / 100 : 100,
    },
    unresolved: results.filter((r) => r.resolution === 'MANUAL_REVIEW'),
  };
}

function resolveStep1(
  indicator: { id: string; subjectId: string; schoolYearId: string; description: string; grade: number | null },
  csBySubject: Map<string, { id: string; courseId: string; subjectId: string; course: { id: string; name: string; level: string; grade: number; schoolYearId: string } }[]>,
  lgMap: Map<string, string>,
  gradeValue: number | null,
): ResolutionResult | null {
  const courseSubjects = csBySubject.get(indicator.subjectId);
  if (!courseSubjects || courseSubjects.length === 0) return null;

  if (gradeValue !== null) {
    for (const cs of courseSubjects) {
      const course = cs.course;
      if (course.schoolYearId !== indicator.schoolYearId) continue;
      if (course.grade !== gradeValue) continue;

      const slug = levelEnumToSlug(course.level);
      const lgId = lgMap.get(`${slug}:${gradeValue}`);
      if (lgId) {
        return {
          indicatorId: indicator.id,
          description: indicator.description,
          levelGradeId: lgId,
          resolution: 'STEP1_DIRECT',
          courseId: course.id,
          courseName: course.name,
          subjectId: indicator.subjectId,
          schoolYearId: indicator.schoolYearId,
          reason: `Direct match: course ${course.name} (${slug} grade ${gradeValue})`,
        };
      }
    }
  }

  for (const cs of courseSubjects) {
    const course = cs.course;
    if (course.schoolYearId !== indicator.schoolYearId) continue;

    const slug = levelEnumToSlug(course.level);
    const lgId = lgMap.get(`${slug}:${course.grade}`);
    if (lgId) {
      return {
        indicatorId: indicator.id,
        description: indicator.description,
        levelGradeId: lgId,
        resolution: 'STEP1_DIRECT',
        courseId: course.id,
        courseName: course.name,
        subjectId: indicator.subjectId,
        schoolYearId: indicator.schoolYearId,
        reason: `Direct match via CourseSubject: course ${course.name} (${slug} grade ${course.grade})${gradeValue !== null ? `, indicator.grade=${gradeValue}` : ''}`,
      };
    }
  }

  return null;
}

function resolveStep2(
  indicator: { id: string; subjectId: string; schoolYearId: string; description: string; grade: number | null },
  csBySubjectSchoolYear: Map<string, { id: string; courseId: string; subjectId: string; course: { id: string; name: string; level: string; grade: number; schoolYearId: string } }[]>,
  lgMap: Map<string, string>,
  gradeValue: number | null,
): ResolutionResult | null {
  const key = `${indicator.subjectId}:${indicator.schoolYearId}`;
  const siblings = csBySubjectSchoolYear.get(key);
  if (!siblings || siblings.length === 0) return null;

  for (const cs of siblings) {
    const course = cs.course;
    const slug = levelEnumToSlug(course.level);
    const targetGrade = gradeValue ?? course.grade;
    const lgId = lgMap.get(`${slug}:${targetGrade}`);
    if (lgId) {
      return {
        indicatorId: indicator.id,
        description: indicator.description,
        levelGradeId: lgId,
        resolution: 'STEP2_SIBLING',
        courseId: course.id,
        courseName: course.name,
        subjectId: indicator.subjectId,
        schoolYearId: indicator.schoolYearId,
        reason: `Sibling inference: subject in same schoolYear links to course ${course.name} (${slug} grade ${targetGrade})`,
      };
    }
  }

  return null;
}

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.error('=== Indicator Backfill Tool ===');
  console.error(`Mode: ${isDryRun ? 'DRY RUN (no writes)' : 'LIVE EXECUTION'}`);
  console.error('');

  const { stats, unresolved } = await dryRun();

  console.log(JSON.stringify(stats, null, 2));
  console.error('');

  if (unresolved.length > 0) {
    console.error(`UNRESOLVED INDICATORS: ${unresolved.length}`);
    for (const u of unresolved) {
      console.error(`  - ${u.indicatorId}: ${u.description || '(no description)'}`);
      console.error(`    Subject: ${u.subjectId}, Reason: ${u.reason}`);
    }
  } else {
    console.error('All indicators resolved automatically. No manual review needed.');
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
