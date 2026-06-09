import { PrismaClient } from '@prisma/client';
import { buildAcademicValidationResult } from '../src/common/validators/academic-structure.validation';

const prisma = new PrismaClient();

async function main() {
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

  console.log('=== Academic Structure Report ===');
  console.log('');

  let allHealthy = true;

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

    console.log(`${inst.name} (${inst.id})`);
    console.log(`  EducationLevels: ${result.educationLevels}/${result.expectedEducationLevels}`);
    console.log(`  LevelGrades:     ${result.levelGrades}/${result.expectedLevelGrades}`);
    console.log(`  Status:          ${result.status}`);
    result.issues.forEach((issue) => console.log(`  Issue: ${issue}`));
    console.log('');

    if (result.status !== 'HEALTHY') {
      allHealthy = false;
    }
  }

  console.log('========================================');

  if (!allHealthy) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
