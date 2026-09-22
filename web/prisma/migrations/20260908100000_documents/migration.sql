-- Muc "Tài liệu": van ban tai ve duoc, co nhan phan loai tu quan tri duoc.

-- MediaType duoc dung cho ca anh, video va nay ca van ban dinh kem. Postgres
-- khong cho them gia tri enum trong cung transaction voi cau lenh dung no,
-- nhung o day khong cau nao dung DOCUMENT nen an toan.
ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'DOCUMENT';

CREATE TABLE "DocumentLabel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentLabel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentLabel_slug_key" ON "DocumentLabel"("slug");

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "labelId" TEXT,
    "mediaId" TEXT,
    "externalUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Document_slug_key" ON "Document"("slug");
CREATE INDEX "Document_isPublished_issuedAt_idx" ON "Document"("isPublished", "issuedAt");
CREATE INDEX "Document_labelId_idx" ON "Document"("labelId");

ALTER TABLE "Document" ADD CONSTRAINT "Document_labelId_fkey"
    FOREIGN KEY ("labelId") REFERENCES "DocumentLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sau nhan khoi tao theo yeu cau. Quan tri vien them nhan moi qua giao dien,
-- khong can migration nao nua.
INSERT INTO "DocumentLabel" ("id", "slug", "name", "order", "updatedAt") VALUES
    ('doclabel-thong-bao',    'thong-bao',    'Thông báo',    0, NOW()),
    ('doclabel-ke-hoach',     'ke-hoach',     'Kế hoạch',     1, NOW()),
    ('doclabel-bao-cao',      'bao-cao',      'Báo cáo',      2, NOW()),
    ('doclabel-quyet-dinh',   'quyet-dinh',   'Quyết định',   3, NOW()),
    ('doclabel-quy-che',      'quy-che',      'Quy chế',      4, NOW()),
    ('doclabel-huong-dan',    'huong-dan',    'Hướng dẫn',    5, NOW());
