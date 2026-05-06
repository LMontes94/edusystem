/*
  Warnings:

  - A unique constraint covering the columns `[student_id,course_id,date,sport_group_id]` on the table `attendances` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "attendances_student_id_course_id_date_key";

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "sport_group_id" TEXT;

-- CreateTable
CREATE TABLE "sports" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_groups" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "sport_id" TEXT NOT NULL,
    "school_year_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "sport_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_group_teachers" (
    "sport_group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "sport_group_teachers_pkey" PRIMARY KEY ("sport_group_id","user_id")
);

-- CreateTable
CREATE TABLE "sport_group_students" (
    "sport_group_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,

    CONSTRAINT "sport_group_students_pkey" PRIMARY KEY ("sport_group_id","student_id")
);

-- CreateIndex
CREATE INDEX "attendances_sport_group_id_idx" ON "attendances"("sport_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_student_id_course_id_date_sport_group_id_key" ON "attendances"("student_id", "course_id", "date", "sport_group_id");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_sport_group_id_fkey" FOREIGN KEY ("sport_group_id") REFERENCES "sport_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sports" ADD CONSTRAINT "sports_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_groups" ADD CONSTRAINT "sport_groups_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_groups" ADD CONSTRAINT "sport_groups_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_groups" ADD CONSTRAINT "sport_groups_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_group_teachers" ADD CONSTRAINT "sport_group_teachers_sport_group_id_fkey" FOREIGN KEY ("sport_group_id") REFERENCES "sport_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_group_teachers" ADD CONSTRAINT "sport_group_teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_group_students" ADD CONSTRAINT "sport_group_students_sport_group_id_fkey" FOREIGN KEY ("sport_group_id") REFERENCES "sport_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_group_students" ADD CONSTRAINT "sport_group_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
