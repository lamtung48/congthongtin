-- Ảnh thumbnail tuỳ chỉnh cho video YouTube (ảnh lưu trên Google Drive).
-- NULL = dùng ảnh mặc định của YouTube. Xoá ảnh → tự về mặc định.
ALTER TABLE "MediaAsset" ADD COLUMN "thumbnailMediaId" TEXT;

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_thumbnailMediaId_fkey" FOREIGN KEY ("thumbnailMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
