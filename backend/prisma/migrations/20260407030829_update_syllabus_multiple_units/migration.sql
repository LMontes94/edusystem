-- DropIndex
DROP INDEX "syllabuses_course_subject_id_period_id_key";

-- AlterTable
ALTER TABLE "syllabuses" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';
