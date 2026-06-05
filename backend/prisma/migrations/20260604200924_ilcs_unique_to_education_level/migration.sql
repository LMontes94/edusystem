-- Drop the old unique constraint on (institution_id, level)
DROP INDEX "institution_level_communication_settings_institution_id_lev_key";

-- Drop the partial unique index from Phase 1 add_education_levels migration
DROP INDEX IF EXISTS "idx_ilcs_institution_id_education_level_id";

-- Make education_level_id required
ALTER TABLE "institution_level_communication_settings" ALTER COLUMN "education_level_id" SET NOT NULL;

-- Create new unique constraint on (institution_id, education_level_id)
CREATE UNIQUE INDEX "institution_level_communication_settings_institution_id_edu_key" ON "institution_level_communication_settings"("institution_id", "education_level_id");
