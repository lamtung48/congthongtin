# Social/External Content Collector

Thu thập nội dung từ các nguồn bên ngoài (Facebook Page, RSS, Website,
YouTube channel) hoặc dán tay, đưa vào một hàng đợi kiểm duyệt (Social
Inbox) trước khi biến thành bài viết CMS thật. **Không có nội dung ngoài
nào tự động lên trang** — mọi thứ đi qua Draft → Review → Publish như một
bài viết bình thường.

**Không dùng browser automation để scrape Facebook.** Facebook chỉ được
đọc qua Meta Graph API chính thức (Page access token, whitelist theo
Page cụ thể) — brief cấm rõ việc giả lập trình duyệt, và hệ thống cũng
không tự nhận là có khả năng "tìm kiếm hashtag trên toàn Facebook" (điều
Graph API không cung cấp cho một Page token).

## 1. Phân quyền

| Hành động | ADMIN | MANAGER | CONTRIBUTOR |
|---|---|---|---|
| Xem `/admin/sources` | ✓ | ✓ (chỉ xem) | ✗ (403) |
| Cấu hình Source (tạo/sửa/token/enable-disable/xoá) | ✓ | ✗ | ✗ |
| Chạy đồng bộ (Sync) một Source | ✓ | ✗ | ✗ |
| Xem `/admin/social-inbox` | ✓ | ✓ | chỉ nếu có item được giao |
| Ignore / Assign / thêm item thủ công | ✓ | ✓ | ✗ |
| Convert to Article — bất kỳ item nào | ✓ | ✓ | ✗ |
| Convert to Article — item đã được giao cho mình | ✓ | ✓ | ✓ |

Bốn permission mới: `source.manage` (ADMIN), `source.view` (ADMIN +
MANAGER — chỉ đọc, không viết), `social_inbox.manage` (ADMIN + MANAGER),
`social_inbox.convert_own` (CONTRIBUTOR — chỉ item đã assign cho chính
mình). Route guard dùng `requirePermission`/`requireAnyPermission` ở
Server Component + mọi Server Action re-check độc lập trong
`sourceService`/`socialInboxService` — không có action nào chỉ dựa vào ẩn
nút bấm trên UI.

## 2. Source types

`SourceType`: `FACEBOOK_PAGE` | `RSS` | `WEBSITE` | `YOUTUBE` |
`MANUAL_EXTERNAL`.

`MANUAL_EXTERNAL` là một **Source singleton** duy nhất (`id:
"manual-external"`, seed sẵn trong `prisma/seed.ts`, cùng kiểu fixed-row
với `YoutubeConnection.id: "default"`), không có adapter, không thể xoá,
không xuất hiện trong danh sách "tạo Source mới" (chỉ tồn tại để mọi item
dán tay có một `sourceId` để gắn vào).

## 3. Kiến trúc thu thập

```
Source (config, credential mã hoá)
  → getFetcherForSourceType(type)   [src/server/integrations/socialCollector/registry.ts]
  → fetcher.fetchPosts()            [facebookPageSource / rssSource / websiteSource / youtubeChannelSource]
  → NormalizedExternalPost[]        [chuẩn hoá chung, bất kể nguồn]
  → passesHashtagRules() lọc        [normalize.ts — CHỈ áp dụng sau khi đã fetch hợp lệ, brief mục 9]
  → findDuplicate() khử trùng       [sourceService.ts, brief mục 7]
  → ExternalItem (PENDING_REVIEW)   [Social Inbox]
```

- **`facebookPageSource`**: gọi đúng một endpoint Graph API —
  `/{page-id}/posts?fields=id,message,permalink_url,created_time`, dùng
  Page access token đã lưu (mã hoá). Không có, và không giả lập, tính
  năng tìm kiếm hashtag toàn Facebook.
- **`rssSource`**: parse RSS 2.0 và Atom bằng `fast-xml-parser`.
- **`websiteSource`**: fetch nhẹ (không headless browser). Nếu trang có
  `<link rel="alternate" type="application/rss+xml">` → tự động chuyển
  sang `rssSource`. Nếu không, chỉ unfurl **đúng một** `ExternalItem` từ
  Open Graph / `<title>` của URL đã cấu hình — cố tình không cào nhiều
  bài từ một trang chỉ mục (không đáng tin cho một "fetch nhẹ").
- **`youtubeChannelSource`**: YouTube Data API v3 `search.list` bằng API
  key công khai (không cần OAuth, vì đọc kênh public) — độc lập hoàn
  toàn với `src/server/integrations/youtube.ts` (kênh upload OAuth của
  chính hệ thống).

## 4. Social Inbox — vòng đời một `ExternalItem`

```
                 ┌────────────────┐
   fetch/paste → │ PENDING_REVIEW │ ──ignore──→ IGNORED
                 └───────┬────────┘
                         │ assign
                         ▼
                 ┌────────────────┐
                 │    ASSIGNED    │ ──ignore──→ IGNORED
                 └───────┬────────┘
                         │ convert to article
                         ▼
                 ┌────────────────┐
                 │    CONVERTED   │  (articleId gắn vào Article DRAFT)
                 └────────────────┘
```

`IGNORED`/`CONVERTED` là trạng thái cuối — không có action nào đưa item
quay lại `PENDING_REVIEW`/`ASSIGNED` (khớp UI: hai tab "Đã chuyển bài" /
"Đã bỏ qua" chỉ để xem lại).

**Convert to Article** luôn tạo bài ở trạng thái **DRAFT** — brief mục 6:
"Không auto publish external content." Từ đó bài đi qua đúng workflow
biên tập sẵn có (Draft → Submit → Review → Approve → Publish), không có
đường tắt nào. Nội dung fetch được đưa vào một block `PARAGRAPH`, kèm một
block `QUOTE` ghi `cite` là URL gốc — dùng để ghi nguồn thay vì đặt
`Article.canonicalUrl` trỏ ra ngoài (sẽ sai về SEO một khi bài được xuất
bản dưới URL của chính hệ thống).

## 5. Khử trùng lặp (brief mục 7)

`sourceService`'s `findDuplicate()`, theo đúng thứ tự:

1. Cùng `sourceId` + `externalId` (ràng buộc `@@unique` ở schema làm lưới
   an toàn thứ hai).
2. Cùng `url` (toàn cục, không giới hạn theo Source).
3. Cùng `sourceId` + `normalizedContentHash` (nội dung đã lowercase, gộp
   khoảng trắng) trong cửa sổ ±48 giờ quanh `publishedAt` của bài mới
   (hoặc quanh "bây giờ" nếu bài không có ngày đăng).

Việc dán tay (`createManual`) cũng chạy qua kiểm tra URL + content-hash
này, gắn vào Source `manual-external`.

## 6. Bộ lọc hashtag (brief mục 9)

`Source.includeHashtags` / `excludeHashtags` chỉ được áp dụng **sau khi**
`fetchPosts()` đã trả dữ liệu thật — không có chuyện "tìm theo hashtag
trên toàn nền tảng". `excludeHashtags` luôn thắng nếu một bài khớp cả hai
danh sách (`passesHashtagRules` trong `normalize.ts`). Danh sách rỗng ở
`includeHashtags` nghĩa là "nhận tất cả" (trừ những gì bị exclude).

## 7. Xử lý lỗi (brief mục 10)

`SourceFetchResult` trả một trong bốn lý do thất bại, hiển thị rõ trong
`/admin/sources` (cột "Lỗi gần nhất") và luôn đưa `Source.status` về
`ERROR`:

| `reason` | Khi nào |
|---|---|
| `token_expired` | Graph API code 190; YouTube `keyInvalid`/`forbidden`/`badRequest` |
| `quota_exceeded` | Graph API code 4/17/32/613; YouTube `quotaExceeded`/`dailyLimitExceeded`/`rateLimitExceeded` |
| `network_error` | Timeout hoặc lỗi kết nối ở tầng HTTP (`httpClient.ts`) |
| `invalid_source` | Bất kỳ lỗi cấu hình/response nào khác, kể cả gọi `sync()` trên `MANUAL_EXTERNAL` (không có fetcher) |

## 8. Bảo mật thông tin đăng nhập (brief mục 11)

- `Source.encryptedCredential` mã hoá AES-256-GCM bằng
  `src/server/crypto/secretBox.ts` — **module và biến môi trường
  (`SOURCE_CREDENTIAL_ENCRYPTION_KEY`) độc lập hoàn toàn** với
  `youtube.ts`'s `YOUTUBE_TOKEN_ENCRYPTION_KEY`: một credential Facebook
  bị lộ và một refresh token YouTube bị lộ là hai sự cố không liên quan,
  không nên chung một key.
- `sourceRepository`'s `publicSelect` loại bỏ `encryptedCredential` khỏi
  **mọi** đường đọc, trừ `findByIdWithCredential` — hàm này chỉ được gọi
  từ một nơi duy nhất (`sourceService.sync()`), ngay trước khi giải mã và
  đưa cho adapter, không bao giờ trả ra khỏi bất kỳ hàm export nào khác.
  Contributor không có cách nào chạm tới giá trị này dù ở tầng nào.
- Form sửa Source hiển thị ô credential trống với placeholder "để trống
  nếu không đổi" — không bao giờ hiển thị lại giá trị đã lưu.

## 9. Audit log (brief mục 12)

| Action | Khi nào |
|---|---|
| `CREATE_SOURCE` | Tạo Source mới |
| `UPDATE_SOURCE` | Sửa cấu hình/hiển thị, hoặc bật/tắt (`isEnabled`) |
| `SYNC_SOURCE` | Mỗi lần chạy sync — **ghi cả khi thành công lẫn thất bại** (metadata gồm `ok`, `reason`/`fetched`/`stored`) |
| `IGNORE_EXTERNAL` | Bỏ qua một `ExternalItem` |
| `ASSIGN_EXTERNAL` | Giao item cho Contributor |
| `CONVERT_EXTERNAL` | Chuyển item thành Article (kèm `articleId`) |

Xoá Source dùng lại action `DELETE` chung (không có action riêng theo
brief).

## 10. Test

`src/server/__tests__/authorization.test.mts` — hai `describe` block
"Social/External Content Collector — Source" và "— Social Inbox" (16
test), chạy trên database dev thật. Chỉ `getFetcherForSourceType` bị mock
ở tầng test (`mock.module` thay `@/server/integrations/socialCollector/registry`)
— mọi rule về quyền, dedup, lọc hashtag, xử lý lỗi, audit, và
"không auto publish" bên trong `sourceService`/`socialInboxService` chạy
thật. Bao phủ: phân quyền 3 role trên `sourceService` (view/manage/sync),
credential không bao giờ lộ qua `list()`/`getById()`, cả 4 loại lỗi sync,
lọc hashtag include/exclude, cả 3 trục khử trùng lặp, scoping
`listForActor`/`canView` theo role, `assign()` yêu cầu Contributor đang
ACTIVE + tạo notification, `convertToArticle()` luôn DRAFT + từ chối
item đã CONVERTED/IGNORED + phân nhánh quyền own-vs-any, và toàn bộ 6
audit action.

Chạy: `npm test` (`node --conditions=react-server
--experimental-test-module-mocks --import tsx --test
'src/**/__tests__/**/*.test.mts'`).
