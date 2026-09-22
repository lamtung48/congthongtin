-- Hot-linked image provider (image stays on the source CDN, never stored).
ALTER TYPE "MediaProvider" ADD VALUE 'EXTERNAL';

-- Collector: per-run item cap + optional full-body extraction.
ALTER TABLE "Source" ADD COLUMN "maxItemsPerSync" INTEGER;
ALTER TABLE "Source" ADD COLUMN "fetchFullBody" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Source" ADD COLUMN "contentSelector" TEXT;

-- ExternalItem: extracted body + source cover image.
ALTER TABLE "ExternalItem" ADD COLUMN "bodyBlocks" JSONB;
ALTER TABLE "ExternalItem" ADD COLUMN "coverImageUrl" TEXT;
