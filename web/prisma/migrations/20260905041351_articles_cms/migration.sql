-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ARCHIVE_ARTICLE';
ALTER TYPE "AuditAction" ADD VALUE 'RESTORE_ARTICLE';
ALTER TYPE "AuditAction" ADD VALUE 'RESTORE_REVISION';

-- CreateTable
CREATE TABLE "ArticleSlugHistory" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleSlugHistory_slug_key" ON "ArticleSlugHistory"("slug");

-- CreateIndex
CREATE INDEX "ArticleSlugHistory_articleId_idx" ON "ArticleSlugHistory"("articleId");

-- AddForeignKey
ALTER TABLE "ArticleSlugHistory" ADD CONSTRAINT "ArticleSlugHistory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

