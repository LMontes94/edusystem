/*
  Warnings:

  - You are about to drop the column `read_by` on the `chat_messages` table. All the data in the column will be lost.

  Migration strategy:
  1. Create new table and add column
  2. Backfill data from read_by JSON array to chat_message_reads relation table
  3. Backfill unread_count on chat_room_members
  4. Drop read_by column (data preserved in chat_message_reads)
*/

-- CreateTable
CREATE TABLE "chat_message_reads" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_reads_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "chat_room_members" ADD COLUMN     "unread_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "chat_message_reads_user_id_idx" ON "chat_message_reads"("user_id");

-- CreateIndex
CREATE INDEX "chat_message_reads_message_id_idx" ON "chat_message_reads"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_reads_message_id_user_id_key" ON "chat_message_reads"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "chat_room_members_user_id_idx" ON "chat_room_members"("user_id");

-- AddForeignKey
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: migrate existing read_by data to chat_message_reads
INSERT INTO chat_message_reads (id, message_id, user_id, read_at)
SELECT gen_random_uuid(), cm.id, unnest(cm.read_by), cm.sent_at
FROM chat_messages cm
WHERE array_length(cm.read_by, 1) > 0
ON CONFLICT (message_id, user_id) DO NOTHING;

-- Backfill: populate unread_count on all existing memberships
-- Count messages in each room that each member has NOT read
UPDATE chat_room_members crm
SET unread_count = (
  SELECT COUNT(*)
  FROM chat_messages cm
  WHERE cm.room_id = crm.room_id
    AND cm.sender_id != crm.user_id
    AND NOT EXISTS (
      SELECT 1 FROM chat_message_reads cmr
      WHERE cmr.message_id = cm.id AND cmr.user_id = crm.user_id
    )
);

-- AlterTable: drop read_by column (data preserved in chat_message_reads)
ALTER TABLE "chat_messages" DROP COLUMN "read_by";
