-- Public activities mirrored from the Hoạt động platform for the homepage's
-- "Bản đồ phong trào" (see model PlatformActivity in schema.prisma).
CREATE TABLE "PlatformActivity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "organizationName" TEXT NOT NULL,
    "organizationType" TEXT,
    "localityName" TEXT,
    "provinceId" TEXT,
    "overseasOrganizationId" TEXT,
    "status" TEXT NOT NULL,
    "tags" TEXT[],
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformActivity_provinceId_startAt_idx" ON "PlatformActivity"("provinceId", "startAt");
CREATE INDEX "PlatformActivity_overseasOrganizationId_startAt_idx" ON "PlatformActivity"("overseasOrganizationId", "startAt");

ALTER TABLE "PlatformActivity" ADD CONSTRAINT "PlatformActivity_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformActivity" ADD CONSTRAINT "PlatformActivity_overseasOrganizationId_fkey" FOREIGN KEY ("overseasOrganizationId") REFERENCES "OverseasOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
