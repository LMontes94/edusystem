-- CreateEnum
CREATE TYPE "EducationLevelStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LevelGradeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable: education_levels
CREATE TABLE "education_levels" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "EducationLevelStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "education_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable: level_grades
CREATE TABLE "level_grades" (
    "id" TEXT NOT NULL,
    "education_level_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "LevelGradeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "level_grades_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add consumer FKs
ALTER TABLE "courses" ADD COLUMN "level_grade_id" TEXT;
ALTER TABLE "indicators" ADD COLUMN "level_grade_id" TEXT;
ALTER TABLE "user_level_roles" ADD COLUMN "education_level_id" TEXT;
ALTER TABLE "chat_rooms" ADD COLUMN "education_level_id" TEXT;
ALTER TABLE "institution_level_communication_settings" ADD COLUMN "education_level_id" TEXT;

-- CreateIndex: education_levels
CREATE INDEX "education_levels_institution_id_idx" ON "education_levels"("institution_id");
CREATE UNIQUE INDEX "education_levels_institution_id_slug_key" ON "education_levels"("institution_id", "slug");

-- CreateIndex: level_grades
CREATE INDEX "level_grades_education_level_id_idx" ON "level_grades"("education_level_id");
CREATE UNIQUE INDEX "level_grades_education_level_id_name_key" ON "level_grades"("education_level_id", "name");

-- CreateIndex: consumer FKs
CREATE INDEX "courses_level_grade_id_idx" ON "courses"("level_grade_id");
CREATE INDEX "indicators_level_grade_id_idx" ON "indicators"("level_grade_id");
CREATE INDEX "chat_rooms_education_level_id_idx" ON "chat_rooms"("education_level_id");
CREATE INDEX "institution_level_communication_settings_education_level_id_idx" ON "institution_level_communication_settings"("education_level_id");
CREATE INDEX "user_level_roles_education_level_id_idx" ON "user_level_roles"("education_level_id");

-- CreateIndex: new unique constraints
CREATE UNIQUE INDEX "user_level_roles_user_id_education_level_id_role_key" ON "user_level_roles"("user_id", "education_level_id", "role");

-- CreateIndex: partial unique index for ILCS (manually managed — Prisma @@unique does not support WHERE)
CREATE UNIQUE INDEX "idx_ilcs_institution_id_education_level_id" ON "institution_level_communication_settings"("institution_id", "education_level_id") WHERE education_level_id IS NOT NULL;

-- AddForeignKey: education_levels -> institutions
ALTER TABLE "education_levels" ADD CONSTRAINT "education_levels_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: level_grades -> education_levels
ALTER TABLE "level_grades" ADD CONSTRAINT "level_grades_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: courses -> level_grades
ALTER TABLE "courses" ADD CONSTRAINT "courses_level_grade_id_fkey" FOREIGN KEY ("level_grade_id") REFERENCES "level_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: indicators -> level_grades
ALTER TABLE "indicators" ADD CONSTRAINT "indicators_level_grade_id_fkey" FOREIGN KEY ("level_grade_id") REFERENCES "level_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: user_level_roles -> education_levels
ALTER TABLE "user_level_roles" ADD CONSTRAINT "user_level_roles_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: chat_rooms -> education_levels
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: institution_level_communication_settings -> education_levels
ALTER TABLE "institution_level_communication_settings" ADD CONSTRAINT "institution_level_communication_settings_education_level_i_fkey" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
