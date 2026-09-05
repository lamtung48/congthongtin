-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('FACEBOOK_PAGE', 'RSS', 'WEBSITE', 'YOUTUBE', 'MANUAL_EXTERNAL');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ExternalItemStatus" AS ENUM ('PENDING_REVIEW', 'ASSIGNED', 'CONVERTED', 'IGNORED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_SOURCE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_SOURCE';
ALTER TYPE "AuditAction" ADD VALUE 'SYNC_SOURCE';
ALTER TYPE "AuditAction" ADD VALUE 'IGNORE_EXTERNAL';
ALTER TYPE "AuditAction" ADD VALUE 'ASSIGN_EXTERNAL';
ALTER TYPE "AuditAction" ADD VALUE 'CONVERT_EXTERNAL';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EXTERNAL_ITEM_ASSIGNED';

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "status" "SourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "externalUrl" TEXT,
    "externalId" TEXT,
    "encryptedCredential" TEXT,
    "includeHashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeHashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncItemCount" INTEGER,
    "lastError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "excerpt" TEXT,
    "contentText" TEXT NOT NULL,
    "normalizedContentHash" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ExternalItemStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "assignedToId" TEXT,
    "articleId" TEXT,
    "ignoredAt" TIMESTAMP(3),
    "ignoredById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Source_type_isEnabled_idx" ON "Source"("type", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalItem_articleId_key" ON "ExternalItem"("articleId");

-- CreateIndex
CREATE INDEX "ExternalItem_status_publishedAt_idx" ON "ExternalItem"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "ExternalItem_assignedToId_idx" ON "ExternalItem"("assignedToId");

-- CreateIndex
CREATE INDEX "ExternalItem_url_idx" ON "ExternalItem"("url");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalItem_sourceId_externalId_key" ON "ExternalItem"("sourceId", "externalId");

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalItem" ADD CONSTRAINT "ExternalItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalItem" ADD CONSTRAINT "ExternalItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalItem" ADD CONSTRAINT "ExternalItem_ignoredById_fkey" FOREIGN KEY ("ignoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalItem" ADD CONSTRAINT "ExternalItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalItem" ADD CONSTRAINT "ExternalItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
