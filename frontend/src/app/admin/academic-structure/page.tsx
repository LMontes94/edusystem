'use client';

import { useEducationLevels } from '@/lib/api/education-levels';
import { EducationLevelsTable } from './_components/education-levels-table';
import { LevelGradesTable } from './_components/level-grades-table';
import { LevelGrade, EducationLevel } from './_components/academic-structure.types';

export default function AcademicStructurePage() {
  const { data: levels = [], isLoading } = useEducationLevels();

  const allGrades: LevelGrade[] = levels.flatMap(
    (level: EducationLevel) =>
      level.levelGrades.map((grade) => ({
        ...grade,
        educationLevel: { id: level.id, name: level.name },
      })),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Estructura Académica</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {levels.length} niveles &middot; {allGrades.length} grados
        </p>
      </div>

      <EducationLevelsTable levels={levels} isLoading={isLoading} />

      <LevelGradesTable
        grades={allGrades}
        levels={levels}
        isLoading={isLoading}
      />
    </div>
  );
}
