-- AlterTable
ALTER TABLE "level_grades" ADD COLUMN     "is_graduating" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "next_level_grade_id" TEXT;

-- CreateIndex
CREATE INDEX "level_grades_next_level_grade_id_idx" ON "level_grades"("next_level_grade_id");

-- AddForeignKey
ALTER TABLE "level_grades" ADD CONSTRAINT "level_grades_next_level_grade_id_fkey" FOREIGN KEY ("next_level_grade_id") REFERENCES "level_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add CHECK constraint (raw SQL, not managed by Prisma)
ALTER TABLE "level_grades" ADD CONSTRAINT "level_grades_no_self_ref" CHECK (next_level_grade_id IS NULL OR next_level_grade_id <> id);
