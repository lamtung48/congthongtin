# Homepage V2 kiểm định toàn bộ

_Started 2026-09-03 12:33 UTC_

---

## User

Phần việc 5/5 — Kiểm định toàn bộ PC và hoàn thiện hồ sơ bàn giao
Nội dung gửi Claude Design:
Rà soát toàn bộ Homepage V2 sau bốn phần việc trước. Đây là vòng tích hợp và nghiệm thu PC, không phải vòng sáng tạo thêm concept. Không tự ý thay font, đổi cấu trúc, thêm section hoặc mở rộng tính năng.

1. Kiểm tra bố cục tại bốn kích thước
- 1280×800.
- 1366×768.
- 1440×900.
- 1920×1080.
Ở mỗi kích thước, kiểm tra:
- Header không cắt nội dung.
- Hero không tràn tiêu đề.
- Container và đường căn nhất quán.
- Không có cuộn ngang toàn trang.
- Rail ngang chỉ cuộn trong phạm vi chủ đích.
- Không có khoảng trắng do reveal.
- Không có vùng nền tối kéo dài sau pin.
- Không có chữ, caption, badge hoặc nút bị cắt.
- Không có card cao bất thường vì nội dung kỹ thuật còn sót.
- Header sticky không che tiêu đề, focus hoặc overlay.
2. Kiểm thử nội dung khó
Thử với:
- Tiêu đề dài hơn mẫu khoảng 50%.
- Ảnh dọc, ảnh ngang và ảnh thiếu.
- Mô tả dài hoặc không có mô tả.
- Tên đơn vị dài.
- Số liệu lớn.
- Không có video.
- Không có sự kiện live.
- Một chuyên mục không có tin.
- Một tỉnh chưa có dữ liệu.
- Nền tảng bảo trì.
Không chỉ nghiệm thu với bộ nội dung “đẹp” ban đầu.
3. Kiểm thử tương tác xuyên suốt
Thực hiện đầy đủ:
1. Mở và đóng tìm kiếm.
2. Di chuyển qua toàn bộ Dòng chảy sinh viên.
3. Lọc và tải thêm tin.
4. Chọn và phát video.
5. Chọn tỉnh, đổi chuyên mục, quay lại toàn quốc.
6. Truy cập từng ô nền tảng.
7. Chuyển rail sự kiện.
8. Mở, chuyển và đóng gallery.
9. Lọc Tin từ cơ sở.
10. Kiểm tra newsletter ở các trạng thái mô phỏng.
11. Mở bài rồi Back về homepage.
Ghi rõ thao tác nào hoạt động thật, thao tác nào là mô phỏng và thao tác nào còn thiếu.
4. Accessibility và motion
- Tab qua toàn trang với thứ tự hợp lý.
- Focus-visible rõ.
- Overlay quản lý focus đúng.
- Không lồng button trong link hoặc button khác.
- Mọi icon button có tên truy cập.
- Màu sắc không phải dấu hiệu trạng thái duy nhất.
- Kiểm tra độ tương phản chữ.
- Bật reduced motion: không pin, parallax hoặc smooth scroll cưỡng bức.
- Kiểm tra zoom 200%; nếu kích thước hiệu dụng đi qua breakpoint nhỏ, vẫn phải truy cập được nội dung.
- Có phương án đọc nội dung khi JavaScript hoặc animation lỗi.
5. Rà soát khả năng triển khai
Không cần tuyên bố prototype là production-ready. Cần lập bảng riêng:
Nhóm Đã triển khai trong prototype Cần làm khi phát triển production
Nội dung Card, filter, trạng thái mẫu CMS, API, pagination
Hình ảnh Crop, placeholder, lightbox Media service, ảnh tối ưu, quyền sử dụng
Video Poster và hành vi phát Video ID, player, nguồn chính thức
Bản đồ Chọn tỉnh, panel, filter Geometry xác minh, API, cache
Nền tảng Bento và trạng thái URL, đăng nhập, phân quyền
Chuyển trang Link hoặc mô phỏng Routing, shared transition, SEO
Newsletter Validation/mô phỏng Dịch vụ gửi, consent, bảo vệ dữ liệu


Nếu có thể xuất code, bổ sung:
- Title, mô tả và ngôn ngữ trang.
- Semantic HTML.
- Kích thước ảnh và lazy-load phù hợp.
- Không tải player trước khi cần.
- Không phụ thuộc script CDN công cộng không cần thiết.
- Không để đường dẫn file .dc.html trở thành URL triển khai cuối.
- Không để href="#" như tính năng đã hoàn thành.
6. Hiệu năng
Nếu môi trường cho phép đo, cung cấp kết quả đo thực tế và điều kiện đo. Mục tiêu định hướng:
- LCP ≤ 2,5 giây.
- CLS ≤ 0,1.
- INP ≤ 200ms trong điều kiện đo phù hợp.
Nếu không đo được, ghi rõ “chưa đo”; không tự tạo điểm Lighthouse hoặc kết quả Core Web Vitals.
7. Hồ sơ bàn giao cuối
Bàn giao:
- Danh sách dữ liệu, ảnh, URL và tích hợp còn thiếu.
- Danh sách lỗi đã sửa

## Assistant

_[tool: grep]_

_[tool: list_files]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: read_file]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: grep]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: grep]_

_[tool: grep]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: read_file]_

_[tool: eval_js]_

_[tool: eval_js]_

## Assistant

## Assistant

## Assistant

## Assistant

## Assistant

