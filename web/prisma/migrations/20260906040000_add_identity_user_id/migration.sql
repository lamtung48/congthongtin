-- AlterTable: shared-identity (hsv-id) link, nullable, backfilled lazily on login/reset.
ALTER TABLE "User" ADD COLUMN "identityUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_identityUserId_key" ON "User"("identityUserId");
