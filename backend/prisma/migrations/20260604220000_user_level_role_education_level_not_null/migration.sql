-- Make UserLevelRole.education_level_id required
ALTER TABLE "user_level_roles" ALTER COLUMN "education_level_id" SET NOT NULL;
