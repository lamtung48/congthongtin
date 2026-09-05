# Ecosystem integration: Platform Registry + API Adapters

Integration layer for the ecosystem "vệ tinh" platforms — Hội nghị, Đào
tạo, Sinh viên 5 tốt, Tình nguyện — plus any added later. Covers: the
`/admin/platforms` management UI, the extended `Platform` model, the
per-category API adapter layer, and how a dead external platform is kept
from ever taking the public portal down with it.

## 1. Platform Management (`/admin/platforms`)

| Role | Can do |
|---|---|
| ADMIN | Toàn quyền — nội dung/hiển thị **và** cấu hình tích hợp kỹ thuật, tạo/xoá nền tảng. |
| MANAGER | Chỉ nội dung/hiển thị: tên, mô tả, URL, icon, CTA, thứ tự, trạng thái hiển thị, bật/tắt, hoạt động hiện tại, và bấm "Làm mới trạng thái". Không tạo/xoá nền tảng, không sửa danh mục/loại tích hợp/apiBaseUrl. |
| CONTRIBUTOR | Không truy cập `/admin/platforms` — `requireAnyPermission(["platform.manage","platform.manage.display"])` trả **403** thật ở server, không phải chỉ ẩn link. Ngoài CMS, Contributor dùng platform link công khai như bất kỳ khách nào. |

Route guard: `/admin/platforms` và `/admin/platforms/[id]/edit` dùng
`requireAnyPermission(["platform.manage", "platform.manage.display"])`
(ADMIN hoặc MANAGER vào được); `/admin/platforms/new` và nút Xoá dùng
`requirePermission("platform.manage")` (ADMIN only). Edit page render cả
hai form "Nội dung/hiển thị" và "Tích hợp kỹ thuật" cho MANAGER, nhưng bọc
form thứ hai trong `<fieldset disabled>` và không hiện nút submit — Manager
**thấy** cấu hình apiBaseUrl/integrationType của một nền tảng nhưng không
sửa được, thay vì bị giấu hoàn toàn (minh bạch hơn, và việc ẩn UI dù sao
cũng không phải là cơ chế bảo vệ thật — server luôn re-check quyền độc lập
trong `platformService.update()`).

## 2. Platform model

```
id, name, slug, description, iconMediaId, baseUrl(*), status,
integrationType, apiBaseUrl, currentActivity, ctaLabel, order, isEnabled
```

(*) cột thật trong schema tên là `url` — giữ tên đã có từ trước
(`Platform.url`), không đổi tên chỉ để khớp chữ "baseUrl" trong brief; đây
là URL công khai của nền tảng (nơi CTA dẫn tới), khác với `apiBaseUrl`
(endpoint API nội bộ chỉ adapter gọi).

Ba field khác giữ nguyên từ nhiệm vụ trước vì UI hiện tại (`EcosystemBento`,
`buildPlatformView`) vẫn cần: `category` (giống enum `PlatformCategory` có
sẵn), `accessLevel`, `metric`. `liveActivityNote` được **đổi tên** thành
`currentActivity` — cùng một khái niệm ("đang có gì diễn ra ngay bây giờ"),
tên mới khớp brief và phản ánh đúng việc trường này giờ có thể được adapter
ghi đè, không chỉ do biên tập viên gõ tay. Migration dùng `RENAME COLUMN`
(không drop+add) để giữ dữ liệu "Hội nghị Ban Chấp hành..." đã seed sẵn.

`currentActivityUpdatedAt` (thêm mới, không có trong brief) ghi lại lần
"Làm mới trạng thái" gần nhất — không có cột này thì không cách nào phân
biệt "dữ liệu vừa được adapter xác nhận" với "dữ liệu ai đó gõ tay ba tháng
trước", cả hai đều chỉ là một chuỗi text nếu không có nhãn thời gian.

## 3. Integration types

`PlatformIntegrationType`: `EXTERNAL_LINK` | `API` | `SSO_READY`.

**Không nền tảng nào được nhúng iframe**, bất kể loại tích hợp — mọi CTA
luôn là `<a href>` thật ra ngoài (`EcosystemBento.tsx`'s `PlatformCta`,
không đổi từ nhiệm vụ trước). `integrationType` chỉ quyết định một điều
duy nhất trong hệ thống: liệu `platformService.refreshActivity()` có được
phép gọi ra ngoài hay không (`API` — có adapter phù hợp; hai loại còn lại
luôn bị từ chối ngay, không có gì để "làm mới"). `SSO_READY` là một phân
loại ghi nhận cho tương lai — nhiệm vụ này chưa hiện thực một luồng SSO
thật, chỉ đảm bảo schema/adapter sẵn sàng mở rộng mà không cần migrate lại
khi luồng đó được xây.

## 4. Homepage: Bento Grid dùng Platform Registry thật

`EcosystemBento.tsx` trước đây destructure 5 platform theo **vị trí mảng**
(`const [conference, training, sv5tot, volunteer, data] = platforms`) —
giả định ngầm là `getPlatforms()` luôn trả đúng 5 phần tử theo đúng thứ tự
category cố định. Sau nhiệm vụ này, mỗi ô tra bằng `platforms.find(p =>
p.category === "...")` — đúng dữ liệu bất kể thứ tự DB trả về, và không
crash nếu một category không có platform nào đang `isEnabled` (xem mục 6).

`homepageRepository.fallback.platforms()` giờ lọc `isEnabled: true` và sắp
theo `order asc` (trước đây sắp theo `createdAt desc`, không lọc
`isEnabled` — một platform bị tắt vẫn lọt vào fallback). CMS placement path
(`resolvePlatformPlacements`) cũng được vá tương tự: một `HomepagePlacement`
ghim vào một platform đã bị tắt thì bị bỏ qua, không phải bypass cho
`isEnabled` (cùng logic Production Data Policy áp dụng cho Article).

## 5. API Adapter layer

`src/server/integrations/platformAdapters/` — bốn adapter đúng tên brief,
mỗi cái implement chung interface `PlatformAdapter.fetchActivity({apiBaseUrl})`:

- `conferenceAdapter.ts` — `CONFERENCE`
- `trainingAdapter.ts` — `TRAINING`
- `student5GoodAdapter.ts` — `SV5TOT`
- `volunteerAdapter.ts` — `VOLUNTEER`

`DATA` cố tình **không có adapter** — đây là một "sắp ra mắt" tĩnh
(`platformView.ts`'s `"data"` branch), không phải hệ thống ngoài thật nào
để gọi; `registry.ts`'s `getAdapterForCategory("DATA")` trả `undefined`,
và `refreshActivity()` từ chối rõ ràng thay vì crash trên một lookup rỗng.

Mỗi adapter tự parse đúng JSON hình dạng nó kỳ vọng từ `{apiBaseUrl}/status`
(qua `zod`) — đây là **đề xuất hợp đồng của riêng nhiệm vụ này**, không
phải spec thật (chưa có hệ thống Hội nghị/Đào tạo/SV5T/Tình nguyện thật để
tham chiếu); mỗi file có comment nêu rõ điều này. Không adapter nào chứa
logic hiển thị (label, badge, màu) — chỉ trả `{ok, currentActivity,
status?}` hoặc một trong 4 loại lỗi (`not_configured | timeout |
network_error | invalid_response`), giữ đúng "không nhồi business logic
vào UI": UI (`EcosystemBento`) chỉ vẽ theo `Platform.currentActivity`/
`status` đã lưu trong DB, không bao giờ tự parse phản hồi API.

`httpJson.ts` là nơi duy nhất gọi `fetch()` thật — timeout 5s qua
`AbortSignal.timeout()`, không bao giờ throw ra ngoài (mọi lỗi được gói
lại thành một trong 3 `reason` ở trên).

## 6. Failure isolation — "External platform chết: Portal vẫn hoạt động"

Đây là quyết định kiến trúc quan trọng nhất của nhiệm vụ: **không route
công khai nào từng gọi ra một platform API cả**. `getPlatforms()`
(`DatabaseProvider`, được `page.tsx` gọi lúc render trang chủ) luôn chỉ đọc
`Platform.currentActivity`/`status` đã lưu sẵn trong Postgres — dù nền tảng
Đào tạo thật có sập bao lâu, trang chủ vẫn render tức thì với dữ liệu lần
làm mới gần nhất (hoặc giá trị biên tập viên gõ tay nếu chưa từng làm mới
lần nào).

Lệnh gọi ra ngoài **duy nhất** trong toàn hệ thống là
`platformService.refreshActivity()` — một hành động Admin/Manager chủ động
bấm ("Làm mới trạng thái"), không bao giờ tự động chạy trên request công
khai. Khi adapter thất bại (timeout/lỗi mạng/phản hồi sai định dạng):

- `currentActivity`/`currentActivityUpdatedAt` trong DB **giữ nguyên** —
  không ghi đè bằng giá trị rỗng/lỗi.
- Không audit log nào được ghi cho lần thất bại (một lần refresh lỗi không
  phải một thay đổi nội dung).
- Người bấm nút thấy thông báo lỗi ngay tại chỗ
  (`RefreshActivityButton.tsx`), trang không crash, không toàn màn hình lỗi.

Đã kiểm chứng thủ công bằng Playwright: đặt `apiBaseUrl` trỏ tới một
hostname không tồn tại, bấm "Làm mới trạng thái" thật (không mock) → nhận
đúng thông báo lỗi mạng, trang vẫn render bình thường, `currentActivity` cũ
không đổi.

## 7. Role x display state

`platform.manage.display` (ADMIN + MANAGER) là quyền duy nhất cần để bật/
tắt một platform (`isEnabled`) hoặc sửa `status`/`currentActivity`/mọi field
nội dung khác. CONTRIBUTOR không giữ quyền này lẫn `platform.manage` — họ
chỉ dùng được platform link công khai giống một khách bất kỳ (không có gì
đặc biệt để "phân quyền" ở phía dùng-link, vì đó không phải một hành động
quản trị).

## 8. Audit

`UPDATE_PLATFORM` (mọi thay đổi field, cả nhóm hiển thị lẫn tích hợp — kèm
`metadata.fields` liệt kê tên field đã đổi, hoặc `metadata.source:
"adapter-refresh"` khi do `refreshActivity()` ghi), `ENABLE_PLATFORM`/
`DISABLE_PLATFORM` (riêng biệt, đúng brief) khi bật/tắt hiển thị. Tạo/xoá
một `Platform` dùng `CREATE`/`DELETE` chung (đã có sẵn trong enum, cùng quy
ước với `EventService`/`MediaService` — chỉ những transition brief liệt kê
tên riêng mới có action riêng).

## 9. Test

`authorization.test.mts`, describe `"Ecosystem integration — Platform"` —
gọi thẳng `platformService`/`platformRepository`, không qua HTTP (đúng
nguyên tắc "test truy cập trực tiếp API/server action" xuyên suốt dự án):

- CONTRIBUTOR bị chặn ở mọi method (update cả hai nhóm field, setEnabled,
  refreshActivity, create, remove).
- MANAGER sửa được nội dung/hiển thị, bị chặn ở nhóm tích hợp kỹ thuật và
  create/remove.
- ADMIN toàn quyền cả hai nhóm, tạo/xoá được.
- ENABLE_PLATFORM/DISABLE_PLATFORM ghi đúng audit action.
- `refreshActivity` thành công cập nhật `currentActivity` + ghi
  `UPDATE_PLATFORM` với `source: "adapter-refresh"`.
- `refreshActivity` thất bại (mock adapter trả `timeout`) **không xoá**
  `currentActivity` cũ — brief mục 6.
- `refreshActivity` từ chối cho `EXTERNAL_LINK`/danh mục `DATA` (không có
  adapter) mà **không hề gọi tới adapter** (đếm số lần gọi bằng
  `mockAdapterCallCount`).
- Platform bị `isEnabled: false` không xuất hiện trong
  `platformRepository.listEnabled()` (đường fallback công khai).

Adapter thật (gọi `fetch()`) được mock ở tầng `@/server/integrations/
platformAdapters/registry` (`mock.module`, cùng cách nhiệm vụ Google
Drive/YouTube trước đó đã làm) — production code không hề giả lập gì, chỉ
lớp gọi API ngoài bị thay thế trong test.

Playwright thủ công (không mock): xác nhận CONTRIBUTOR nhận 403 thật ở
`/admin/platforms`; MANAGER vào được danh sách/trang sửa nhưng không thấy
nút "Lưu tích hợp" và bị chặn ở `/admin/platforms/new`; ADMIN đặt một
`apiBaseUrl` trỏ tới hostname không tồn tại rồi bấm "Làm mới trạng thái"
thật — nhận đúng lỗi mạng, trang không crash; trang chủ vẫn render Bento
Grid bình thường trong suốt quá trình.

`npx tsc --noEmit`, `npx eslint .`, `npm test` (63/63), `npm run build` đều
sạch.
