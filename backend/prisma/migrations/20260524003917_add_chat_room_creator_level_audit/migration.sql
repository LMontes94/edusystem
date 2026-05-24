-- AlterTable
ALTER TABLE "chat_room_members" ADD COLUMN     "added_by_id" TEXT;

-- AlterTable
ALTER TABLE "chat_rooms" ADD COLUMN     "creator_id" TEXT,
ADD COLUMN     "level" "Level";

-- CreateTable
CREATE TABLE "institution_level_communication_settings" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "guardian_can_start_conversation" BOOLEAN NOT NULL DEFAULT false,
    "guardian_can_add_participants" BOOLEAN NOT NULL DEFAULT false,
    "guardian_can_export_pdf" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_level_communication_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_audit_logs" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "institution_level_communication_settings_institution_id_idx" ON "institution_level_communication_settings"("institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "institution_level_communication_settings_institution_id_lev_key" ON "institution_level_communication_settings"("institution_id", "level");

-- CreateIndex
CREATE INDEX "chat_audit_logs_room_id_idx" ON "chat_audit_logs"("room_id");

-- CreateIndex
CREATE INDEX "chat_audit_logs_actor_id_idx" ON "chat_audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_level_communication_settings" ADD CONSTRAINT "institution_level_communication_settings_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_audit_logs" ADD CONSTRAINT "chat_audit_logs_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_audit_logs" ADD CONSTRAINT "chat_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
