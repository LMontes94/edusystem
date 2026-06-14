-- CreateEnum
CREATE TYPE "SchoolYearStatus" AS ENUM ('PLANNING', 'ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "school_years" ADD COLUMN     "status" "SchoolYearStatus";
