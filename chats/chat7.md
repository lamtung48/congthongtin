# Chat

_Started 2026-09-03 05:29 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "HSV Portal Blueprint V1"
What `list_files` on the project root returns right now (dotfiles, if any, are not shown here):
📁 _ds
📁 assets
📁 data
📁 ds
📁 screenshots
📁 uploads
📄 deck-stage.js
📄 doc-page.js
📄 HSV Article Page V1.dc.html
📄 HSV Component States V1.dc.html
📄 HSV Component States V2.dc.html
📄 HSV Handoff P1-P2.dc.html
📄 HSV Homepage V1.dc.html
📄 HSV Homepage V2 Responsive.dc.html
📄 HSV Homepage V2.dc.html
📄 HSV News Index V1.dc.html
📄 HSV Portal - Blueprint V1.dc.html
📄 HSV Portal V2 Production Notes.dc.html
📄 HSV Topic Page V1.dc.html
📄 HSV V2 Part 1 Handoff.dc.html
📄 image-slot.js
📄 support.js
📄 vietnam-activity-map.js
User is viewing file: HSV Handoff P1-P2.dc.html
Current date is now September 3, 2026
</system-info>

<attached aesthetic_system_instructions>
A design system or theme is attached to this project. That attachment already answers the visual-style question: apply it. Do NOT ask the user which visual style to use — no questions about vibe, colors or palette directions (including color-swatch svg-options questions), typography, mood, or art direction, and skip the "divergent visuals" question from the question-asking tips; offer divergent visual directions only if the user themselves asks for alternatives. This rule bans asking the user to pre-pick a style in the abstract — swatches, mood words, palette pickers. It does not ban asking them to choose among candidates you have already built: putting built candidates on a file-options board for the user to pick from is encouraged. Treat the attachment as the confirmed starting point and product context — the "confirm the starting point" tip is already satisfied, so do not ask the user to confirm or re-pick it. Spend your questions on everything else you need: audience, purpose, content, structure, scope, interactions, tone of copy.
</attached aesthetic_system_instructions>

<pasted_text name="Pasted text (200 lines)">
# PHẦN VIỆC 3/5 — HOÀN THIỆN BẢN ĐỒ HOẠT ĐỘNG VÀ BENTO HỆ SINH THÁI SỐ TRÊN PC

## 1. Điều kiện và phạm vi

Tiếp tục trên bản đã hoàn thành phần việc 2.

Chỉ tập trung:
1. Hoạt động sinh viên trên toàn quốc.
2. Hệ sinh thái số Hội Sinh viên Việt Nam.

Không làm hai section này trở thành dashboard quản trị. Chúng phải phục vụ độc giả: khám phá hoạt động, tìm đơn vị và truy cập nền tảng.

## 2. Bản đồ — bố cục PC

### 2.1. Section header

Hiển thị:
- Tiêu đề: “Hoạt động sinh viên trên toàn quốc”.
- Mô tả ngắn theo ngôn ngữ độc giả.
- Bộ lọc chuyên mục hiện có.

Loại bỏ:
- Tên API.
- Giải thích geometry.
- Lời khẳng định “lấy trực tiếp từ API” khi chưa tích hợp.
- Thuật ngữ fallback/screen reader trên UI.

### 2.2. Khối nội dung

Dùng bố cục khoảng 7/5:
- Trái: bản đồ đủ lớn để tương tác.
- Phải: số liệu và tin mới nhất.

Chỉ giữ một nguồn thông tin chính cho mỗi loại dữ liệu. Không lặp lại đồng thời bảng xếp hạng, danh sách 34 tỉnh và danh sách tương tự mà không có mục đích rõ.

Danh sách đầy đủ đặt trong vùng mở rộng:
- Nút “Xem danh sách tỉnh, thành”.
- Có thể tìm theo tên đơn vị.
- Độc giả chủ động mở.
- Vẫn truy cập được nếu bản đồ không hoạt động.

## 3. Bản đồ — hình học và nội dung

- Dùng bộ geometry và mã đơn vị có nguồn gốc rõ.
- Không tự vẽ lại ranh giới bằng phỏng đoán.
- Không sử dụng số đơn vị, tên địa phương và mã hành chính không đồng nhất giữa bản đồ và dữ liệu.
- Giữ thể hiện Hoàng Sa, Trường Sa và chú thích chủ quyền.
- Vị trí minh họa phải được chú thích rõ nếu không theo tỷ lệ bản đồ.
- Không tính hai quần đảo như hai đơn vị báo cáo cấp tỉnh riêng.
- Khối Hội Sinh viên Việt Nam ở ngoài nước cần được phân biệt với dữ liệu tỉnh, thành trong nước.

Nếu thiếu nguồn geometry chính xác, giữ phương án hiện có và nêu rõ cần kiểm chứng; không tự tuyên bố đã xác minh.

## 4. Bản đồ — tương tác bắt buộc

### 4.1. Hover và focus

- Tỉnh được làm nổi bật.
- Tooltip gọn, không che hoàn toàn tỉnh đang chọn.
- Hiển thị tên đơn vị và chỉ số chính.
- Focus bàn phím cung cấp thông tin tương đương hover.
- Không phụ thuộc riêng vào màu sắc.

### 4.2. Chọn tỉnh

Khi click hoặc kích hoạt bằng bàn phím:
- Giữ selected state.
- Panel bên phải cập nhật đúng đơn vị.
- Hiển thị tên, hoạt động, tin bài và số người tham gia nếu dữ liệu có.
- Hiển thị 1–3 tin mới nhất.
- Có CTA “Xem hoạt động của đơn vị”.
- Có nút “Xem toàn quốc” để xóa lựa chọn.
- Không làm trang nhảy xuống vùng khác.

Không hiển thị số liệu không có trong dữ liệu mẫu chỉ để lấp đầy panel.

### 4.3. Bộ lọc

Khi đổi chuyên mục:
- Cập nhật bản đồ.
- Cập nhật legend.
- Cập nhật tổng số liệu.
- Cập nhật tin mới.
- Xử lý tỉnh đang chọn nếu chuyên mục đó không có dữ liệu.
- Hiển thị “Chưa có dữ liệu” thay vì tự coi là 0.

### 4.4. Dữ liệu và thời gian

Mỗi bộ dữ liệu cần có:
- Mã đơn vị ổn định.
- Tên hiển thị.
- Kỳ thống kê.
- Thời gian cập nhật.
- Các chỉ số.
- Tin liên quan.
- URL đơn vị.

Hiển thị kỳ thống kê để người dùng hiểu số liệu là theo tháng, năm hay toàn bộ thời gian.

Thời gian cập nhật trên UI nên gọn, không cần hiển thị giây.

## 5. Trạng thái bản đồ

Thiết kế và cho phép kiểm tra:
- Loading.
- Loaded.
- Không có dữ liệu.
- API lỗi.
- Geometry lỗi.
- Dữ liệu cũ.
- Đơn vị chưa báo cáo.

Khi bản đồ lỗi:
- Hiện thông báo rõ.
- Có nút thử lại nếu phù hợp.
- Danh sách đơn vị vẫn sử dụng được.
- Không để khoảng trống lớn.

Trong prototype, dùng fixture/mock data nhất quán. Ghi rõ API thật chưa được kết nối nếu chưa có.

## 6. Bento hệ sinh thái số

### 6.1. Cấu trúc

Giữ năm nền tảng hiện có:
- Hội nghị.
- Đào tạo.
- Sinh viên 5 tốt.
- Tình nguyện.
- Dữ liệu &amp; Báo cáo.

Không bổ sung nền tảng mới.

Bố cục:
- Một ô nổi bật cho nền tảng đang có hoạt động ưu tiên.
- Bốn ô phụ cân đối.
- Không làm tất cả ô cùng kích thước.
- Không để một ô dài chỉ vì có nhiều mô tả kỹ thuật.

### 6.2. Nội dung mỗi ô

- Icon nhận diện.
- Tên nền tảng.
- Mô tả chức năng ngắn.
- Trạng thái nếu có.
- Một CTA chính.

Thay các chữ viết tắt HN, ĐT, TN, DL bằng icon thống nhất nếu có thể; không tự sửa biểu trưng chính thức của tổ chức.

### 6.3. Quy tắc trạng thái

Thiết kế đủ:
- Đang hoạt động: CTA truy cập.
- Đang diễn ra: nhấn mạnh phiên/hoạt động cụ thể.
- Đang mở đăng ký: CTA đăng ký.
- Sắp ra mắt: không tạo link giả.
- Bảo trì: thông báo và hướng dẫn phù hợp.
- Không khả dụng: không có CTA gây hiểu nhầm.

Không chỉ dùng chấm màu; luôn có nhãn chữ.

Không dùng pulse liên tục trên nhiều ô cùng lúc.

### 6.4. Registry và quyền truy cập

Chuẩn bị cấu trúc dữ liệu:
- ID.
- Tên.
- Mô tả.
- Icon.
- Trạng thái.
- URL.
- CTA.
- Có cần đăng nhập hay không.
- Thông tin hoạt động hiện tại nếu có.

Không tự khẳng định năm nền tảng dùng chung đăng nhập nếu chưa có xác nhận kỹ thuật. Nếu đây là định hướng tương lai, ghi trong tài liệu bàn giao.

## 7. Tiêu chí nghiệm thu

- Chọn tỉnh luôn tạo phản hồi trực quan.
- Panel hiển thị đúng đơn vị và đúng chuyên mục.
- Có kỳ thống kê và thời gian cập nhật.
- Không nhầm “0” với “chưa có dữ liệu”.
- Danh sách thay thế dùng được khi bản đồ lỗi.
- Bản đồ không tràn container ở 1280–1920px.
- Bento có phân cấp rõ.
- Mọi trạng thái platform có quy tắc CTA.
- Không còn tuyên bố tích hợp API/SSO chưa được thực hiện.

## 8. Bàn giao

Cung cấp bản cập nhật cùng:
1. Bảng trạng thái bản đồ và nền tảng.
2. Mẫu dữ liệu đang sử dụng.
3. Nguồn geometry hoặc hạng mục cần kiểm chứng.
4. Danh sách URL/API/SSO còn thiếu.
5. Minh chứng trạng thái toàn quốc, chọn tỉnh, không có dữ liệu và lỗi.

Dừng sau phần việc 3.
</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="HSV Digital Design System (design system)">
[Design System] This project uses the **HSV Digital Design System** design system. This is a binding choice for visual style — every visual must follow it. Don't invent colors, type, spacing, or components not grounded here.

Scope: the design system is a visual style reference only. Its guide may describe example products, brands, or people that are unrelated to the user and unrelated to the subject of this conversation. Never treat anything in the design system as a fact about the user, their work, or the topic they asked about.

This project has the **HSVDigitalDesignSystem_76d24d** design system bound at `_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/`. If anything under that path is missing or fails to load, the folder name may differ — `list_files` `_ds/` and use the folder whose name ends with 76d24d86-e8a3-4a72-adfe-c277f3d449aa instead, including in the <link>/<script> paths below.

**Loading the bundle is how you use this design system.** Every Design Component you build must load `_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/_ds_bundle.js` in `<helmet>` (include it in child DCs too — de-duped by URL) and compose with its components — do not recreate those components from scratch or restyle raw HTML to look like them. At the top of the template:

```html
<helmet>
  <link rel="stylesheet" href="_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/tokens/fonts.css">
  <link rel="stylesheet" href="_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/tokens/colors.css">
  <link rel="stylesheet" href="_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/tokens/typography.css">
  <link rel="stylesheet" href="_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/tokens/spacing.css">
  <link rel="stylesheet" href="_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/tokens/elevation.css">
  <link rel="stylesheet" href="_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/tokens/motion.css">
  <link rel="stylesheet" href="_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/tokens/base.css">
  <link rel="stylesheet" href="_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/styles.css">
  <script src="_ds/hsv-digital-design-system-76d24d86-e8a3-4a72-adfe-c277f3d449aa/_ds_bundle.js"></script>
</helmet>
```

Then mount any component directly in the template — no logic class needed:

```html
<x-import component-from-global-scope="HSVDigitalDesignSystem_76d24d.Button" hint-size="auto,40px">Label</x-import>
```

Props are template attributes (kebab → camelCase); template children pass through as `props.children`. The linked stylesheet(s) carry the design tokens (colors, type, spacing) — style against those via `var(--*)` and the design system's classes rather than guessing values.

The full design-system source tree lives at `/projects/76d24d86-e8a3-4a72-adfe-c277f3d449aa/` — use `list_files` / `read_file` from there for anything not under `_ds/` (layout varies by brand; don't assume folder names). Before producing any visuals, `list_files("/projects/76d24d86-e8a3-4a72-adfe-c277f3d449aa/")` and `read_file` the readme and any relevant guidelines.
</attached-skill>

## Assistant

_[tool: list_files]_

_[tool: grep]_

_[tool: grep]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: write_file]_

_[tool: read_file]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: dc_set_props]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: get_webview_logs]_

_[tool: run_script]_

_[tool: str_replace_edit]_

_[tool: run_script]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

_[tool: grep]_

_[tool: multi_screenshot]_

_[tool: run_script]_

_[tool: multi_screenshot]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: delete_file]_

_[tool: read_file]_

_[tool: dc_write]_

_[tool: run_script]_

_[tool: grep]_

_[tool: dc_js_str_replace]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

Phần việc 3 đã cập nhật trong **HSV Homepage V2.dc.html**, kèm bàn giao **HSV Handoff P3.dc.html**.

Bản đồ: bố cục PC 7/5, header chỉ còn ngôn ngữ độc giả, bỏ bảng xếp hạng trong khung bản đồ (mỗi loại dữ liệu một nguồn), danh sách 34 đơn vị chuyển vào vùng mở rộng có ô tìm kiếm và vẫn dùng được khi nền bản đồ lỗi. Chọn tỉnh giữ selected state, panel đổi đúng đơn vị + chuyên mục, có kỳ thống kê, CTA "Xem hoạt động của đơn vị" và nút "Xem toàn quốc". Fixture nay phân biệt `null` (chưa báo cáo / chuyên mục không có dữ liệu) với 0; tổng số liệu ghi 32/34 đơn vị đã báo cáo. Bảy trạng thái bật bằng tweak `mapDataState` (loading · empty · error · geometry · stale · api) và fixture.

Bento: bỏ chữ viết tắt, dùng bộ icon nét thống nhất, một ô nổi bật + bốn ô phụ, mỗi ô có nhãn trạng thái bằng chữ, một CTA và dòng quyền truy cập; trạng thái đổi bằng ba tweak mới. Đã bỏ khẳng định SSO khỏi UI — ghi vào mục URL/API/SSO còn thiếu.

Còn cần bạn xác nhận: geometry cấp tỉnh sau sáp nhập, mã đơn vị chính thức, URL bốn nền tảng và nguồn cấp trạng thái nền tảng. Dừng tại phần việc 3.

