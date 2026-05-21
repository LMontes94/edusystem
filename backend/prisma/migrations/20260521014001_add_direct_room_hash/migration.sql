-- AlterTable
ALTER TABLE "chat_rooms" ADD COLUMN     "direct_room_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_direct_room_hash_key" ON "chat_rooms"("direct_room_hash");
