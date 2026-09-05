-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'MANAGER', 'CONTRIBUTOR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE 'CREATE_USER';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_USER';
ALTER TYPE "AuditAction" ADD VALUE 'CHANGE_ROLE';
ALTER TYPE "AuditAction" ADD VALUE 'DISABLE_USER';
ALTER TYPE "AuditAction" ADD VALUE 'ENABLE_USER';
ALTER TYPE "AuditAction" ADD VALUE 'RESET_PASSWORD';
ALTER TYPE "AuditAction" ADD VALUE 'CREATE_ARTICLE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_ARTICLE';
ALTER TYPE "AuditAction" ADD VALUE 'SUBMIT_REVIEW';
ALTER TYPE "AuditAction" ADD VALUE 'APPROVE_ARTICLE';
ALTER TYPE "AuditAction" ADD VALUE 'RETURN_ARTICLE';
ALTER TYPE "AuditAction" ADD VALUE 'PUBLISH_ARTICLE';
ALTER TYPE "AuditAction" ADD VALUE 'UNPUBLISH_ARTICLE';
ALTER TYPE "AuditAction" ADD VALUE 'SCHEDULE_ARTICLE';

-- AlterEnum
BEGIN;
CREATE TYPE "UserStatus_new" AS ENUM ('ACTIVE', 'DISABLED');
ALTER TABLE "public"."User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus_new" USING ("status"::text::"UserStatus_new");
ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "public"."UserStatus_old";
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_roleId_fkey";

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_userId_fkey";

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "returnNote" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'CONTRIBUTOR',
ADD COLUMN     "username" TEXT,
ALTER COLUMN "passwordHash" SET NOT NULL;

-- DropTable
DROP TABLE "Role";

-- DropTable
DROP TABLE "UserRole";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

