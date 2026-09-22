-- Realign the Category taxonomy with the sections a visitor actually sees on
-- the homepage, so an editor picking "Chuyên mục" is picking a name they can
-- recognise on the live site instead of an abstract subject label.
--
-- Rows are RENAMED in place wherever there is a natural 1:1 (Article.categoryId
-- keeps pointing at the same row, no article is left unclassified), and the
-- leftovers are merged into their nearest new home before being dropped.

-- 1. Rename the rows that survive, in homepage order.
UPDATE "Category" SET name = 'Tiêu điểm',           slug = 'tieu-diem',            "order" = 0 WHERE slug = 'dai-hoi-xii';
UPDATE "Category" SET name = 'Phong trào',          slug = 'phong-trao',           "order" = 1 WHERE slug = 'tinh-nguyen';
UPDATE "Category" SET name = 'Dòng chảy sinh viên', slug = 'dong-chay-sinh-vien',  "order" = 2 WHERE slug = 'chan-dung';
UPDATE "Category" SET name = 'Tin từ cơ sở',        slug = 'tin-tu-co-so',         "order" = 3 WHERE slug = 'hoi-nhap';
UPDATE "Category" SET name = 'Video và phóng sự',   slug = 'video-phong-su',       "order" = 4 WHERE slug = 'phong-su';
UPDATE "Category" SET                                                              "order" = 5 WHERE slug = 'sinh-vien-5-tot';
UPDATE "Category" SET                                                              "order" = 6 WHERE slug = 'hoi-nghi';
UPDATE "Category" SET                                                              "order" = 7 WHERE slug = 'dao-tao';
UPDATE "Category" SET name = 'Văn bản — hướng dẫn', slug = 'van-ban-huong-dan',    "order" = 8 WHERE slug = 'huong-dan';

-- 2. Move everything off the categories being retired.
UPDATE "Article" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
 WHERE "categoryId" IN (SELECT id FROM "Category" WHERE slug = 'cong-dong');
UPDATE "Article" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'dong-chay-sinh-vien')
 WHERE "categoryId" IN (SELECT id FROM "Category" WHERE slug IN ('nghien-cuu', 'khoa-hoc'));

UPDATE "Video" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
 WHERE "categoryId" IN (SELECT id FROM "Category" WHERE slug = 'cong-dong');
UPDATE "Video" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'dong-chay-sinh-vien')
 WHERE "categoryId" IN (SELECT id FROM "Category" WHERE slug IN ('nghien-cuu', 'khoa-hoc'));

UPDATE "Source" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
 WHERE "categoryId" IN (SELECT id FROM "Category" WHERE slug = 'cong-dong');
UPDATE "Source" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'dong-chay-sinh-vien')
 WHERE "categoryId" IN (SELECT id FROM "Category" WHERE slug IN ('nghien-cuu', 'khoa-hoc'));

-- `ActivityStatistic` is uniquely keyed on (provinceId, categoryId, period),
-- so remap only where the destination has no row for that key yet and drop
-- the rest — the retired categories' series are duplicates of a kept one by
-- definition once the two categories have been merged.
UPDATE "ActivityStatistic" a
   SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'dong-chay-sinh-vien')
 WHERE a."categoryId" IN (SELECT id FROM "Category" WHERE slug IN ('nghien-cuu', 'khoa-hoc'))
   AND NOT EXISTS (
     SELECT 1 FROM "ActivityStatistic" b
      WHERE b."provinceId" = a."provinceId"
        AND b.period = a.period
        AND b."categoryId" = (SELECT id FROM "Category" WHERE slug = 'dong-chay-sinh-vien')
   );
UPDATE "ActivityStatistic" a
   SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
 WHERE a."categoryId" IN (SELECT id FROM "Category" WHERE slug = 'cong-dong')
   AND NOT EXISTS (
     SELECT 1 FROM "ActivityStatistic" b
      WHERE b."provinceId" = a."provinceId"
        AND b.period = a.period
        AND b."categoryId" = (SELECT id FROM "Category" WHERE slug = 'phong-trao')
   );
DELETE FROM "ActivityStatistic"
 WHERE "categoryId" IN (SELECT id FROM "Category" WHERE slug IN ('cong-dong', 'nghien-cuu', 'khoa-hoc'));

-- 3. Drop the now-empty categories.
DELETE FROM "Category" WHERE slug IN ('cong-dong', 'nghien-cuu', 'khoa-hoc');
