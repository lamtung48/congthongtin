-- Hàng Platform cho nền tảng Hoạt động — để triển khai là có ngay trên trang chủ,
-- không cần chạy seed trên production. Không đè lên hàng đã có (Admin có thể đã
-- sửa ở /admin/platforms): ON CONFLICT DO NOTHING.
INSERT INTO "Platform" ("id", "slug", "name", "url", "description", "category", "status", "accessLevel", "metric", "integrationType", "order", "isEnabled", "createdAt", "updatedAt")
VALUES (
  'plt_hoat_dong',
  'hoat-dong',
  'Nền tảng Hoạt động',
  'https://hoatdong.hoisinhvien.com.vn',
  'Khám phá và đăng ký hoạt động, điểm danh bằng QR, tích luỹ điểm rèn luyện và Thẻ Hội viên.',
  'ACTIVITY',
  'ACTIVE',
  'Đăng nhập bằng tài khoản HSV-ID',
  'Học tập · Tình nguyện · Văn nghệ',
  'EXTERNAL_LINK',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
