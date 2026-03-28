/*
  Warnings:

  - A unique constraint covering the columns `[student_id,course_subject_id,period_id,type,date]` on the table `grades` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "grades_student_id_course_subject_id_period_id_type_date_key" ON "grades"("student_id", "course_subject_id", "period_id", "type", "date");
