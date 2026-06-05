-- Make ChatRoom.education_level_id required
ALTER TABLE "chat_rooms" ALTER COLUMN "education_level_id" SET NOT NULL;
