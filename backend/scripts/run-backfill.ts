import { PrismaClient, Level } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  levelEnumToSlug,
  LEVEL_SLUG_TO_NAME,
  intToOrdinal,
  generateCsv,
} from './_helpers';

const prisma = new PrismaClient();

interface BackfillReport {
  educationLevelsCreated: number;
  levelGradesCreated: number;
  coursesUpdated: number;
  coursesSkipped: number;
  userLevelRolesUpdated: number;
  userLevelRolesSkipped: number;
  chatRoomsUpdated: number;
  chatRoomsSkipped: number;
  ilcsUpdated: number;
  ilcsSkipped: number;
  indicatorsStep1: number;
  indicatorsStep2: number;
  indicatorsManual: number;
  settingsMigrated: number;
  settingsSkipped: number;
}

function log(msg: string) {
  console.error(`[${new Date().toISOString()}] ${msg}`);
}

async function seedEducationLevels(): Promise<Map<string, string>> {
  log('STEP 2: Seeding EducationLevels...');
  const institutions = await prisma.institution.findMany({ select: { id: true, name: true } });
  log(`  Found ${institutions.length} institutions`);

  const eduLevelMap = new Map<string, string>();

  for (const inst of institutions) {
    for (const level of ['INICIAL', 'PRIMARIA', 'SECUNDARIA'] as const) {
      const slug = levelEnumToSlug(level as string);
      const existing = await prisma.educationLevel.findFirst({
        where: { institutionId: inst.id, slug },
      });

      if (existing) {
        eduLevelMap.set(`${inst.id}:${level}`, existing.id);
        continue;
      }

      const created = await prisma.educationLevel.create({
        data: {
          institutionId: inst.id,
          slug,
          name: LEVEL_SLUG_TO_NAME[slug] ?? slug,
          displayOrder: level === 'INICIAL' ? 1 : level === 'PRIMARIA' ? 2 : 3,
          status: 'ACTIVE',
        },
      });
      eduLevelMap.set(`${inst.id}:${level}`, created.id);
      log(`  Created EducationLevel: ${slug} for institution ${inst.name}`);
    }
  }

  log(`  EducationLevel seeding complete.`);
  return eduLevelMap;
}

async function seedLevelGrades(eduLevelMap: Map<string, string>): Promise<Map<string, string>> {
  log('STEP 3: Seeding LevelGrades...');
  const courses = await prisma.course.findMany({
    select: { id: true, institutionId: true, level: true, grade: true, name: true },
  });

  const comboSet = new Set<string>();
  const lgMap = new Map<string, string>();

  for (const course of courses) {
    const key = `${course.institutionId}:${course.level}:${course.grade}`;
    if (comboSet.has(key)) continue;
    comboSet.add(key);

    const eduLevelId = eduLevelMap.get(`${course.institutionId}:${course.level}`);
    if (!eduLevelId) {
      log(`  WARN: No EducationLevel for ${course.institutionId}:${course.level}, skipping`);
      continue;
    }

    const gradeName = intToOrdinal(course.grade);
    const existingLg = await prisma.levelGrade.findFirst({
      where: {
        educationLevelId: eduLevelId,
        name: gradeName,
      },
    });

    if (existingLg) {
      lgMap.set(key, existingLg.id);
      continue;
    }

    const created = await prisma.levelGrade.create({
      data: {
        educationLevelId: eduLevelId,
        name: gradeName,
        displayOrder: course.grade,
        status: 'ACTIVE',
      },
    });
    lgMap.set(key, created.id);
    log(`  Created LevelGrade: ${course.level} - ${gradeName} (${course.name})`);
  }

  log(`  LevelGrade seeding complete. ${lgMap.size} grade records created.`);
  return lgMap;
}

async function backfillCourses(lgMap: Map<string, string>): Promise<{ updated: number; skipped: number }> {
  log('STEP 4a: Backfilling Course.levelGradeId...');
  const courses = await prisma.course.findMany({
    select: { id: true, institutionId: true, level: true, grade: true, name: true, levelGradeId: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const course of courses) {
    if (course.levelGradeId) {
      skipped++;
      continue;
    }

    const key = `${course.institutionId}:${course.level}:${course.grade}`;
    const lgId = lgMap.get(key);

    if (!lgId) {
      log(`  WARN: No LevelGrade for ${key}, skipping course ${course.id}`);
      skipped++;
      continue;
    }

    await prisma.course.update({
      where: { id: course.id },
      data: { levelGradeId: lgId },
    });
    updated++;
  }

  log(`  Courses: ${updated} updated, ${skipped} skipped`);
  return { updated, skipped };
}

async function backfillUserLevelRoles(eduLevelMap: Map<string, string>): Promise<{ updated: number; skipped: number }> {
  log('STEP 4b: Backfilling UserLevelRole.educationLevelId...');
  const roles = await prisma.userLevelRole.findMany({
    include: { user: { select: { institutionId: true } } },
  });

  let updated = 0;
  let skipped = 0;

  for (const role of roles) {
    if (role.educationLevelId) {
      skipped++;
      continue;
    }

    const institutionId = role.user.institutionId;
    if (!institutionId) {
      log(`  WARN: User ${role.userId} has no institutionId, skipping`);
      skipped++;
      continue;
    }

    const eduLevelId = eduLevelMap.get(`${institutionId}:${role.level}`);
    if (!eduLevelId) {
      log(`  WARN: No EducationLevel for ${institutionId}:${role.level}`);
      skipped++;
      continue;
    }

    await prisma.userLevelRole.update({
      where: { id: role.id },
      data: { educationLevelId: eduLevelId },
    });
    updated++;
  }

  log(`  UserLevelRoles: ${updated} updated, ${skipped} skipped`);
  return { updated, skipped };
}

async function backfillChatRooms(eduLevelMap: Map<string, string>): Promise<{ updated: number; skipped: number }> {
  log('STEP 4c: Backfilling ChatRoom.educationLevelId...');
  const rooms = await prisma.chatRoom.findMany({
    select: { id: true, institutionId: true, level: true, educationLevelId: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const room of rooms) {
    if (room.educationLevelId || !room.level) {
      skipped++;
      continue;
    }

    const eduLevelId = eduLevelMap.get(`${room.institutionId}:${room.level}`);
    if (!eduLevelId) {
      log(`  WARN: No EducationLevel for ${room.institutionId}:${room.level}`);
      skipped++;
      continue;
    }

    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { educationLevelId: eduLevelId },
    });
    updated++;
  }

  log(`  ChatRooms: ${updated} updated, ${skipped} skipped`);
  return { updated, skipped };
}

async function backfillILCS(eduLevelMap: Map<string, string>): Promise<{ updated: number; skipped: number }> {
  log('STEP 4d: Backfilling InstitutionLevelCommunicationSettings.educationLevelId...');
  const ilcsRecords = await prisma.institutionLevelCommunicationSettings.findMany({
    select: { id: true, institutionId: true, level: true, educationLevelId: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const record of ilcsRecords) {
    if (record.educationLevelId) {
      skipped++;
      continue;
    }

    const eduLevelId = eduLevelMap.get(`${record.institutionId}:${record.level}`);
    if (!eduLevelId) {
      log(`  WARN: No EducationLevel for ${record.institutionId}:${record.level}`);
      skipped++;
      continue;
    }

    await prisma.institutionLevelCommunicationSettings.update({
      where: { id: record.id },
      data: { educationLevelId: eduLevelId },
    });
    updated++;
  }

  log(`  ILCS: ${updated} updated, ${skipped} skipped`);
  return { updated, skipped };
}

async function backfillIndicators(): Promise<{
  step1: number; step2: number; manual: number; unresolved: { id: string; reason: string }[];
}> {
  log('STEP 5: Backfilling Indicator.levelGradeId (hybrid algorithm)...');

  const indicators = await prisma.indicator.findMany({
    select: { id: true, subjectId: true, schoolYearId: true, grade: true, description: true, levelGradeId: true },
  });

  const unresolved: { id: string; reason: string }[] = [];
  let step1 = 0;
  let step2 = 0;
  let manual = 0;

  const allCourseSubjects = await prisma.courseSubject.findMany({
    include: { course: { select: { id: true, name: true, schoolYearId: true, level: true, grade: true } } },
  });

  const allLevelGrades = await prisma.levelGrade.findMany({
    include: { educationLevel: { select: { slug: true } } },
  });

  const lgBySlugAndGrade = new Map<string, string>();
  for (const lg of allLevelGrades) {
    const slug = lg.educationLevel.slug;
    const parsed = parseInt(lg.name.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed)) lgBySlugAndGrade.set(`${slug}:${parsed}`, lg.id);
  }

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

  for (const indicator of indicators) {
    if (indicator.levelGradeId) continue;

    const resolved = tryResolveIndicator(indicator, csBySubject, csBySubjectAndSchoolYear, lgBySlugAndGrade);

    if (resolved) {
      await prisma.indicator.update({
        where: { id: indicator.id },
        data: { levelGradeId: resolved.lgId },
      });
      if (resolved.method === 'STEP1_DIRECT') step1++;
      else step2++;
    } else {
      manual++;
      unresolved.push({
        id: indicator.id,
        reason: `No CourseSubject match for subject ${indicator.subjectId} in schoolYear ${indicator.schoolYearId}`,
      });
    }
  }

  log(`  Indicators: Step1=${step1}, Step2=${step2}, Manual=${manual}`);
  return { step1, step2, manual, unresolved };
}

function tryResolveIndicator(
  indicator: { id: string; subjectId: string; schoolYearId: string; grade: number | null },
  csBySubject: Map<string, { id: string; courseId: string; subjectId: string; course: { id: string; name: string; schoolYearId: string; level: string; grade: number } }[]>,
  csBySubjectAndSchoolYear: Map<string, Array<{ id: string; courseId: string; subjectId: string; course: { id: string; name: string; schoolYearId: string; level: string; grade: number } }>>,
  lgMap: Map<string, string>,
): { lgId: string; method: string } | null {
  const courseSubjects = csBySubject.get(indicator.subjectId);
  if (courseSubjects && courseSubjects.length > 0) {
    const gradeTarget = indicator.grade;

    if (gradeTarget !== null) {
      for (const cs of courseSubjects) {
        const c = cs.course;
        if (c.schoolYearId !== indicator.schoolYearId) continue;
        if (c.grade !== gradeTarget) continue;
        const slug = levelEnumToSlug(c.level);
        const lgId = lgMap.get(`${slug}:${gradeTarget}`);
        if (lgId) return { lgId, method: 'STEP1_DIRECT' };
      }
    }

    for (const cs of courseSubjects) {
      const c = cs.course;
      if (c.schoolYearId !== indicator.schoolYearId) continue;
      const slug = levelEnumToSlug(c.level);
      const lgId = lgMap.get(`${slug}:${c.grade}`);
      if (lgId) return { lgId, method: 'STEP1_DIRECT' };
    }
  }

  const siblings = csBySubjectAndSchoolYear.get(`${indicator.subjectId}:${indicator.schoolYearId}`);
  if (siblings && siblings.length > 0) {
    for (const cs of siblings) {
      const c = cs.course;
      const slug = levelEnumToSlug(c.level);
      const target = indicator.grade ?? c.grade;
      const lgId = lgMap.get(`${slug}:${target}`);
      if (lgId) return { lgId, method: 'STEP2_SIBLING' };
    }
  }

  return null;
}

async function migrateSettings(): Promise<{ migrated: number; skipped: number }> {
  log('STEP 7: Migrating institution settings...');
  const institutions = await prisma.institution.findMany({
    select: { id: true, name: true, settings: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const inst of institutions) {
    const settings = inst.settings as Record<string, unknown> | null;
    if (!settings) {
      skipped++;
      continue;
    }

    if ((settings as any).schemaVersion === 2) {
      skipped++;
      continue;
    }

    const aggregation = (settings as any).reportPeriodAggregation as Record<string, unknown> | undefined;

    if (!aggregation) {
      await prisma.institution.update({
        where: { id: inst.id },
        data: { settings: { ...settings, schemaVersion: 2 } as any },
      });
      migrated++;
      continue;
    }

    const newAgg: Record<string, unknown> = {};
    const legacyKeys = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'];

    for (const key of Object.keys(aggregation)) {
      const slug = levelEnumToSlug(key);
      newAgg[slug] = aggregation[key];
    }

    for (const legacyKey of legacyKeys) {
      if (aggregation[legacyKey] && !newAgg[levelEnumToSlug(legacyKey)]) {
        newAgg[levelEnumToSlug(legacyKey)] = aggregation[legacyKey];
      }
    }

    await prisma.institution.update({
      where: { id: inst.id },
      data: {
        settings: {
          ...settings,
          reportPeriodAggregation: newAgg,
          schemaVersion: 2,
        } as any,
      },
    });
    migrated++;
    log(`  Migrated settings for ${inst.name}`);
  }

  log(`  Settings: ${migrated} migrated, ${skipped} skipped`);
  return { migrated, skipped };
}

async function generateReport(report: BackfillReport, unresolved: { id: string; reason: string }[]) {
  const csvRows: Record<string, string>[] = [];

  const courseNull = await prisma.course.count({ where: { levelGradeId: null } });
  const ulrNull = await prisma.userLevelRole.count({ where: { educationLevelId: null } });
  const roomNullWithLevel = await prisma.chatRoom.count({
    where: { educationLevelId: null, level: { not: null } },
  });
  const ilcsNullWithLevel = await prisma.institutionLevelCommunicationSettings.count({
    where: { educationLevelId: null },
  });
  const indicatorNull = await prisma.indicator.count({ where: { levelGradeId: null } });

  for (const u of unresolved) {
    csvRows.push({
      entity: 'Indicator',
      id: u.id,
      reason: u.reason,
      suggested_resolution: 'Manual review required — verify course assignment in the academic period',
    });
  }

  const csv = generateCsv(csvRows);
  const csvPath = path.resolve(__dirname, '../migration_report.csv');
  fs.writeFileSync(csvPath, csv, 'utf-8');
  log(`CSV report written to ${csvPath}`);

  console.error('');
  console.error('=== VALIDATION RESULTS ===');
  console.error(`  Courses with NULL levelGradeId:            ${courseNull}`);
  console.error(`  UserLevelRoles with NULL educationLevelId: ${ulrNull}`);
  console.error(`  ChatRooms NULL eduLevelId (has level):     ${roomNullWithLevel}`);
  console.error(`  ILCS NULL eduLevelId (has level):          ${ilcsNullWithLevel}`);
  console.error(`  Indicators with NULL levelGradeId:         ${indicatorNull}`);
  console.error('');

  return { courseNull, ulrNull, roomNullWithLevel, ilcsNullWithLevel, indicatorNull };
}

async function main() {
  log('=== Academic Structure Backfill Phase 2 ===');
  log('');

  // TODO(P2): reporting counters are informational only.
  // Fix before removing Phase 2 scripts or relying on metrics.
  const report: BackfillReport = {
    educationLevelsCreated: 0,
    levelGradesCreated: 0,
    coursesUpdated: 0,
    coursesSkipped: 0,
    userLevelRolesUpdated: 0,
    userLevelRolesSkipped: 0,
    chatRoomsUpdated: 0,
    chatRoomsSkipped: 0,
    ilcsUpdated: 0,
    ilcsSkipped: 0,
    indicatorsStep1: 0,
    indicatorsStep2: 0,
    indicatorsManual: 0,
    settingsMigrated: 0,
    settingsSkipped: 0,
  };

  // TODO(P2): educationLevelsCreated and levelGradesCreated are never
  // updated — seedEducationLevels/seedLevelGrades return Map, not count.
  const eduLevelMap = await seedEducationLevels();
  const lgMap = await seedLevelGrades(eduLevelMap);

  const courseResult = await backfillCourses(lgMap);
  report.coursesUpdated = courseResult.updated;
  report.coursesSkipped = courseResult.skipped;

  const ulrResult = await backfillUserLevelRoles(eduLevelMap);
  report.userLevelRolesUpdated = ulrResult.updated;
  report.userLevelRolesSkipped = ulrResult.skipped;

  const chatResult = await backfillChatRooms(eduLevelMap);
  report.chatRoomsUpdated = chatResult.updated;
  report.chatRoomsSkipped = chatResult.skipped;

  const ilcsResult = await backfillILCS(eduLevelMap);
  report.ilcsUpdated = ilcsResult.updated;
  report.ilcsSkipped = ilcsResult.skipped;

  const indicatorResult = await backfillIndicators();
  report.indicatorsStep1 = indicatorResult.step1;
  report.indicatorsStep2 = indicatorResult.step2;
  report.indicatorsManual = indicatorResult.manual;

  const settingsResult = await migrateSettings();
  report.settingsMigrated = settingsResult.migrated;
  report.settingsSkipped = settingsResult.skipped;

  log('=== SUMMARY ===');
  log(JSON.stringify(report, null, 2));

  const validation = await generateReport(report, indicatorResult.unresolved);

  log('=== DONE ===');
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
