-- Corrective migration: Phase 1 schema fixes
--
-- Changes:
--   1. LevelGrade.educationLevel FK: ON DELETE CASCADE → ON DELETE RESTRICT
--      (approved implementation plan requires Restrict; Phase 1 had Cascade)
--   2. Add missing @@unique([institutionId, name]) on EducationLevel
--      (approved plan requires both name and slug uniqueness; only slug existed)

-- DropForeignKey
ALTER TABLE "level_grades" DROP CONSTRAINT "level_grades_education_level_id_fkey";

-- Add missing unique constraint on education_levels (institution_id, name)
CREATE UNIQUE INDEX "education_levels_institution_id_name_key" ON "education_levels"("institution_id", "name");

-- AddForeignKey with RESTRICT (was CASCADE)
ALTER TABLE "level_grades" ADD CONSTRAINT "level_grades_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
