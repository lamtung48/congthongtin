-- CreateEnum
CREATE TYPE "YoutubeVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'UPLOAD_VIDEO';
ALTER TYPE "AuditAction" ADD VALUE 'LINK_VIDEO';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_VIDEO';
ALTER TYPE "AuditAction" ADD VALUE 'CONNECT_YOUTUBE';
ALTER TYPE "AuditAction" ADD VALUE 'DISCONNECT_YOUTUBE';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "errorReason" TEXT,
ADD COLUMN     "visibility" "YoutubeVisibility";

-- CreateTable
CREATE TABLE "YoutubeConnection" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "channelId" TEXT NOT NULL,
    "channelTitle" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "connectedById" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeConnection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "YoutubeConnection" ADD CONSTRAINT "YoutubeConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
