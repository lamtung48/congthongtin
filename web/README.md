# HSV Portal — Homepage V2

Triển khai Next.js (App Router) + TypeScript + CSS Modules cho `HSV Homepage V2.dc.html`,
bản thiết kế trang chủ Cổng thông tin số Hội Sinh viên Việt Nam từ gói bàn giao Claude Design
(xem `../README.md`, `../chats/`, `../project/` ở thư mục gốc repo).

## Phạm vi

Toàn bộ 13 section của trang chủ theo đúng thứ tự đã duyệt: Header, Cinematic Hero, Trending
Topics, Featured News, "Dòng chảy sinh viên" (rail cuộn ngang có pin trên desktop, fallback
scroll-snap gốc trên mobile/reduced-motion), Latest News (lọc + tải thêm), Video & Phóng sự,
bản đồ hoạt động sinh viên toàn quốc (SVG 34 tỉnh/thành + Hoàng Sa/Trường Sa + quả địa cầu 16
Hội Sinh viên ở nước ngoài), Hệ sinh thái số (bento 5 nền tảng), Đang diễn ra (rail sự kiện),
Ảnh hoạt động (mosaic + lightbox), Tin từ cơ sở, Footer.

Dữ liệu là fixture tĩnh (`src/lib/data/`, `public/data/activity-map.json`) mô phỏng dữ liệu
CMS/API thật — chưa có backend. Ảnh dùng placeholder trung tính có ghi chú ảnh cần bổ sung
(`MediaPlaceholder`), vì gói bàn giao chưa kèm ảnh tư liệu chính thức.

Các trang liên kết khác trong gói thiết kế (`HSV Article Page V1`, `HSV News Index V1`,
`HSV Topic Page V1`, các trang phong trào/hội nghị/đào tạo) chưa được triển khai — nằm ngoài
phạm vi yêu cầu lần này. Các liên kết trỏ tới đó dùng `prefetch={false}` để không phát sinh
404 console trong lúc chờ.

## Chạy thử

```bash
npm install
npm run dev
```

Mở http://localhost:3000.

```bash
npm run build && npm run start   # kiểm tra bản production
npx tsc --noEmit                  # type-check
npx eslint .                      # lint
```
