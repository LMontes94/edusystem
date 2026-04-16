-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'ON_LEAVE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "leave_start_date" TIMESTAMP(3);
