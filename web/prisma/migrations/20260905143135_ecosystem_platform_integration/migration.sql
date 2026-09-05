-- CreateEnum
CREATE TYPE "PlatformIntegrationType" AS ENUM ('EXTERNAL_LINK', 'API', 'SSO_READY');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_PLATFORM';
ALTER TYPE "AuditAction" ADD VALUE 'ENABLE_PLATFORM';
ALTER TYPE "AuditAction" ADD VALUE 'DISABLE_PLATFORM';

-- AlterTable
-- `liveActivityNote` is renamed (not dropped) to `currentActivity` to
-- preserve the existing "Hội nghị" platform's live-activity copy.
ALTER TABLE "Platform" RENAME COLUMN "liveActivityNote" TO "currentActivity";
ALTER TABLE "Platform" ADD COLUMN     "apiBaseUrl" TEXT,
ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "currentActivityUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "iconMediaId" TEXT,
ADD COLUMN     "integrationType" "PlatformIntegrationType" NOT NULL DEFAULT 'EXTERNAL_LINK',
ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Platform_category_idx" ON "Platform"("category");

-- CreateIndex
CREATE INDEX "Platform_isEnabled_order_idx" ON "Platform"("isEnabled", "order");

-- AddForeignKey
ALTER TABLE "Platform" ADD CONSTRAINT "Platform_iconMediaId_fkey" FOREIGN KEY ("iconMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
