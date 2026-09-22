-- Thẻ "Hoạt động" ở dải Nền tảng số: dòng số liệu đổi thành lời mời nâng hạng thẻ.
-- Chỉ đổi khi vẫn là chữ mặc định cũ — không đè chữ Admin đã sửa ở /admin/platforms.
UPDATE "Platform"
SET "metric" = 'Nâng hạng thẻ hội viên!', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'hoat-dong' AND "metric" = 'Học tập · Tình nguyện · Văn nghệ';

-- Thẻ "Hội nghị": conferenceAdapter giờ đọc danh sách hội nghị công khai
-- (GET {apiBaseUrl}/public/conferences) qua tên miền public của Hội nghị, thay
-- cho /ecosystem/status gọi thẳng container hoinghi-api-1 trên mạng "edge".
-- Chỉ đổi đúng giá trị production cũ; môi trường khác không bị ảnh hưởng.
UPDATE "Platform"
SET "apiBaseUrl" = 'https://hoinghi.hoisinhvien.com.vn/api', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'hoi-nghi' AND "apiBaseUrl" = 'http://hoinghi-api-1:4000/ecosystem';
