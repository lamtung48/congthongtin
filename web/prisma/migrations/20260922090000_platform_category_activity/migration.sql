-- Nền tảng Hoạt động (hoatdong.hoisinhvien.com.vn) có danh mục riêng để trang chủ
-- đặt nó cạnh Đào tạo / Hội nghị trong dải "Nền tảng số" dưới Hero.
-- Tách khỏi migration chèn dữ liệu: giá trị enum mới chỉ dùng được sau khi đã commit.
ALTER TYPE "PlatformCategory" ADD VALUE IF NOT EXISTS 'ACTIVITY';
