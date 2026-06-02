-- AlterEnum for PeriodType
ALTER TYPE "PeriodType" ADD VALUE 'CUATRIMESTRE';

-- CreateTable: closing_grades
CREATE TABLE "closing_grades" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_subject_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "closing_score" DECIMAL(5,2),
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopened_by_id" TEXT,
    "reopen_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closing_grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "closing_grades_student_id_course_subject_id_period_id_key" ON "closing_grades"("student_id", "course_subject_id", "period_id");
CREATE INDEX "closing_grades_period_id_idx" ON "closing_grades"("period_id");
CREATE INDEX "closing_grades_course_subject_id_idx" ON "closing_grades"("course_subject_id");

-- AddForeignKeys
ALTER TABLE "closing_grades" ADD CONSTRAINT "closing_grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "closing_grades" ADD CONSTRAINT "closing_grades_course_subject_id_fkey" FOREIGN KEY ("course_subject_id") REFERENCES "course_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "closing_grades" ADD CONSTRAINT "closing_grades_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "closing_grades" ADD CONSTRAINT "closing_grades_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "closing_grades" ADD CONSTRAINT "closing_grades_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
