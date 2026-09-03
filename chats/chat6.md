# Phần việc 2: Motion và dòng chảy sinh viên

_Started 2026-09-03 00:27 UTC_

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
📄 HSV Homepage V1.dc.html
📄 HSV Homepage V2 Responsive.dc.html
📄 HSV Homepage V2.dc.html
📄 HSV News Index V1.dc.html
📄 HSV Portal - Blueprint V1.dc.html
📄 HSV Portal V2 Production Notes.dc.html
📄 HSV Topic Page V1.dc.html
📄 image-slot.js
📄 support.js
📄 vietnam-activity-map.js
User is viewing file: HSV Homepage V2.dc.html
Current date is now September 3, 2026
</system-info>

<attached aesthetic_system_instructions>
A design system or theme is attached to this project. That attachment already answers the visual-style question: apply it. Do NOT ask the user which visual style to use — no questions about vibe, colors or palette directions (including color-swatch svg-options questions), typography, mood, or art direction, and skip the "divergent visuals" question from the question-asking tips; offer divergent visual directions only if the user themselves asks for alternatives. This rule bans asking the user to pre-pick a style in the abstract — swatches, mood words, palette pickers. It does not ban asking them to choose among candidates you have already built: putting built candidates on a file-options board for the user to pick from is encouraged. Treat the attachment as the confirmed starting point and product context — the "confirm the starting point" tip is already satisfied, so do not ask the user to confirm or re-pick it. Spend your questions on everything else you need: audience, purpose, content, structure, scope, interactions, tone of copy.
</attached aesthetic_system_instructions>

<pasted_text name="Pasted text (200 lines)">
# PHẦN VIỆC 1/5 — CHUẨN HÓA DESIGN SYSTEM VÀ HOÀN THIỆN HEADER, HERO, TIN TIÊU ĐIỂM TRÊN PC

## 1. Nhiệm vụ và phạm vi

Nâng cấp trực tiếp bản HSV Homepage V2 hiện có. Không tạo một concept mới và không thay đổi kiến trúc nội dung đã thống nhất.

Ưu tiên thiết kế và kiểm thử trên PC:
- Kích thước thiết kế chính: 1440×900.
- Kiểm tra bổ sung: 1280×800, 1366×768 và 1920×1080.
- Chưa thực hiện redesign tablet/mobile; không làm hỏng các breakpoint hiện có.

Giữ định hướng: cổng thông tin chính thống của Hội Sinh viên Việt Nam, có chất báo chí, trẻ trung và hiện đại. Không chuyển thành landing page quảng cáo hoặc dashboard quản trị.

Phần việc này chỉ gồm:
1. Chuẩn hóa Design System.
2. Header và điều hướng.
3. Hero.
4. Dải chủ đề nổi bật.
5. Tin tiêu điểm.

Các section còn lại chỉ được cập nhật theo token chung, chưa thay đổi cấu trúc hoặc hành vi.

## 2. Làm sạch giao diện người dùng

Ẩn khỏi chế độ xem dành cho độc giả:
- Tên component và API.
- Chuỗi `mediaId`, `transitionName`, `variant`.
- Nhãn tỷ lệ ảnh và hướng dẫn triển khai.
- Nội dung giải thích trạng thái kỹ thuật.
- Các nút Replace/Edit nếu thuộc giao diện biên tập được xuất ra cùng bản demo.

Nếu Replace/Edit là chức năng của công cụ thiết kế, vẫn giữ chúng trong editor nhưng không đưa vào giao diện preview hoặc bản xuất dành cho người dùng.

Không xóa khả năng chỉnh sửa ảnh của tài liệu thiết kế.

Không giả vờ đã tích hợp API, CMS hoặc dữ liệu trực tiếp. Những phần dùng dữ liệu mẫu phải được ghi nhận trong tài liệu bàn giao, không chèn giải thích kỹ thuật vào trang tin.

## 3. Khóa Design System

### 3.1. Layout

- Container nội dung tối đa khoảng 1312px.
- Tại 1440px, gutter khoảng 64px mỗi bên.
- Tại 1280px, giảm gutter hợp lý để nội dung không bị nén.
- Section có ảnh hoặc nền tràn màn hình được phép full-bleed, nhưng chữ và CTA phải bám đường căn chung.
- Grid chính 12 cột; khoảng cách cột khoảng 24–32px.
- Khoảng cách section thường: 80–112px.
- Khoảng cách chuyển chương lớn: 112–144px.
- Khoảng cách tiêu đề section đến nội dung: 32–48px.

Không áp dụng padding lớn đồng loạt khiến homepage kéo dài bất hợp lý.

### 3.2. Typography

Giữ các font hiện có nếu chúng đáp ứng tốt tiếng Việt. Không tự ý đổi font thương hiệu.

Phân vai:
- Editorial: tiêu đề hero, section và bài viết.
- UI sans-serif: điều hướng, mô tả, nút, nội dung tiện ích.
- Mono: ngày giờ, số liệu ngắn và một số nhãn phụ; không dùng dày đặc.

Khung cỡ chữ:
- Hero H1: khoảng 64–76px tại 1440px.
- Section H2: 40–48px.
- Featured headline: 28–34px.
- Standard headline: 20–24px.
- Body: 16–18px.
- Metadata: 12–14px.

Kiểm tra dấu tiếng Việt, chiều cao dòng và các tiêu đề dài. Không dùng ngắt dòng cứng làm hỏng bố cục ở 1280px.

### 3.3. Component và trạng thái

Chuẩn hóa:
- Button: Primary, Secondary, Text link.
- Badge: chuyên mục, chủ đề, trạng thái.
- Card: Featured, Standard, Compact.
- Radius: khoảng 8px, 16px, 24px; không phát sinh tùy tiện.
- Section header: eyebrow tùy chọn, H2, mô tả tùy chọn, CTA.
- Trạng thái: default, hover, focus-visible, active, disabled, loading.

Quy định icon:
- Mũi tên phải: điều hướng hoặc CTA.
- Mũi tên chéo: mở website/nền tảng bên ngoài.
- Chevron: mở rộng hoặc chuyển nội dung.
- Dùng cùng một bộ icon, nét vẽ và kích thước.

## 4. Header

### 4.1. Bố cục

- Bên trái: huy hiệu Hội và tên tổ chức.
- Ở giữa: điều hướng chính.
- Bên phải: tìm kiếm và đăng nhập.
- Giữ tên tổ chức rõ, không bị navigation lấn.
- Header mặc định cao khoảng 78px.
- Header compact khoảng 64px.
- Vùng tương tác icon tối thiểu 44×44px.

Tại 1280px, nếu không đủ chỗ, chuyển navigation sang phương án thu gọn có chủ đích; không ép chữ hoặc cắt nút.

### 4.2. Sticky và trạng thái

- Khi cuộn xuống, nền đặc hơn và có đường phân cách/shadow nhẹ.
- Thu gọn không gây nội dung trang nhảy lên xuống.
- Bổ sung active state của mục điều hướng.
- Chỉ thiết kế submenu khi đã có cấu trúc nội dung tương ứng; không tự bổ sung chuyên mục mới.

### 4.3. Tìm kiếm

Thiết kế overlay có:
- Tiêu đề và nút đóng.
- Ô nhập được focus khi mở.
- Trạng thái chưa nhập.
- Từ khóa gợi ý hoặc chủ đề sẵn có.
- Kết quả mẫu liên quan.
- Không có kết quả.
- Loading và lỗi.
- Đóng bằng Escape.
- Giữ focus trong overlay và trả focus về nút mở khi đóng.

Không gửi dữ liệu ra ngoài; sử dụng nội dung mẫu cho prototype.

## 5. Hero

### 5.1. Bố cục PC

- Cột nội dung khoảng 46%.
- Cột ảnh khoảng 54%.
- Chiều cao mục tiêu khoảng 650–720px tại 1440×900.
- Không khóa chiều cao nếu nội dung dài gây cắt chữ.
- Tiêu đề cố gắng trong 4–5 dòng ở kích thước thiết kế chính.
- Mô tả khoảng 2–3 dòng.
- Metadata đặt sau mô tả, trước nhóm CTA.
- CTA chính: Đọc bài viết.
- CTA phụ: chuyên đề liên quan.
- Giữ caption địa điểm/nguồn ảnh nhưng không làm nó cạnh tranh với tiêu đề.

Màn hình đầu cần cho độc giả thấy ngay tin chính và đường dẫn đọc bài.

### 5.2. Hình ảnh

Ưu tiên ảnh hoạt động thật được cung cấp hoặc có quyền sử dụng rõ ràng.

Nếu chưa có ảnh phù hợp:
- Giữ một placeholder trung tính, sạch.
- Không dùng ảnh AI hoặc stock như thể đó là tư liệu của sự kiện thật.
- Ghi rõ nhu cầu ảnh trong tài liệu bàn giao.

Thiết kế sẵn:
- Focal point.
- Crop theo container.
- Lớp phủ caption.
- Loading placeholder.
- Fallback khi ảnh lỗi.
- Alt text phù hợp.

Chưa thêm parallax phức tạp trong phần việc này; chỉ chuẩn bị cấu trúc ảnh.

## 6. Chủ đề nổi bật

- Đặt ngay dưới hero.
- Nhãn “Chủ đề nổi bật” và nhóm chip căn cùng trục.
- Tên chủ đề nổi bật hơn số lượng bài.
- Có hover và focus-visible.
- Nếu không đủ chiều rộng, cho cuộn trong chính dải chip; không gây cuộn ngang toàn trang.
- Chỉ liên kết đến các chuyên đề có thật hoặc trang prototype tương ứng.

## 7. Tin tiêu điểm

- Một bài chính chiếm khoảng 60–65%.
- Ba bài phụ ở cột bên cạnh.
- Ảnh bài chính tỷ lệ 3:2 hoặc tỷ lệ đã chọn thống nhất.
- Bài phụ dùng thumbnail nhỏ, metadata và tiêu đề rõ.
- Căn đều đường phân cách và khoảng cách giữa ba bài.
- Không kéo dài section chỉ để hai cột bằng chiều cao.
- Không lồng nút trong liên kết.
- Ảnh và tiêu đề cùng dẫn đến đúng bài tương ứng.

## 8. Tiêu chí nghiệm thu

- Không còn nhãn kỹ thuật trong UI độc giả.
- Header không cắt chữ hoặc nút tại 1280–1920px.
- Không xuất hiện cuộn ngang toàn trang.
- H1 không tràn và không bị cắt dấu tiếng Việt.
- Header sticky không gây layout shift rõ rệt.
- Tin tiêu điểm hiển thị đầy đủ dù chưa có animation.
- Các component dùng token thống nhất.
- Không tự ý thay đổi thứ tự các section khác.

## 9. Bàn giao

Cung cấp:
1. Bản Homepage V2 đã chỉnh sửa trực tiếp.
2. Danh sách token/component đã chuẩn hóa.
3. Ảnh kiểm tra ở 1440px và 1280px.
4. Danh sách nội dung, ảnh hoặc dữ liệu còn thiếu.
5. Phân biệt rõ chức năng đã hoạt động với chức năng mới được mô phỏng.

Dừng sau phần việc 1, chưa tự chuyển sang phần việc 2.
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

## User

# PHẦN VIỆC 2/5 — HOÀN THIỆN MOTION, DÒNG CHẢY SINH VIÊN, TIN MỚI VÀ VIDEO TRÊN PC

## 1. Điều kiện và phạm vi

Tiếp tục trên bản đã hoàn thành phần việc 1. Giữ nguyên Design System, header, hero và Tin tiêu điểm đã thống nhất.

Phần việc này gồm:
1. Motion toàn trang.
2. Dòng chảy sinh viên.
3. Tin mới nhất.
4. Video & phóng sự.
5. Chuyển từ card sang trang bài viết.

Không sửa bản đồ, bento, gallery hoặc footer ngoài việc áp dụng token chung.

## 2. Motion toàn trang

### 2.1. Nguyên tắc

Chuyển động phải giúp người dùng nhận biết:
- Thành phần vừa xuất hiện.
- Thành phần đang được chọn.
- Nội dung đang thay đổi.
- Mối liên hệ giữa trang danh sách và trang chi tiết.

Không dùng motion để che nội dung, kéo dài trang hoặc tạo cảm giác phải chờ.

Thông số định hướng:
- Hover/UI: 160–240ms.
- Reveal: 350–550ms.
- Stagger: 50–70ms, tổng độ trễ không quá khoảng 300ms.
- Reveal dịch chuyển tối đa khoảng 12–20px.
- Không lặp animation khi người dùng cuộn qua lại.

### 2.2. Sửa reveal

- Nội dung mặc định phải hiển thị.
- Chỉ gắn trạng thái chuẩn bị animation sau khi JavaScript đã khởi tạo thành công.
- Nếu script lỗi, nội dung vẫn đọc được.
- Không quét toàn bộ DOM trong mỗi lần scroll.
- Phần tử đã reveal phải ngừng được quan sát.
- Kiểm tra mở trang ở giữa, tải lại và quay lại bằng Back.
- Khi reduced motion hoặc in trang, bỏ reveal và hiện toàn bộ nội dung.

### 2.3. Hero motion

- Parallax rất nhẹ, tổng dịch chuyển khoảng 20–40px.
- Không làm lộ mép ảnh.
- Không làm caption trôi khỏi vùng ảnh.
- Dùng một cơ chế cập nhật theo frame, tránh đọc/ghi layout liên tục.
- Tắt khi reduced motion.
- Nếu môi trường prototype không hỗ trợ ổn định, dùng fade/scale nhẹ và ghi rõ giới hạn.

## 3. Dòng chảy sinh viên

### 3.1. Vấn đề cần xử lý

Bản hiện tại có vùng nền tối kéo dài và phần rail chỉ chiếm một phần chiều cao, làm người dùng có cảm giác bị giữ lại trong section.

Cần giữ ý tưởng hành trình ngang nhưng giảm thời gian và khoảng trống không cần thiết.

### 3.2. Bố cục

- Nền tối giữ nguyên định hướng.
- Tiêu đề và mô tả nằm trên cùng.
- Điều khiển trước/sau nằm cùng khu vực tiêu đề, không trôi xa nội dung.
- Card có ảnh tỷ lệ 16:10, địa phương, ngày, tiêu đề và chuyên mục.
- Tăng độ tương phản của metadata ở card không active.
- Scale giữa card active và card phụ chỉ chênh nhẹ; không làm chữ card phụ khó đọc.
- Luôn có tín hiệu cho biết còn card ở phía sau.
Không khóa tổng chiều dài section vào một con số cố định. Tính theo chiều rộng track và khoảng di chuyển thực, sau đó điều chỉnh để hành trình ngắn hơn bản hiện tại.

### 3.3. Pinned horizontal scroll

- Bắt đầu pin khi khối nội dung đã vào vị trí hợp lý.
- Không để header che tiêu đề section.
- Cuộn dọc ánh xạ đều sang cuộn ngang.
- Card đầu có thể xem đầy đủ tại điểm bắt đầu.
- Card cuối có thể xem đầy đủ trước khi kết thúc.
- Sau card cuối, cuộn tiếp phải rời section tự nhiên.
- Không tạo khoảng đen trống sau rail.
- Khi resize, tính lại hành trình và không giữ chiều cao cũ.

### 3.4. Điều khiển

- Nút trước/sau chuyển theo card đích, không dùng một khoảng pixel tùy ý.
- Đồng bộ card active, progress và bộ đếm.
- Vô hiệu hóa nút trước ở đầu và nút sau ở cuối.
- Hỗ trợ bàn phím khi focus trong rail.
- Không chiếm phím mũi tên khi người dùng đang ở khu vực khác.
- Không để card ngoài màn hình nhận focus mà không được đưa vào vùng nhìn.

### 3.5. Reduced motion và fallback

- Bỏ pin.
- Dùng rail ngang native với scroll snap.
- Có nút trước/sau.
- Không tự động chạy.
- Nếu không triển khai pin ổn định trong môi trường hiện tại, ưu tiên rail native hoạt động tốt; không dựng hiệu ứng giả bằng khoảng trắng dài.

## 4. Tin mới nhất

### 4.1. Bố cục

Giữ:
- Một bài featured.
- Cụm “Đọc nhanh”.
- Các bài standard.
- Bài text-only nếu phù hợp nội dung.

Điều chỉnh:
- Giảm khoảng trắng không cần thiết.
- Căn metadata và tiêu đề thống nhất.
- Không để card trông giống nhau hoàn toàn nhưng cũng không phát sinh quá nhiều biến thể.
- Bảo đảm nội dung vẫn cân đối khi tiêu đề dài hoặc không có ảnh.

### 4.2. Bộ lọc

Mỗi filter phải:
- Có trạng thái selected rõ.
- Thực sự thay đổi tập nội dung mẫu.
- Không chỉ đổi màu nút.
- Có loading, empty và error state để kiểm tra.
- Thông báo thay đổi cho công nghệ hỗ trợ.
- Không làm toàn trang nhảy vị trí đột ngột.

Chốt hành vi “Xem thêm tin”:
- Với prototype: tải thêm một nhóm tin mẫu vào đúng grid.
- Chỉ xuất hiện một lần mỗi nhóm; không nhân bản nội dung vô hạn.
- Có loading và trạng thái đã hết tin.
- Ghi rõ API/pagination cần tích hợp trong tài liệu bàn giao.

## 5. Video & phóng sự

### 5.1. Bố cục PC

- Video chính khoảng 65%.
- Playlist khoảng 35%.
- Khung chính 16:9.
- Có poster, nút phát, thời lượng, chuyên mục, tiêu đề và mô tả.
- Playlist thể hiện rõ video đang được chọn.

### 5.2. Hành vi
- Bấm video phụ cập nhật đúng video chính và metadata.
- Không tự phát có âm thanh.
- Chỉ tải player khi người dùng yêu cầu phát.
- Dừng video cũ khi đổi video.
- Có trạng thái video không khả dụng.
- Nếu chưa có video được xác nhận, dùng poster mẫu và ghi “Chưa kết nối nguồn video” trong trạng thái phù hợp; không gắn video không liên quan.

Không để các nút biên tập ảnh nằm trong nút phát video.

## 6. Chuyển bài viết

### 6.1. Điều hướng

- Mỗi card phải mở bài đúng với tiêu đề.
- Không cho tất cả card dẫn đến cùng một bài nhưng mang tên khác nhau mà không ghi nhận đó là giới hạn prototype.
- Giữ liên kết HTML có ý nghĩa, không thay bằng vùng click không hỗ trợ bàn phím.

### 6.2. Shared transition

Nếu môi trường hỗ trợ:
- Ánh xạ ảnh bằng ID ổn định.
- Chỉ ảnh được chọn nhận tên transition.
- Không tạo các tên transition trùng nhau đang cùng hiển thị.
- Giữ crop và tỷ lệ chuyển tiếp hợp lý.
- Fallback sang navigation bình thường hoặc fade nhẹ.
- Reduced motion bỏ hiệu ứng.
- Không trì hoãn điều hướng chỉ để chờ animation.

Nếu môi trường không hỗ trợ chuyển trang thật:
- Mô phỏng rõ trong prototype.
- Ghi rõ “mô phỏng”, không báo đã tích hợp View Transition production.

## 7. Tiêu chí nghiệm thu

- Không có section trống do reveal.
- Dòng chảy không còn khoảng đen kéo dài vô nghĩa.
- Xem được đủ card đầu và cuối.
- Wheel, trackpad, nút và bàn phím hoạt động nhất quán.
- Filter tin thay đổi nội dung thật trong prototype.
- Video đổi đúng nội dung được chọn.
- Không tự phát âm thanh.
- Chuyển bài có fallback.
- Reduced motion hoạt động xuyên suốt.

## 8. Bàn giao

Cung cấp:
1. Bản đã cập nhật.
2. Mô tả ngắn logic motion và fallback.
3. Minh chứng kiểm tra rail ở đầu, giữa và cuối.
4. Danh sách tương tác đã chạy thật và tương tác mô phỏng.
5. Các giới hạn cần xử lý khi chuyển sang ứng dụng production.

Dừng sau phần việc 2.

## User

# PHẦN VIỆC 2/5 — HOÀN THIỆN MOTION, DÒNG CHẢY SINH VIÊN, TIN MỚI VÀ VIDEO TRÊN PC

## 1. Điều kiện và phạm vi

Tiếp tục trên bản đã hoàn thành phần việc 1. Giữ nguyên Design System, header, hero và Tin tiêu điểm đã thống nhất.

Phần việc này gồm:
1. Motion toàn trang.
2. Dòng chảy sinh viên.
3. Tin mới nhất.
4. Video & phóng sự.
5. Chuyển từ card sang trang bài viết.

Không sửa bản đồ, bento, gallery hoặc footer ngoài việc áp dụng token chung.

## 2. Motion toàn trang

### 2.1. Nguyên tắc

Chuyển động phải giúp người dùng nhận biết:
- Thành phần vừa xuất hiện.
- Thành phần đang được chọn.
- Nội dung đang thay đổi.
- Mối liên hệ giữa trang danh sách và trang chi tiết.

Không dùng motion để che nội dung, kéo dài trang hoặc tạo cảm giác phải chờ.

Thông số định hướng:
- Hover/UI: 160–240ms.
- Reveal: 350–550ms.
- Stagger: 50–70ms, tổng độ trễ không quá khoảng 300ms.
- Reveal dịch chuyển tối đa khoảng 12–20px.
- Không lặp animation khi người dùng cuộn qua lại.

### 2.2. Sửa reveal

- Nội dung mặc định phải hiển thị.
- Chỉ gắn trạng thái chuẩn bị animation sau khi JavaScript đã khởi tạo thành công.
- Nếu script lỗi, nội dung vẫn đọc được.
- Không quét toàn bộ DOM trong mỗi lần scroll.
- Phần tử đã reveal phải ngừng được quan sát.
- Kiểm tra mở trang ở giữa, tải lại và quay lại bằng Back.
- Khi reduced motion hoặc in trang, bỏ reveal và hiện toàn bộ nội dung.

### 2.3. Hero motion

- Parallax rất nhẹ, tổng dịch chuyển khoảng 20–40px.
- Không làm lộ mép ảnh.
- Không làm caption trôi khỏi vùng ảnh.
- Dùng một cơ chế cập nhật theo frame, tránh đọc/ghi layout liên tục.
- Tắt khi reduced motion.
- Nếu môi trường prototype không hỗ trợ ổn định, dùng fade/scale nhẹ và ghi rõ giới hạn.

## 3. Dòng chảy sinh viên

### 3.1. Vấn đề cần xử lý

Bản hiện tại có vùng nền tối kéo dài và phần rail chỉ chiếm một phần chiều cao, làm người dùng có cảm giác bị giữ lại trong section.

Cần giữ ý tưởng hành trình ngang nhưng giảm thời gian và khoảng trống không cần thiết.

### 3.2. Bố cục

- Nền tối giữ nguyên định hướng.
- Tiêu đề và mô tả nằm trên cùng.
- Điều khiển trước/sau nằm cùng khu vực tiêu đề, không trôi xa nội dung.
- Card có ảnh tỷ lệ 16:10, địa phương, ngày, tiêu đề và chuyên mục.
- Tăng độ tương phản của metadata ở card không active.
- Scale giữa card active và card phụ chỉ chênh nhẹ; không làm chữ card phụ khó đọc.
- Luôn có tín hiệu cho biết còn card ở phía sau.
Không khóa tổng chiều dài section vào một con số cố định. Tính theo chiều rộng track và khoảng di chuyển thực, sau đó điều chỉnh để hành trình ngắn hơn bản hiện tại.

### 3.3. Pinned horizontal scroll

- Bắt đầu pin khi khối nội dung đã vào vị trí hợp lý.
- Không để header che tiêu đề section.
- Cuộn dọc ánh xạ đều sang cuộn ngang.
- Card đầu có thể xem đầy đủ tại điểm bắt đầu.
- Card cuối có thể xem đầy đủ trước khi kết thúc.
- Sau card cuối, cuộn tiếp phải rời section tự nhiên.
- Không tạo khoảng đen trống sau rail.
- Khi resize, tính lại hành trình và không giữ chiều cao cũ.

### 3.4. Điều khiển

- Nút trước/sau chuyển theo card đích, không dùng một khoảng pixel tùy ý.
- Đồng bộ card active, progress và bộ đếm.
- Vô hiệu hóa nút trước ở đầu và nút sau ở cuối.
- Hỗ trợ bàn phím khi focus trong rail.
- Không chiếm phím mũi tên khi người dùng đang ở khu vực khác.
- Không để card ngoài màn hình nhận focus mà không được đưa vào vùng nhìn.

### 3.5. Reduced motion và fallback

- Bỏ pin.
- Dùng rail ngang native với scroll snap.
- Có nút trước/sau.
- Không tự động chạy.
- Nếu không triển khai pin ổn định trong môi trường hiện tại, ưu tiên rail native hoạt động tốt; không dựng hiệu ứng giả bằng khoảng trắng dài.

## 4. Tin mới nhất

### 4.1. Bố cục

Giữ:
- Một bài featured.
- Cụm “Đọc nhanh”.
- Các bài standard.
- Bài text-only nếu phù hợp nội dung.

Điều chỉnh:
- Giảm khoảng trắng không cần thiết.
- Căn metadata và tiêu đề thống nhất.
- Không để card trông giống nhau hoàn toàn nhưng cũng không phát sinh quá nhiều biến thể.
- Bảo đảm nội dung vẫn cân đối khi tiêu đề dài hoặc không có ảnh.

### 4.2. Bộ lọc

Mỗi filter phải:
- Có trạng thái selected rõ.
- Thực sự thay đổi tập nội dung mẫu.
- Không chỉ đổi màu nút.
- Có loading, empty và error state để kiểm tra.
- Thông báo thay đổi cho công nghệ hỗ trợ.
- Không làm toàn trang nhảy vị trí đột ngột.

Chốt hành vi “Xem thêm tin”:
- Với prototype: tải thêm một nhóm tin mẫu vào đúng grid.
- Chỉ xuất hiện một lần mỗi nhóm; không nhân bản nội dung vô hạn.
- Có loading và trạng thái đã hết tin.
- Ghi rõ API/pagination cần tích hợp trong tài liệu bàn giao.

## 5. Video & phóng sự

### 5.1. Bố cục PC

- Video chính khoảng 65%.
- Playlist khoảng 35%.
- Khung chính 16:9.
- Có poster, nút phát, thời lượng, chuyên mục, tiêu đề và mô tả.
- Playlist thể hiện rõ video đang được chọn.

### 5.2. Hành vi
- Bấm video phụ cập nhật đúng video chính và metadata.
- Không tự phát có âm thanh.
- Chỉ tải player khi người dùng yêu cầu phát.
- Dừng video cũ khi đổi video.
- Có trạng thái video không khả dụng.
- Nếu chưa có video được xác nhận, dùng poster mẫu và ghi “Chưa kết nối nguồn video” trong trạng thái phù hợp; không gắn video không liên quan.

Không để các nút biên tập ảnh nằm trong nút phát video.

## 6. Chuyển bài viết

### 6.1. Điều hướng

- Mỗi card phải mở bài đúng với tiêu đề.
- Không cho tất cả card dẫn đến cùng một bài nhưng mang tên khác nhau mà không ghi nhận đó là giới hạn prototype.
- Giữ liên kết HTML có ý nghĩa, không thay bằng vùng click không hỗ trợ bàn phím.

### 6.2. Shared transition

Nếu môi trường hỗ trợ:
- Ánh xạ ảnh bằng ID ổn định.
- Chỉ ảnh được chọn nhận tên transition.
- Không tạo các tên transition trùng nhau đang cùng hiển thị.
- Giữ crop và tỷ lệ chuyển tiếp hợp lý.
- Fallback sang navigation bình thường hoặc fade nhẹ.
- Reduced motion bỏ hiệu ứng.
- Không trì hoãn điều hướng chỉ để chờ animation.

Nếu môi trường không hỗ trợ chuyển trang thật:
- Mô phỏng rõ trong prototype.
- Ghi rõ “mô phỏng”, không báo đã tích hợp View Transition production.

## 7. Tiêu chí nghiệm thu

- Không có section trống do reveal.
- Dòng chảy không còn khoảng đen kéo dài vô nghĩa.
- Xem được đủ card đầu và cuối.
- Wheel, trackpad, nút và bàn phím hoạt động nhất quán.
- Filter tin thay đổi nội dung thật trong prototype.
- Video đổi đúng nội dung được chọn.
- Không tự phát âm thanh.
- Chuyển bài có fallback.
- Reduced motion hoạt động xuyên suốt.

## 8. Bàn giao

Cung cấp:
1. Bản đã cập nhật.
2. Mô tả ngắn logic motion và fallback.
3. Minh chứng kiểm tra rail ở đầu, giữa và cuối.
4. Danh sách tương tác đã chạy thật và tương tác mô phỏng.
5. Các giới hạn cần xử lý khi chuyển sang ứng dụng production.

Dừng sau phần việc 2.

## User

Re-running the check

## Assistant

_[tool: ready_for_verification]_

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: read_file]_

_[tool: read_file]_

Now the badge fix + the P1–P2 handoff doc.

_[tool: run_script]_

_[tool: read_file]_

_[tool: dc_write]_

_[tool: update_todos]_

_[tool: ready_for_verification]_

Phần việc 1 + 2 đã xong trên **HSV Homepage V2.dc.html**, kèm tài liệu bàn giao mới **HSV Handoff P1-P2.dc.html** (token/component đã chốt, logic motion + fallback, bảng phân biệt tương tác chạy thật / mô phỏng / giới hạn, danh sách ảnh–dữ liệu còn thiếu).

Hai lưu ý:
- Ảnh kiểm tra ở `screenshots/01–04-check.png` bị cắt bên phải vì khung xem trước hẹp hơn 1440/1280 — nghiệm thu chính xác nên mở file trực tiếp ở cửa sổ đúng kích thước.
- Còn chờ ảnh hero, ảnh dòng chảy, poster + nguồn video và route `/tin/[slug]`; chưa chuyển sang phần việc 3.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Same pattern in the Production Notes doc:

_[tool: run_script]_

_[tool: ready_for_verification]_

Fixed: running header/footer now fit the reserved band (no padding, no rule, `line-height:1.2`) and labels are shortened with `nowrap` so they can't wrap. Applied the same fix to HSV Portal V2 Production Notes.

