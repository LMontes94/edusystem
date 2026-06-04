-- AlterEnum
CREATE TYPE "PendingSubjectStatus" AS ENUM ('ENROLLED', 'COMPLETED', 'NOT_COMPLETED');

-- AlterTable: add new columns
ALTER TABLE "pending_subjects" ADD COLUMN "closing_grade_id" TEXT;
ALTER TABLE "pending_subjects" ADD COLUMN "status" "PendingSubjectStatus" NOT NULL DEFAULT 'ENROLLED';

-- Drop old unique index (created by Prisma @@unique as index, not constraint)
DROP INDEX IF EXISTS "pending_subjects_student_id_subject_id_school_year_id_key";

-- Add new unique constraint
ALTER TABLE "pending_subjects" ADD CONSTRAINT "pending_subjects_closing_grade_id_key" UNIQUE ("closing_grade_id");

-- AddForeignKey
ALTER TABLE "pending_subjects" ADD CONSTRAINT "pending_subjects_closing_grade_id_fkey" FOREIGN KEY ("closing_grade_id") REFERENCES "closing_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "pending_subjects_student_id_idx" ON "pending_subjects"("student_id");
CREATE INDEX "pending_subjects_school_year_id_idx" ON "pending_subjects"("school_year_id");
