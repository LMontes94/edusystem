-- AlterTable
ALTER TABLE "school_years" ADD COLUMN     "promotion_heartbeat_at" TIMESTAMP(3),
ADD COLUMN     "promotion_locked_at" TIMESTAMP(3),
ADD COLUMN     "promotion_status" "PromotionStatus",
ADD COLUMN     "promotion_summary" JSONB,
ADD COLUMN     "promotion_summary_stale" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "school_years_promotion_status_idx" ON "school_years"("promotion_status");
