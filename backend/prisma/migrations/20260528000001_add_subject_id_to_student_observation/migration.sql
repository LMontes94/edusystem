-- AlterTable: Add subjectId to student_observations
ALTER TABLE "student_observations" ADD COLUMN "subject_id" TEXT;

-- CreateIndex: Add index on subject_id
CREATE INDEX "student_observations_subject_id_idx" ON "student_observations"("subject_id");

-- Drop existing unique constraint
ALTER TABLE "student_observations" DROP CONSTRAINT IF EXISTS "student_observations_student_id_period_id_course_id_key";

-- Create new unique constraint with subjectId
ALTER TABLE "student_observations" ADD CONSTRAINT "student_observations_student_id_period_id_course_id_su_key" UNIQUE ("student_id", "period_id", "course_id", "subject_id");

-- AddForeignKey
ALTER TABLE "student_observations" ADD CONSTRAINT "student_observations_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
