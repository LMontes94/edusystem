-- CreateTable
CREATE TABLE "syllabuses" (
    "id" TEXT NOT NULL,
    "course_subject_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contents" TEXT NOT NULL,
    "bibliography" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_subjects" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "school_year_id" TEXT NOT NULL,
    "initial_sabers" TEXT,
    "march" TEXT,
    "august" TEXT,
    "november" TEXT,
    "december" TEXT,
    "february" TEXT,
    "final_score" TEXT,
    "closing_sabers" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "syllabuses_course_subject_id_period_id_key" ON "syllabuses"("course_subject_id", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_subjects_student_id_subject_id_school_year_id_key" ON "pending_subjects"("student_id", "subject_id", "school_year_id");

-- AddForeignKey
ALTER TABLE "syllabuses" ADD CONSTRAINT "syllabuses_course_subject_id_fkey" FOREIGN KEY ("course_subject_id") REFERENCES "course_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabuses" ADD CONSTRAINT "syllabuses_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_subjects" ADD CONSTRAINT "pending_subjects_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_subjects" ADD CONSTRAINT "pending_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_subjects" ADD CONSTRAINT "pending_subjects_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_subjects" ADD CONSTRAINT "pending_subjects_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
