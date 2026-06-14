-- CreateTable
CREATE TABLE "promotion_results" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "from_school_year_id" TEXT NOT NULL,
    "to_school_year_id" TEXT,
    "from_course_student_id" TEXT NOT NULL,
    "to_course_student_id" TEXT,
    "from_level_grade_id" TEXT,
    "to_level_grade_id" TEXT,
    "result" "PromotionOutcome" NOT NULL,
    "criteria" JSONB NOT NULL,
    "evaluation_snapshot" JSONB NOT NULL DEFAULT '{}',
    "reason" VARCHAR(500),
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "decided_by_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_results_institution_id_idx" ON "promotion_results"("institution_id");

-- CreateIndex
CREATE INDEX "promotion_results_student_id_idx" ON "promotion_results"("student_id");

-- CreateIndex
CREATE INDEX "promotion_results_student_id_from_school_year_id_idx" ON "promotion_results"("student_id", "from_school_year_id");

-- CreateIndex
CREATE INDEX "promotion_results_from_school_year_id_idx" ON "promotion_results"("from_school_year_id");

-- CreateIndex
CREATE INDEX "promotion_results_to_school_year_id_idx" ON "promotion_results"("to_school_year_id");

-- CreateIndex
CREATE INDEX "promotion_results_result_idx" ON "promotion_results"("result");

-- AddForeignKey
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_from_school_year_id_fkey" FOREIGN KEY ("from_school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_to_school_year_id_fkey" FOREIGN KEY ("to_school_year_id") REFERENCES "school_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_from_course_student_id_fkey" FOREIGN KEY ("from_course_student_id") REFERENCES "course_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_to_course_student_id_fkey" FOREIGN KEY ("to_course_student_id") REFERENCES "course_students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_results" ADD CONSTRAINT "promotion_results_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateView
CREATE VIEW "effective_promotion_results" AS
SELECT DISTINCT ON (student_id, from_school_year_id)
  *
FROM "promotion_results"
ORDER BY
  student_id,
  from_school_year_id,
  decided_at DESC,
  id DESC;

-- CreateIndex (supporting index for the view, DESC order for DISTINCT ON)
CREATE INDEX "idx_promotion_results_effective"
ON "promotion_results" (student_id, from_school_year_id, decided_at DESC, id DESC);
