-- Gop hai chuyen muc "Phong trào" + "Sinh viên 5 tốt" thanh mot:
-- "Phong trào Sinh viên 5 tốt". Giu lai hang `phong-trao` (order 1, thap hon)
-- lam hang song sot, doi ten + slug, chuyen moi tham chieu cua
-- `sinh-vien-5-tot` sang roi xoa hang do.
--
-- Diem kho duy nhat la `ActivityStatistic`: bang nay co
-- UNIQUE ("provinceId", "categoryId", period) va CA HAI chuyen muc deu co du
-- 32 tinh cho cung mot ky. UPDATE thang categoryId se dung unique ngay lap
-- tuc; con de FK `ON DELETE SET NULL` tu xu ly thi con te hon - categoryId
-- NULL la hang TONG cua tinh do (xem ghi chu tren model ActivityStatistic),
-- nen se de lai 32 hang tong gia. Vi vay phai CONG so lieu vao hang song sot
-- theo tung (tinh, ky) truoc, roi moi xoa.

-- 1. Cong so lieu cua "Sinh viên 5 tốt" vao hang tuong ung cua "Phong trào".
--    Khong dung COALESCE(...,0) o ca hai ve: mot cot NULL o CA HAI ben nghia
--    la "chua bao cao", khac han voi 0, nen phai giu NULL.
UPDATE "ActivityStatistic" AS keep
SET "activityCount" = CASE WHEN keep."activityCount" IS NULL AND src."activityCount" IS NULL THEN NULL
                           ELSE COALESCE(keep."activityCount", 0) + COALESCE(src."activityCount", 0) END,
    "articleCount" = CASE WHEN keep."articleCount" IS NULL AND src."articleCount" IS NULL THEN NULL
                          ELSE COALESCE(keep."articleCount", 0) + COALESCE(src."articleCount", 0) END,
    "organizationCount" = CASE WHEN keep."organizationCount" IS NULL AND src."organizationCount" IS NULL THEN NULL
                               ELSE COALESCE(keep."organizationCount", 0) + COALESCE(src."organizationCount", 0) END,
    "participantCount" = CASE WHEN keep."participantCount" IS NULL AND src."participantCount" IS NULL THEN NULL
                              ELSE COALESCE(keep."participantCount", 0) + COALESCE(src."participantCount", 0) END,
    "reported" = keep."reported" OR src."reported",
    "updatedAt" = NOW()
FROM "ActivityStatistic" AS src
WHERE keep."categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
  AND src."categoryId"  = (SELECT id FROM "Category" WHERE slug = 'sinh-vien-5-tot')
  AND keep."provinceId" = src."provinceId"
  AND keep."period"     = src."period";

-- 2. Hang cua "Sinh viên 5 tốt" khong co doi tac (tinh/ky ma "Phong trào"
--    chua co) thi chuyen thang sang - khong dung unique.
UPDATE "ActivityStatistic" AS s
SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
WHERE s."categoryId" = (SELECT id FROM "Category" WHERE slug = 'sinh-vien-5-tot')
  AND NOT EXISTS (
    SELECT 1 FROM "ActivityStatistic" k
    WHERE k."categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
      AND k."provinceId" = s."provinceId"
      AND k."period" = s."period"
  );

-- 3. Nhung hang da duoc cong vao buoc 1 thi bo di.
DELETE FROM "ActivityStatistic"
WHERE "categoryId" = (SELECT id FROM "Category" WHERE slug = 'sinh-vien-5-tot');

-- 4. Cac bang con lai chi la FK don gian, khong co unique nao chan.
UPDATE "Article" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
WHERE "categoryId" = (SELECT id FROM "Category" WHERE slug = 'sinh-vien-5-tot');

UPDATE "Video" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
WHERE "categoryId" = (SELECT id FROM "Category" WHERE slug = 'sinh-vien-5-tot');

UPDATE "Source" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
WHERE "categoryId" = (SELECT id FROM "Category" WHERE slug = 'sinh-vien-5-tot');

-- 5. Doi ten + slug hang song sot. Slug moi khop voi ten hien thi; duong dan
--    cu /chuyen-muc/phong-trao va /chuyen-muc/sinh-vien-5-tot se khong con
--    (khong co bang lich su slug cho Category nhu Article co).
UPDATE "Category"
SET slug = 'phong-trao-sinh-vien-5-tot',
    name = 'Phong trào Sinh viên 5 tốt',
    "updatedAt" = NOW()
WHERE slug = 'phong-trao';

-- 6. Xoa hang thua.
DELETE FROM "Category" WHERE slug = 'sinh-vien-5-tot';
