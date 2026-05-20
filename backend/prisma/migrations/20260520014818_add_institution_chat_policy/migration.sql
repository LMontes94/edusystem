-- CreateTable
CREATE TABLE "institution_chat_policies" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "guardians_can_message_teachers" BOOLEAN NOT NULL DEFAULT true,
    "guardians_can_message_directors" BOOLEAN NOT NULL DEFAULT true,
    "guardians_can_message_secretariat" BOOLEAN NOT NULL DEFAULT true,
    "guardians_can_message_admin" BOOLEAN NOT NULL DEFAULT true,
    "teachers_can_message_guardians" BOOLEAN NOT NULL DEFAULT true,
    "teachers_can_message_other_teachers" BOOLEAN NOT NULL DEFAULT false,
    "teachers_can_message_students" BOOLEAN NOT NULL DEFAULT false,
    "students_can_message_teachers" BOOLEAN NOT NULL DEFAULT false,
    "students_can_message_other_students" BOOLEAN NOT NULL DEFAULT false,
    "students_can_create_rooms" BOOLEAN NOT NULL DEFAULT false,
    "require_moderation_for_new_rooms" BOOLEAN NOT NULL DEFAULT false,
    "allow_anonymous_reporting" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_chat_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institution_chat_policies_institution_id_key" ON "institution_chat_policies"("institution_id");

-- CreateIndex
CREATE INDEX "institution_chat_policies_institution_id_idx" ON "institution_chat_policies"("institution_id");

-- AddForeignKey
ALTER TABLE "institution_chat_policies" ADD CONSTRAINT "institution_chat_policies_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
