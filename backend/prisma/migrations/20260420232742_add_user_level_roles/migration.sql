-- CreateTable
CREATE TABLE "user_level_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_level_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_level_roles_user_id_idx" ON "user_level_roles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_level_roles_user_id_level_role_key" ON "user_level_roles"("user_id", "level", "role");

-- AddForeignKey
ALTER TABLE "user_level_roles" ADD CONSTRAINT "user_level_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
