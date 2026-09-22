-- Site-wide appearance settings (singleton row, id = 'default').
-- Adding the table only; the row itself is created lazily by the first save
-- (`siteAppearanceRepository.set` upserts), so a fresh install and an
-- existing one both start from the design system's default white.
CREATE TABLE "SiteAppearance" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "pageBackground" TEXT NOT NULL DEFAULT '#ffffff',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SiteAppearance_pkey" PRIMARY KEY ("id")
);
