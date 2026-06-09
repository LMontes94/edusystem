import { PrismaClient } from '@prisma/client';
import { LEVEL_CATALOG } from '../src/common/validators/academic-structure.constants';
import { buildAcademicValidationResult } from '../src/common/validators/academic-structure.validation';

const prisma = new PrismaClient();

function ordinalSuffix(n: number): string {
  const map: Record<number, string> = { 1: 'ro', 2: 'do', 3: 'ro', 4: 'to' };
  return map[n] ?? 'to';
}

function levelGradeName(grade: number): string {
  return `${grade}${ordinalSuffix(grade)}`;
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function repairInstitution(
  institution: { id: string; name: string },
): Promise<{ before: number; after: number; created: number; skipped: number }> {
  const educationLevels = await prisma.educationLevel.findMany({
    where: { institutionId: institution.id, status: 'ACTIVE' },
  });

  const levelGradesBefore = await prisma.levelGrade.count({
    where: { educationLevel: { institutionId: institution.id } },
  });

  let created = 0;
  let skipped = 0;

  for (const catalog of LEVEL_CATALOG) {
    const el = educationLevels.find((e) => e.slug === catalog.slug);
    if (!el) {
      log(`  SKIP: EducationLevel '${catalog.slug}' no encontrado en '${institution.name}'`);
      continue;
    }

    for (let g = 1; g <= catalog.maxGrade; g++) {
      const name = levelGradeName(g);

      const existing = await prisma.levelGrade.findFirst({
        where: { educationLevelId: el.id, name },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.levelGrade.create({
        data: {
          educationLevelId: el.id,
          name,
          displayOrder: g,
          status: 'ACTIVE',
        },
      });
      created++;
    }
  }

  const levelGradesAfter = await prisma.levelGrade.count({
    where: { educationLevel: { institutionId: institution.id } },
  });

  return { before: levelGradesBefore, after: levelGradesAfter, created, skipped };
}

async function validateAll(): Promise<boolean> {
  const institutions = await prisma.institution.findMany({
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
  let allHealthy = true;

  console.error('');
  console.error('Validation:');

  for (const inst of institutions) {
    const levelGrades = inst.educationLevels.reduce(
      (sum, el) => sum + el._count.levelGrades,
      0,
    );

    const result = buildAcademicValidationResult({
      institutionId: inst.id,
      institutionName: inst.name,
      educationLevels: inst._count.educationLevels,
      levelGrades,
    });

    console.error(`  ${inst.name} | EducationLevels: ${result.educationLevels}/${result.expectedEducationLevels} | LevelGrades: ${result.levelGrades}/${result.expectedLevelGrades} | Status: ${result.status}`);

    if (result.status !== 'HEALTHY') {
      allHealthy = false;
    }
  }

  return allHealthy;
}

async function main() {
  log('=== Academic Structure Repair Script ===');
  log('');

  const institutions = await prisma.institution.findMany({ select: { id: true, name: true } });
  log(`Found ${institutions.length} institution(s)`);
  log('');

  for (const inst of institutions) {
    log(`Repairing: ${inst.name} (${inst.id})`);
    const result = await repairInstitution(inst);

    console.error('');
    console.error('=== Academic Structure Repair Report ===');
    console.error('');
    console.error(`Institution: ${inst.name} (${inst.id})`);
    console.error(`  EducationLevels:   3`);
    console.error(`  LevelGrades Before: ${result.before}`);
    console.error(`  LevelGrades After:  ${result.after}`);
    console.error(`  Created: ${result.created}`);
    console.error(`  Skipped: ${result.skipped}`);
    console.error('');
    console.error('==========================================');
    console.error('');
  }

  const allHealthy = await validateAll();

  if (allHealthy) {
    log('All institutions are HEALTHY');
  } else {
    console.error('ERROR: One or more institutions do not meet the minimum requirements');
    process.exit(1);
  }

  log('Repair complete');
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
