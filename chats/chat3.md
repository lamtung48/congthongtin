# Phương án chia nhỏ công việc

_Started 2026-09-02 10:04 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "HSV Portal Blueprint V1"
What `list_files` on the project root returns right now (dotfiles, if any, are not shown here):
📁 _ds
📁 assets
📁 ds
📁 screenshots
📁 uploads
📄 deck-stage.js
📄 HSV Article Page V1.dc.html
📄 HSV Component States V1.dc.html
📄 HSV Homepage V1.dc.html
📄 HSV News Index V1.dc.html
📄 HSV Portal - Blueprint V1.dc.html
📄 HSV Topic Page V1.dc.html
📄 image-slot.js
📄 support.js
User is viewing file: HSV Homepage V1.dc.html
Current date is now September 2, 2026
</system-info>

<attached aesthetic_system_instructions>
A design system or theme is attached to this project. That attachment already answers the visual-style question: apply it. Do NOT ask the user which visual style to use — no questions about vibe, colors or palette directions (including color-swatch svg-options questions), typography, mood, or art direction, and skip the "divergent visuals" question from the question-asking tips; offer divergent visual directions only if the user themselves asks for alternatives. This rule bans asking the user to pre-pick a style in the abstract — swatches, mood words, palette pickers. It does not ban asking them to choose among candidates you have already built: putting built candidates on a file-options board for the user to pick from is encouraged. Treat the attachment as the confirmed starting point and product context — the "confirm the starting point" tip is already satisfied, so do not ask the user to confirm or re-pick it. Spend your questions on everything else you need: audience, purpose, content, structure, scope, interactions, tone of copy.
</attached aesthetic_system_instructions>

<pasted_text name="Pasted text (916 lines)">
PROMPT NÂNG CẤP HSV PORTAL BLUEPRINT V1 → V2
Bạn là Senior Product Designer, UX Architect, Motion Designer và Frontend-aware UI Designer.
Nhiệm vụ của bạn là nâng cấp bản thiết kế hiện tại HSV Portal Blueprint V1 thành HSV Portal V2, theo hướng:
Premium Editorial + Digital Platform + Motion Experience 2026
Đây không phải bài tập concept hoặc thiết kế minh họa.
Mục tiêu là tạo ra một giao diện có thể triển khai thực tế bằng:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- GSAP + ScrollTrigger
- Framer Motion
- CSS Scroll-driven Animations
- View Transition API
- SVG
- Google Drive Media Service
- YouTube Embed/API
Mọi section, card, số liệu, trạng thái, nút, hiệu ứng và interaction xuất hiện trong thiết kế phải có khả năng ánh xạ sang:
- component frontend;
- dữ liệu;
- CMS/API;
- trạng thái;
- hành vi;
- responsive behavior;
- fallback;
- accessibility.
Không được thêm các thành phần chỉ để làm đẹp nếu không có cách triển khai thực tế.
I. NGUYÊN TẮC GIỮ LẠI TỪ V1
Giữ nguyên nền tảng cấu trúc của V1:
- Header
- Hero
- Tin tiêu điểm
- Dòng chảy sinh viên
- Tin mới nhất
- Video &amp; phóng sự
- Các nền tảng của Hội
- Đang diễn ra
- Ảnh hoạt động
- Tin từ cơ sở
- Footer
Không phá bỏ toàn bộ cấu trúc hiện tại.
Không thay đổi IA chỉ để làm giao diện đẹp hơn.
V2 phải là:
V1 structure + stronger visual hierarchy + stronger editorial composition + better motion + richer digital platform feel.
II. MỤC TIÊU VISUAL
Phong cách tổng thể:
Official + Editorial + Premium Minimalism + Digital Platform
Giao diện phải:
- chính thống;
- trẻ trung;
- hiện đại;
- có bản sắc riêng;
- nhiều khoảng trắng;
- hình ảnh lớn;
- typography mạnh;
- card gọn;
- bố cục bất đối xứng có kiểm soát;
- motion tinh tế;
- không giống website hành chính;
- không giống landing page quảng cáo.
Màu xanh nhận diện Hội Sinh viên Việt Nam:
- dùng làm accent;
- CTA;
- trạng thái;
- icon;
- hover;
- highlight;
không phủ xanh toàn bộ website.
Nên xen kẽ:
- white section;
- off-white section;
- dark editorial section;
- full-bleed media section.
III. CẤU TRÚC TRANG CHỦ V2 — THEO ĐÚNG THỨ TỰ
Trang chủ phải có thứ tự:
1. Header
2. Cinematic Hero
3. Trending Topics
4. Featured News
5. Dòng chảy sinh viên
6. Tin mới nhất
7. Video &amp; Phóng sự
8. Hoạt động sinh viên toàn quốc — Interactive Vietnam Map
9. Hệ sinh thái số Hội Sinh viên Việt Nam
10. Đang diễn ra
11. Ảnh hoạt động
12. Tin từ cơ sở
13. Footer
Không thay đổi thứ tự này nếu không có lý do UX rõ ràng.
IV. SECTION 1 — HEADER
Vị trí
Nằm trên cùng trang.
Desktop
Layout:
- bên trái: logo + “Hội Sinh viên Việt Nam”;
- giữa: navigation;
- bên phải: search + login/user.
Navigation:
- Tin tức
- Phong trào
- Sinh viên 5 tốt
- Hội nghị
- Đào tạo
- Giới thiệu
Trạng thái
Top state
- nền trắng hoặc trong suốt nhẹ;
- chiều cao khoảng 72–80px.
Scrolled state
Khi scroll:
- header sticky;
- chiều cao giảm;
- background gần trắng;
- backdrop blur nhẹ;
- border-bottom subtle;
- shadow rất nhẹ hoặc không shadow.
Motion
- height transition;
- nav position shift nhẹ;
- blur transition;
- không bounce.
Mobile
- logo trái;
- search;
- hamburger;
- menu mở drawer từ bên phải hoặc full-screen panel.
Component
Header
States
- top
- scrolled
- menu-open
- search-open
- logged-in
- logged-out
V. SECTION 2 — CINEMATIC HERO
Đây là khu vực quan trọng nhất.
V1 hiện còn quá giống corporate banner. V2 phải nâng rõ rệt.
Vị trí
Ngay sau Header.
Chiều cao
Desktop:
khoảng 72–85vh.
Không nhất thiết full 100vh.
Layout đề xuất
Bố cục bất đối xứng:
LEFT 40–45%
RIGHT 55–60%
Left
- category;
- headline lớn;
- sapo;
- metadata nhỏ;
- CTA chính;
- CTA phụ nếu cần.
Right
- media lớn;
- ảnh hoặc video cover;
- có crop mạnh;
- có gradient mask nhẹ.
Hero content
Ví dụ dữ liệu:
- category
- headline
- sapo
- coverMedia
- publishedAt
- articleUrl
Không dùng text marketing chung nếu Hero được xác định là bài nổi bật CMS.
Typography
Headline:
- editorial serif hoặc display font;
- kích thước lớn;
- 3–5 dòng tối đa;
- line-height chặt.
Body:
- sans-serif;
- width giới hạn;
- dễ đọc.
Background
- white / light neutral;
- hoặc dark teal editorial;
- không gradient cầu vồng;
- không quá nhiều glow.
Motion
On load
- headline reveal theo dòng;
- media opacity + scale;
- CTA fade-in.
On scroll
- media scale nhẹ;
- text opacity giảm nhẹ;
- background shift rất nhẹ;
- kết thúc Hero chuyển mượt sang Trending Topics.
Không được
- autoplay video có âm thanh;
- text bay quá mạnh;
- 3D rotation;
- particle effect;
- lens flare giả.
Component
HeroFeature
Data
CMS.
Fallback
Nếu không có video:
dùng image cover.
Nếu ảnh lỗi:
dùng branded placeholder.
VI. SECTION 3 — TRENDING TOPICS
Vị trí
Ngay dưới Hero.
Chiều cao
Gọn, khoảng 64–96px.
Layout
Một rail ngang:
- label: “Chủ đề nổi bật”
- sau đó các tag.
Ví dụ:
- #SinhVien5Tot
- #TinhNguyen
- #NghienCuuKhoaHoc
- #HoiNhapQuocTe
- #ChuyenDoiSo
Component
TrendingTopicRail
Data
CMS Tag / Topic System.
Desktop
- một dòng;
- có thể scroll ngang;
- có subtle auto marquee nếu tag quá nhiều.
Mobile
- horizontal native scroll;
- không ép xuống nhiều dòng.
Motion
- rất nhẹ;
- pill hover;
- horizontal movement chậm nếu dùng marquee.
Không làm giống crypto ticker.
VII. SECTION 4 — FEATURED NEWS / TIN TIÊU ĐIỂM
Vị trí
Sau Trending Topics.
Background
White.
Layout desktop
12-column grid.
Left
chiếm 7–8 columns:
01 bài Featured lớn
Right
chiếm 4–5 columns:
03 bài phụ dạng editorial list
Featured article
Có:
- cover image lớn;
- category;
- headline;
- sapo ngắn;
- metadata.
Image ratio:
khoảng 16:9 hoặc 3:2.
Secondary article
Không dùng boxed card quá nặng.
Nên gồm:
- thumbnail nhỏ;
- category;
- title;
- date.
Có divider nhẹ.
Interaction
Hover Featured:
- image scale 1 → 1.025;
- title color shift nhẹ.
Hover secondary:
- thumbnail scale nhẹ;
- indicator line xuất hiện.
Shared Image Transition
Khi click Featured News hoặc NewsCard:
cover image chuyển tiếp mượt sang Article Hero.
Implementation:
- View Transition API;
- fallback opacity + scale.
Component
- FeaturedNewsCard
- NewsListItem
Data
CMS.
VIII. SECTION 5 — DÒNG CHẢY SINH VIÊN
Đây là signature section quan trọng nhất.
Vị trí
Sau Featured News.
Background
Dark editorial:
- gần đen;
- deep navy;
- deep green-black.
Không dùng full green.
Intro
Ở đầu section:
- small label;
- heading “Dòng chảy sinh viên”;
- short description;
- “Cuộn để khám phá”.
Desktop behavior
Khi section vào viewport:
1. section được pin;
2. scroll dọc tiếp tục;
3. card rail di chuyển ngang;
4. user vẫn scroll dọc bình thường;
5. hết rail thì section release;
6. page tiếp tục sang Tin mới nhất.
Số card
5–7 card.
Không quá 10.
Card size
Lớn hơn V1.
Mỗi card khoảng:
- 28–36vw desktop;
- landscape ratio.
Nội dung card
- cover image;
- location;
- category;
- headline;
- publishedAt.
Ví dụ:
- Hà Nội
- TP. Hồ Chí Minh
- Đà Nẵng
- Nhật Bản
- Pháp
Active state
Card active:
- scale 1;
- opacity 1;
- text rõ;
- shadow/border subtle.
Card inactive:
- scale 0.93–0.96;
- opacity giảm nhẹ.
Background
Có thể có:
- very subtle line texture;
- ambient gradient;
- slight background parallax.
Không particle.
Desktop Implementation
GSAP ScrollTrigger.
Mobile
Không pin.
Không biến vertical scroll thành horizontal.
Dùng:
- native horizontal scroll;
- swipe;
- CSS scroll-snap.
Reduced Motion
Nếu prefers-reduced-motion:
- disable pinned animation;
- render static horizontal carousel.
Component
HorizontalStoryRail
IX. SECTION 6 — TIN MỚI NHẤT
Vị trí
Ngay sau Dòng chảy sinh viên.
Background
White hoặc off-white.
Mục tiêu
Không dùng grid card đều nhau như CMS mặc định.
Layout
Asymmetric editorial grid.
Ví dụ:
[ LARGE A ] [ SMALL B ]
[ LARGE C ] [ SMALL D ]
            [ SMALL E ]
hoặc:
2 columns:
left image-heavy
right text-heavy
Component
Dùng chung:
NewsCard
Variants:
- featured
- standard
- horizontal
- compact
Không tạo quá nhiều component khác nhau.
Mỗi card
Có:
- image;
- category;
- headline;
- metadata.
Không cần sapo cho tất cả card.
Visual Rhythm
Xen kẽ:
- image-heavy;
- text-heavy;
- wide;
- compact.
Mobile
Single column.
Có thể giữ 1 featured lớn đầu tiên.
X. SECTION 7 — VIDEO &amp; PHÓNG SỰ
Vị trí
Sau Tin mới nhất.
Background
Có thể dùng light gray hoặc dark cinematic tùy tổng thể.
Layout desktop
Left
2/3 width:
Featured Video lớn
Right
1/3 width:
3 video nhỏ dạng playlist
Featured Video
Có:
- thumbnail lớn;
- play button;
- category;
- headline;
- duration;
- metadata.
Video source
YouTube.
Không dùng video file trên VPS.
Component
- FeaturedVideoStory
- VideoStoryCard
- YouTubePlayer
Interaction
Hover:
- thumbnail scale nhẹ;
- play icon animate nhẹ.
Click:
- mở inline player;
  hoặc
- mở article/video page.
Không autoplay tất cả thumbnail.
XI. SECTION 8 — HOẠT ĐỘNG SINH VIÊN TOÀN QUỐC
Đây là section mới bắt buộc bổ sung ở V2.
Vị trí
Ngay sau Video &amp; Phóng sự.
Không đặt cuối trang.
Tên section
Hoạt động sinh viên trên toàn quốc
hoặc:
Dòng chảy hoạt động toàn quốc
Background
Light neutral.
Desktop layout
12-column grid:
Left 7 columns
Interactive SVG Vietnam Map.
Right 5 columns
Data/insight panel.
PHẦN BẢN ĐỒ
Không dùng
- Google Maps;
- screenshot map;
- decorative map;
- WebGL nặng.
Dùng
SVG Vietnam Map.
Mỗi tỉnh/thành là một path có ID riêng.
Data tối thiểu
province_id
province_name
article_count
activity_count
latest_article
latest_activity
category_distribution
updated_at
Không hard-code số tỉnh/thành.
Không hard-code activity count.
Map visualization
Mỗi tỉnh:
- neutral state;
- active state;
- hover state;
- selected state.
Mức activity có thể biểu thị bằng:
- opacity;
- tint intensity;
- dot count;
- point size.
Không dùng quá nhiều màu.
Map interaction desktop
Hover tỉnh:
- highlight path;
- tooltip xuất hiện.
Tooltip:
HÀ NỘI

126 hoạt động
48 tin bài

Tin mới nhất:
...

[Khám phá địa phương]
Click:
- select province;
- update right data panel;
- CTA sang /dia-phuong/[slug].
Data panel bên phải
Hiển thị:
Summary stats
- Tổng hoạt động;
- Tổng bài viết;
- Số đơn vị tham gia;
- Last update.
Chỉ hiển thị nếu API có dữ liệu.
Top locality
- địa phương nổi bật;
- hoạt động mới;
- tin mới.
Latest Activity
1–3 activity/article mới.
Filter phía trên map
Nếu taxonomy có dữ liệu:
- Tất cả
- Sinh viên 5 tốt
- Tình nguyện
- Nghiên cứu khoa học
- Hội nhập
Filter update map.
Không tạo filter nếu backend chưa có category mapping.
Mobile behavior
Không thu nhỏ nguyên desktop map.
Layout:
1. Map full width.
2. Tap province.
3. Bottom sheet mở.
4. Hiển thị:
   - tên tỉnh;
   - activity count;
   - article count;
   - latest article;
   - CTA.
5. Dưới map có Local Activity List fallback.
Component
ActivityMap
Implementation
- SVG
- React
- Framer Motion hoặc CSS
- API/CMS
XII. SECTION 9 — HỆ SINH THÁI SỐ HỘI SINH VIÊN VIỆT NAM
Vị trí
Sau Activity Map.
Mục tiêu
V1 hiện đang quá giống list card đơn giản.
V2 phải dùng Bento Grid.
Tên section
Hệ sinh thái số Hội Sinh viên Việt Nam
Platforms
- Hội nghị
- Đào tạo
- Sinh viên 5 tốt
- Tình nguyện
- Dữ liệu &amp; Báo cáo
Layout desktop
Ví dụ:
[ HỘI NGHỊ LARGE ] [ ĐÀO TẠO ]
                   [ SV 5 TỐT ]

[ TÌNH NGUYỆN ]    [ DỮ LIỆU ]
Không tất cả card bằng nhau.
Data
platformName
description
icon
url
status
currentActivity
ctaLabel
Trạng thái
- default
- active
- live
- upcoming
- maintenance
- unavailable
Ví dụ card Hội nghị
Nếu đang có hội nghị:
HỘI NGHỊ
● Đang diễn ra

Hội nghị BCH Trung ương Hội...

[Tham gia]
Nếu không:
HỘI NGHỊ

Điểm danh, tài liệu, góp ý, biểu quyết

[Truy cập]
Motion
Hover:
- elevation nhẹ;
- icon movement nhẹ;
- CTA translate 2–4px;
- ambient background shift rất nhẹ.
Không 3D tilt mạnh.
Component
PlatformBentoGrid
PlatformCard
XIII. SECTION 10 — ĐANG DIỄN RA
Vị trí
Sau Hệ sinh thái số.
Component
LiveEventRail
EventCard
Data
title
status
startAt
endAt
location
cover
participantCount
url
Status
- LIVE
- upcoming
- completed
Visual
LIVE:
- red indicator;
- pulse rất nhẹ.
Upcoming:
- teal/blue accent.
Completed:
- neutral.
Event card
Có:
- image;
- date;
- title;
- location;
- status;
- participant count nếu có;
- CTA.
Không giả participant count nếu backend không trả.
Desktop
Horizontal rail hoặc 3–4 card.
Mobile
Swipe.
XIV. SECTION 11 — ẢNH HOẠT ĐỘNG
Vị trí
Sau Đang diễn ra.
Mục tiêu
Thay gallery grid đều bằng Editorial Masonry Gallery.
Layout
Ví dụ:
[ LARGE ] [ SMALL ]
[ LARGE ] [ SMALL ]
[ MEDIUM ][ WIDE  ]
Không tất cả ảnh cùng tỷ lệ.
Image source
Google Drive Media Service.
Không dùng trực tiếp Google Drive URL.
Component
MediaGallery
MediaImage
Data
mediaId
caption
altText
articleUrl
orientation
Hover
- image zoom 1–2%;
- dark overlay nhẹ;
- caption fade in;
- category optional.
Click
- lightbox;
  hoặc
- photo story;
  hoặc
- article.
Must support
- landscape;
- portrait;
- missing;
- loading;
- error.
XV. SECTION 12 — TIN TỪ CƠ SỞ
Vị trí
Trước Footer.
Mục tiêu
Thể hiện mạng lưới Hội toàn quốc và ngoài nước.
Layout
Editorial local news list.
Không dùng card dày.
Mỗi item:
- avatar/logo đơn vị;
- organization name;
- province/country;
- title;
- publishedAt;
- optional thumbnail.
Data
organization
province_or_country
title
cover
publishedAt
url
Filter
Chỉ nếu taxonomy hỗ trợ:
- Tỉnh/thành
- Trường
- Hội ở nước ngoài
Component
LocalNewsStream
XVI. SECTION 13 — FOOTER
Background
Deep navy/green-black.
Nội dung
Column 1
Logo + giới thiệu ngắn.
Column 2
Về chúng tôi.
Column 3
Nền tảng số.
Column 4
Hỗ trợ.
Column 5
Social / newsletter.
Có thể có
- Facebook
- YouTube
- TikTok
- Instagram
- Zalo
Không
quá nhiều text.
XVII. ARTICLE PAGE CONNECTION
V2 Homepage phải thiết kế đồng thời khả năng liên kết sang Article Page.
Shared image transition
Mọi major news card cần có:
mediaId
articleId
transitionName
Khi click:
HOME CARD
↓
Shared Image Transition
↓
ARTICLE HERO
Fallback
Nếu browser không support View Transition:
opacity + scale.
XVIII. IMAGE SYSTEM
Frontend không sử dụng raw Drive URL.
Abstraction:
MediaImage(mediaId)
Media service tự:
- resolve Drive file;
- resize;
- cache;
- serve optimized format.
Design phải phản ánh:
- cover;
- gallery;
- responsive image;
- missing image;
- loading.
XIX. VIDEO SYSTEM
Video source:
YouTube.
Abstraction:
VideoPlayer(videoId)
Must support:
- thumbnail;
- duration;
- unavailable;
- removed;
- embed-disabled fallback.
XX. MOTION SYSTEM
Chỉ dùng 5 nhóm motion chính:
1. Cinematic Hero
2. Horizontal Story Rail
3. Shared Image Transition
4. Bento Ecosystem interaction
5. Activity Map subtle interaction
Các phần còn lại:
micro-animation nhẹ.
Motion tokens
fast: 150ms
normal: 280ms
slow: 500ms
cinematic: 700–900ms
Không dùng
- bounce mạnh;
- neon glow;
- continuous float;
- particle;
- heavy 3D;
- scroll hijacking toàn trang.
XXI. RESPONSIVE
Thiết kế ít nhất:
- 1440px
- 1280px
- 768px
- 390px
Không chỉ scale desktop.
Mỗi section phải có adaptation riêng.
Đặc biệt phải thiết kế riêng cho:
- Hero
- HorizontalStoryRail
- ActivityMap
- PlatformBentoGrid
- MediaGallery
XXII. ACCESSIBILITY
Mọi component phải xem xét:
- keyboard navigation;
- focus-visible;
- contrast;
- semantic HTML;
- alt text;
- reduced motion;
- ARIA cho interactive map;
- screen reader label.
XXIII. PERFORMANCE
Không thiết kế:
- nhiều video autoplay;
- nhiều blur/filter nặng;
- WebGL;
- quá nhiều animation chạy đồng thời.
Ưu tiên:
- transform;
- opacity;
- lazy-loading;
- responsive image;
- progressive enhancement;
- SVG;
- CSS/GSAP animation.
XXIV. PRODUCTION CONTRACT CHO MỖI SECTION
Mỗi section khi thiết kế phải kèm implementation note với đúng format:
SECTION NAME:

COMPONENT:

DATA REQUIRED:

DATA SOURCE:

DESKTOP BEHAVIOR:

MOBILE BEHAVIOR:

INTERACTION:

MOTION:

LOADING STATE:

EMPTY STATE:

ERROR/FALLBACK:

IMPLEMENTATION:

ACCESSIBILITY:
Nếu không thể điền đầy đủ các mục này thì không đưa section đó vào production design.
XXV. NHỮNG GÌ KHÔNG ĐƯỢC LÀM
Không:
- thêm chatbot;
- thêm AI recommendation;
- thêm live counter giả;
- thêm social feed giả;
- thêm số liệu hard-coded;
- thêm fake map data;
- thêm card chỉ để trang trí;
- thêm feature chưa có backend;
- đổi IA quá mạnh;
- dùng WebGL chỉ vì đẹp;
- thiết kế mobile như bản desktop thu nhỏ.
XXVI. YÊU CẦU ĐẦU RA CỦA V2
Khi hoàn thành, cung cấp:
1. Full homepage desktop 1440px.
2. Full homepage tablet.
3. Full homepage mobile 390px.
4. Component inventory.
5. Motion notes.
6. Implementation notes cho từng section.
7. Loading/empty/error state chính.
8. Responsive notes.
9. Danh sách component dùng lại.
10. Danh sách điểm còn phụ thuộc API/backend.
Không chuyển sang code production trong bước này.
XXVII. MỤC TIÊU CUỐI CÙNG
HSV Portal V2 phải tạo cảm giác:
- đây là cổng thông tin chính thức;
- nhưng không cũ;
- có tinh thần sinh viên;
- có năng lượng;
- có công nghệ;
- có chuyển động;
- có chiều sâu;
- có khả năng mở rộng sang toàn bộ hệ sinh thái số Hội Sinh viên Việt Nam.
Ưu tiên theo thứ tự:
Clarity → Content → Interaction → Motion → Decoration
Không hy sinh:
- readability;
- performance;
- codeability;
- responsive;
- accessibility;
để đổi lấy hiệu ứng thị giác.
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

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_skill_prompt]_

Reading the spec's map requirement against the maps skill — I'll build the Vietnam map from real geometry (world-atlas) as a plain-JS custom element, fed by a sample API payload rather than hardcoded numbers.

_[tool: write_file]_

_[tool: write_file]_

Now the V2 homepage — the main build.

_[tool: dc_write]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: multi_screenshot]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: update_todos]_

_[tool: ready_for_verification]_

**HSV Homepage V2** is up (`HSV Homepage V2.dc.html`), V1 untouched. All 13 sections in the mandated order, giữ IA của V1 + 2 section mới (Trending Topics, Activity Map).

Điểm chính:
- **Cinematic Hero** bất đối xứng 43/57, media full-bleed phải, headline reveal theo dòng, parallax + scale nhẹ khi scroll.
- **Dòng chảy sinh viên**: pin bằng sticky + translateX (scroll dọc vẫn native, không hijack); ≥1024px mới pin, dưới đó chuyển sang native scroll + scroll-snap; reduced-motion tắt hoàn toàn.
- **ActivityMap**: geometry thật (Natural Earth, d3-geo) trong web component riêng; dữ liệu đọc từ `data/activity-map.sample.json` mô phỏng `GET /api/v1/activity-map` — số tỉnh, số liệu, filter đều từ payload, không hard-code; hover tooltip, click → panel/bottom sheet, keyboard + ARIA, có loading/empty/error và local list fallback.
- Tweaks: trạng thái dữ liệu tin, trạng thái API bản đồ, live events, hội nghị live, logged-in.

Hai phần còn lại trong danh sách: **doc production notes** (contract từng section, component inventory, motion notes, danh sách phụ thuộc backend) và **board responsive 768/390**. Tôi đã chạm giới hạn quota của phiên này — nhắn "tiếp tục" là tôi làm hai phần đó.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Đã sửa: `--sp-7` → `--sp-8` (padding ô Hội nghị), và bỏ `@view-transition` khỏi trang blueprint — shared image transition ghi chú lại là việc của app Next.js, blueprint giữ fallback opacity/scale nên không còn console error.

## User

Check didn’t complete

## Assistant

## User

Còn lại bao nhiêu phần chưa thực hiện? Lên phương án chia nhỏ phù hợp với limit ngày để triển khai

## Assistant

Đã xong 1/10 mục đầu ra ở mục XXVI (bản desktop 1440 + ActivityMap). Còn lại 9 mục, gom thành 3 lô, mỗi lô ~1 phiên làm việc:

**Lô 1 — Responsive board** (mục 2, 3, 8)
`HSV Homepage V2 Responsive.dc.html`: 3 khung cạnh nhau — 1280, 768, 390 — nhúng chính V2 nên không phải dựng lại, kèm responsive notes cho 5 section bắt buộc (Hero, StoryRail, ActivityMap, BentoGrid, MediaGallery).

**Lô 2 — States board** (mục 7)
Cập nhật `HSV Component States` cho V2: loading / empty / error của NewsCard, ActivityMap, VideoPlayer, MediaImage, LiveEventRail + trạng thái Header và PlatformCard (default/live/upcoming/maintenance/unavailable).

**Lô 3 — Production doc** (mục 4, 5, 6, 9, 10)
`HSV Portal V2 Production Notes` dạng doc in được: contract 13 section theo đúng format XXIV, component inventory + danh sách dùng lại, motion notes theo 5 nhóm + token, và danh sách phụ thuộc API/backend.

Thứ tự đề xuất: Lô 3 trước (giá trị cao nhất cho bàn giao), rồi Lô 1, cuối là Lô 2. Nhắn "làm lô 3" (hoặc lô khác) là tôi bắt đầu.

## User

Làm tuần tự theo các lô như đề xuất

## Assistant

_[tool: copy_starter_component]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

**Lô 3 xong** — `HSV Portal V2 Production Notes.dc.html`, doc in được (xuất PDF trực tiếp).

Gồm: hợp đồng 13 section theo đúng format mục XXIV (13 mục/section, thêm dòng RESPONSIVE), component inventory 24 component kèm variants + props + nơi dùng lại, motion notes theo 5 nhóm + token thời lượng + danh sách cấm, và 10 điểm phụ thuộc API/backend kèm hành vi bắt buộc khi backend chưa có.

Tiếp theo là **Lô 1 — Responsive board** (1280 / 768 / 390 + responsive notes). Nhắn "tiếp" là tôi làm.

## User

Ok làm đi

## Assistant

_[tool: dc_write]_

_[tool: show_html]_

_[tool: ready_for_verification]_

**Lô 1 xong** — `HSV Homepage V2 Responsive.dc.html`.

Ba khung 1280 / 768 / 390 là bản V2 thật đang chạy ở đúng bề rộng thiết bị (cuộn và bấm được trong khung, không phải ảnh chụp), kèm ghi chú nhánh layout của từng khung. Dưới đó là responsive notes cho 5 section bắt buộc — Hero, StoryRail, ActivityMap, BentoGrid, MediaGallery — mỗi section một bảng 4 breakpoint kèm ngưỡng chuyển nhánh, cộng 4 nguyên tắc chung (ngưỡng, không thu nhỏ desktop, hover có đường thay thế, vùng bấm/cỡ chữ).

Còn **Lô 2 — States board** cho V2. Nhắn "tiếp" là tôi làm.

## User

Re-running the check

## User

Re-running the check

## User

Làm tiếp

## Assistant

_[tool: dc_write]_

_[tool: ready_for_verification]_

**Lô 2 xong** — `HSV Component States V2.dc.html`. Cả ba lô đã hoàn tất, đủ 10 mục đầu ra của XXVI.

Board gồm: NewsCard (loaded / skeleton / ảnh lỗi / empty), ActivityMap (loading / error endpoint / empty + fallback list), VideoPlayer và MediaImage (6 trạng thái gồm embed-disabled, removed, missing mediaId), PlatformCard đủ 5 trạng thái registry, EventCard live/upcoming/completed, Header 4 trạng thái gồm SSO không phản hồi — cộng 4 nguyên tắc chung về empty/skeleton/lỗi/màu.

Bộ bàn giao V2 hiện có 4 tệp: trang chủ V2, responsive board, production notes (in được ra PDF), states board.

## User

Cập nhật lại Việt Nam có 34 tỉnh thành và bổ sung quần đảo hoàng Sa Trường Sa trên bản đồ hiển thị mang tính chất minh họa

## Assistant

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

Đã cập nhật payload sang **34 đơn vị hành chính cấp tỉnh** (6 thành phố trực thuộc Trung ương + 28 tỉnh sau sáp nhập 2025), số liệu tổng hợp lại theo đó — bản đồ đang vẽ đúng 34 điểm.

Khung chiếu mở rộng ra Biển Đông để hiển thị **quần đảo Hoàng Sa** (TP. Đà Nẵng) và **quần đảo Trường Sa** (tỉnh Khánh Hoà): mỗi quần đảo là một cụm điểm đảo vẽ từ toạ độ trong payload, có khung nét đứt và nhãn tên kèm đơn vị quản lý, cùng aria-label cho screen reader. Dưới bản đồ có chú thích rõ hai quần đảo thuộc chủ quyền Việt Nam, vị trí hiển thị mang tính chất minh hoạ và không tính vào 34 đơn vị báo cáo.

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

Đã sửa: kích thước bản đồ giờ tính từ bề rộng còn lại sau khi trừ rail xếp hạng (không còn suy ra từ chiều cao), tỷ lệ khung chiếu tính động từ VIEW_BBOX. Bản đồ và rail "Địa phương nổi bật" nằm cạnh nhau ở layout hai cột — kiểm tra tại 808px host: stage 544×581, rail cùng hàng, 34 điểm tỉnh + 2 quần đảo đầy đủ. Skeleton loading cũng dùng đúng tỷ lệ mới nên không nhảy layout.

## User

Found issues — fixing…

## Assistant

_[tool: read_file]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: multi_screenshot]_

Bản đồ chạy đúng: 34 điểm tỉnh + 2 quần đảo, bản đồ và rail xếp hạng nằm cạnh nhau.

Nguyên nhân treo là vòng lặp vẽ lại: ResizeObserver quan sát cả chiều cao, mà `paint()` lại đặt chiều cao stage → host cao lên → gọi lại `paint()` liên tục. Giờ chỉ vẽ lại khi bề rộng host đổi quá 8px.

## User

Trang chủ chưa hiện bản đồ

## Assistant

_[tool: show_html]_

_[tool: eval_js_user_view]_

_[tool: eval_js_user_view]_

_[tool: grep]_

_[tool: grep]_

Khung xem của bạn đang hiển thị **V1**, không phải V2 — nên không có section bản đồ. Tệp V2 vẫn đầy đủ 13 section. Tôi mở lại V2 trong tab của bạn:

_[tool: ready_for_verification]_

Đã mở lại `HSV Homepage V2.dc.html` — cuộn tới section 8 "Hoạt động sinh viên trên toàn quốc" sẽ thấy bản đồ 34 tỉnh, thành kèm Hoàng Sa và Trường Sa. Trước đó tab đang mở bản V1 (V1 không có section bản đồ).

