-- CreateEnum
CREATE TYPE "StudentSubjectType" AS ENUM ('REGULAR', 'RECURSE', 'EXEMPT');

-- CreateTable
CREATE TABLE "student_course_subjects" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_subject_id" TEXT NOT NULL,
    "school_year_id" TEXT NOT NULL,
    "type" "StudentSubjectType" NOT NULL DEFAULT 'REGULAR',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_course_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_course_subjects_student_id_course_subject_id_school_key" ON "student_course_subjects"("student_id", "course_subject_id", "school_year_id");

-- AddForeignKey
ALTER TABLE "student_course_subjects" ADD CONSTRAINT "student_course_subjects_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_course_subjects" ADD CONSTRAINT "student_course_subjects_course_subject_id_fkey" FOREIGN KEY ("course_subject_id") REFERENCES "course_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_course_subjects" ADD CONSTRAINT "student_course_subjects_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_course_subjects" ADD CONSTRAINT "student_course_subjects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
