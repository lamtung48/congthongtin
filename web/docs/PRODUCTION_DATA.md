# Production Data: từ FixtureProvider sang DatabaseProvider

Nhiệm vụ này chuyển frontend công khai (`(site)` route group) từ dữ liệu
tĩnh (`FixtureProvider`) sang dữ liệu thật trong Postgres
(`DatabaseProvider`), giữ nguyên UI và `ContentProvider` contract có sẵn
(`src/data-access/provider.ts`). Xem `docs/DATA_ACCESS.md` cho kiến trúc
4 lớp gốc (Component → Service → Provider → nguồn dữ liệu) — tài liệu này
chỉ mô tả những gì thay đổi khi provider thứ hai (`DatabaseProvider`) trở
thành mặc định.

## Chọn provider: `src/data-access/index.ts`

```ts
function selectProvider(): ContentProvider {
  if (process.env.NODE_ENV === "test") return new FixtureProvider();
  if (process.env.CONTENT_PROVIDER === "fixture") {
    if (process.env.NODE_ENV === "production") {
      console.warn("... ignoring it and using DatabaseProvider ...");
    } else {
      return new FixtureProvider();
    }
  }
  return new DatabaseProvider();
}
```

- **Test** (`NODE_ENV=test`, tức là chạy `node --test`): luôn
  `FixtureProvider` — test suite không cần Postgres, và dữ liệu fixture ổn
  định giữa các lần chạy.
- **Dev thường** (`npm run dev`, không đặt `CONTENT_PROVIDER`):
  `DatabaseProvider`. Postgres vốn đã là hạ tầng bắt buộc cho `/admin` từ
  các nhiệm vụ trước, nên yêu cầu Postgres chạy khi dev frontend công khai
  không phải gánh nặng mới.
- **Dev muốn dùng fixture** (ví dụ làm việc offline, không có Postgres):
  đặt `CONTENT_PROVIDER=fixture` trong `.env.local`.
- **Production**: `CONTENT_PROVIDER=fixture` bị **bỏ qua có chủ đích** —
  không bao giờ fallback về dữ liệu giả trên môi trường production, kể cả
  khi biến môi trường bị đặt nhầm. Chỉ log một `console.warn` để việc đặt
  nhầm không âm thầm trôi qua.

`FixtureProvider` không bị xoá — vẫn là cách duy nhất chạy test suite, và
vẫn hữu ích để dev khi không có Postgres.

## Public Data Policy

Một bài viết chỉ được coi là công khai khi **cả hai** điều kiện đúng,
kiểm tra lại ở tầng `DatabaseProvider` (không chỉ dựa vào UI CMS):

```ts
function isPubliclyVisible(article: { status: ArticleStatus; publishedAt: Date | null }, now: Date): boolean {
  return article.status === "PUBLISHED" && !!article.publishedAt && article.publishedAt <= now;
}
```

Áp dụng ở **mọi** đường đọc công khai: `getArticleBySlug`, `getArticleSlugs`
(→ `generateStaticParams`), `getAllArticles`, `getArticlesByCategory`,
`getArticlesByTopic`, `getRelatedArticles`, `getAdjacentArticles`,
`searchContent`, và mọi nơi bài viết được join vào Homepage
(`hero`/`featured`/`storyRail`/`localNews`).

Điều kiện thứ hai (`publishedAt <= now`) là lớp phòng thủ: một bài đã
`PUBLISHED` nhưng bị chỉnh tay `publishedAt` sang tương lai (ví dụ thao
tác trực tiếp DB, bỏ qua workflow `articleService`) vẫn không được public
cho tới đúng thời điểm đó — được test tường minh trong
`authorization.test.mts` ("Production Data Policy").

DRAFT / IN_REVIEW / RETURNED / APPROVED / SCHEDULED-chưa-tới-giờ /
ARCHIVED: không bao giờ xuất hiện qua bất kỳ hàm nào ở trên.

## Homepage: CMS placement + fallback

`homepageService.resolveHomepage()` (đã có sẵn từ nhiệm vụ trước, trước
nhiệm vụ này chưa có nơi nào gọi tới) giải quyết từng section theo thứ
tự: đọc `HomepageConfiguration` đang active → với mỗi `HomepageSection`,
join các `HomepagePlacement` sang nội dung thật (bài viết/video/sự
kiện/platform/gallery, lọc lại publicly-visible) → nếu không có placement
nào (chưa có admin UI để tạo, nên đây là đường thường chạy) thì fallback
về "N bản ghi PUBLISHED mới nhất".

`DatabaseProvider` chia các section homepage thành hai nhóm gọi khác nhau:

- **Đi qua `resolveHomepage()`** (chỉ dùng ở trang chủ):
  `getFeaturedArticles`, `getStoryRail`, `getPlatforms`, `getGallery`,
  `getLocalNews`.
- **Query trực tiếp, KHÔNG qua `resolveHomepage()`**: `getVideos`,
  `getEvents`, `getLatestArticles`. Ba hàm này còn được dùng bởi các
  trang danh sách/`generateStaticParams` riêng (`/video`,
  `/su-kien/[slug]`) — nếu đi qua curation của homepage sẽ trả về tập con
  bị cắt, sai với "danh sách đầy đủ" mà các trang đó cần.

`resolveHomepage()` được bọc trong React `cache()` vì nhiều method của
`DatabaseProvider` gọi nó độc lập trong cùng một `Promise.all` của
`page.tsx` — dedupe để chỉ query DB một lần mỗi request.

## Server Component trước, Client Component chỉ khi bắt buộc

Toàn bộ trang chủ và các route `(site)` khác giữ nguyên là Server
Component fetch dữ liệu trực tiếp qua service layer (`await
getHomepage()`, v.v.) — không client-hoá thêm gì so với trước nhiệm vụ
này.

`DatabaseProvider` bắt đầu bằng `import "server-only"` (Prisma không thể
chạy trong trình duyệt). Điều này lộ ra một lỗ hổng kiến trúc đã tồn tại
từ trước: ba Client Component gọi thẳng hàm service (an toàn dưới
`FixtureProvider` vì nó chỉ `fetch()` một file JSON tĩnh hoặc code JS
thuần) — nếu giữ nguyên sẽ vỡ build/runtime khi `DatabaseProvider` trở
thành mặc định:

| Client Component | Trước | Sau |
|---|---|---|
| `useActivityMapData.ts` | gọi `getActivityMap()` trực tiếp | `fetch("/api/activity-map")` |
| `SearchOverlay.tsx` | gọi `searchContent()` trực tiếp | `fetchSearchResults()` (`src/lib/searchClient.ts`) → `fetch("/api/search")` |
| `SearchPageClient.tsx` | gọi `searchContent()` trực tiếp | như trên |

Hai Route Handler mới, `/api/activity-map` và `/api/search`
(`src/app/api/*/route.ts`), là nơi duy nhất mã phía server (Prisma) thực
sự chạy cho hai luồng này. Cả hai đều gọi qua `src/services/*.ts` — không
gọi `getContentProvider()` trực tiếp — giữ đúng quy ước "chỉ tầng service
được chạm vào provider" của kiến trúc gốc. Cả hai endpoint đều public,
không xác thực — dữ liệu chúng trả về vốn đã là dữ liệu công khai.

## Cache và revalidate

Dự án dùng Next.js caching "kinh điển" (không bật `cacheComponents` trong
`next.config.ts`), nên chiến lược là hai lớp:

1. **ISR fallback**: `export const revalidate = 60` trên
   `src/app/(site)/layout.tsx`. Theo quy tắc "revalidate thấp nhất trong
   cây layout/page của một route thắng", một dòng này áp trần 60 giây cho
   toàn bộ `(site)` (trang chủ, danh sách, chi tiết bài viết, địa
   phương/đơn vị, ...) mà không phải lặp lại ở từng page. Route `/admin`
   và `/preview` không nằm dưới layout này nên không bị ảnh hưởng — chúng
   vốn đã dynamic per-request vì gọi `cookies()` trong `requireSession()`.
2. **On-demand, tức thời**: `articleService.ts` gọi
   `revalidatePath("/", "layout")` + `revalidatePath("/sitemap.xml")` sau
   mỗi thao tác có thể đổi một trang đang public — `publish`, `unpublish`,
   `update`/`restoreRevision`/`remove` (chỉ khi bài đang/đã từng
   `PUBLISHED`). Không gọi ở `create`, `submitForReview`, `approve`,
   `returnForRevision`, `autosaveDraft`, `schedule`, `archive`,
   `restoreFromArchive` — none trong số này có thể ảnh hưởng một trang
   công khai đang tồn tại. `revalidatePath("/", "layout")` là lựa chọn
   thô nhưng đúng: article vừa publish/sửa có thể ảnh hưởng nhiều trang
   cùng lúc (trang chủ nếu được ghim, trang danh mục, trang chủ đề, trang
   địa phương, related-articles của bài khác, sitemap) — tính đúng cache
   key hẹp cho từng trường hợp phức tạp hơn nhiều so với lợi ích, nên
   nhiệm vụ này chọn revalidate toàn bộ layout thay vì đúng-nhưng-thiếu.

Trong test (`node --test`), `revalidatePath`/`revalidateTag` được mock
thành no-op trong `authorization.test.mts` — hai hàm này đòi hỏi một
request/Server Action context thật của Next.js, không tồn tại khi chạy
plain Node test runner.

## Preview CMS (brief mục 8)

Preview (`/preview/articles/[id]`, dùng chung `ArticleDetailView` với
trang public) là một luồng xác thực **tách biệt** khỏi Public Data
Policy ở trên:

- Không có session → redirect `/admin/login` (không lộ nội dung).
- CONTRIBUTOR → chỉ xem được preview bài **của chính mình**
  (`article.authorId === actor.id`), bất kể trạng thái bài (DRAFT tới
  PUBLISHED) — quyền preview không phụ thuộc `status`, khác với quyền sửa
  (`canEdit`), vốn bị khoá khi bài đã rời khỏi tay Contributor
  (`IN_REVIEW` trở đi).
- ADMIN / MANAGER → xem được preview của **bất kỳ** bài nào, bất kể ai là
  tác giả hay trạng thái gì.

Ba quy tắc trên được test trong `authorization.test.mts` ("Preview CMS —
3 role").

## Fixture cho dev/test

`FixtureProvider` + `src/data-access/fixtures/*.ts` giữ nguyên, dùng khi
`NODE_ENV=test` hoặc `CONTENT_PROVIDER=fixture` (chỉ ngoài production).
Phần site chrome tĩnh không có model DB (nav, footer) được tách ra
`src/lib/siteChrome.ts` — dùng chung bởi cả hai provider, không còn nằm
trong fixture (nó không phải "dữ liệu giả để demo", mà là cấu hình tĩnh
thật của site).

## Điều kiện hạ tầng mới: Postgres bắt buộc lúc build

`generateStaticParams()` của các route động (`/tin-tuc/[slug]`,
`/chuyen-muc/[slug]`, `/chu-de/[slug]`, `/dia-phuong/[slug]`,
`/don-vi/[slug]`, `/su-kien/[slug]`) giờ query Postgres thật lúc
`next build`. Trước nhiệm vụ này, Postgres chỉ cần chạy lúc runtime cho
`/admin`; giờ nó là dependency bắt buộc của `npm run build` nữa (migration
phải ở trạng thái mới nhất — `npx prisma migrate status`).

## Đã biết, chấp nhận (không sửa trong nhiệm vụ này)

- `LocalNews.tsx`'s 3-tab filter UI hiển thị `province`/`university`/
  `overseas`; hai giá trị `OrganizationLevel` mới (`central`, `other`, mở
  rộng để khớp 5 `OrganizationType` của DB) không có tab riêng — theo
  đúng ràng buộc "không rewrite UI" của nhiệm vụ.
- `LocalityProfile.relatedMedia` luôn rỗng — không có bảng gắn thẻ
  gallery-item ↔ locality trong schema hiện tại.
- `Article.topics` luôn `undefined` trong `DatabaseProvider` (đã xác nhận
  bằng grep là không có renderer công khai nào dùng field này) — tránh
  tính `articleCount` theo topic tốn kém cho một field không ai đọc.
- `EventDetail.capacity` không có cột tương ứng trong `Event` model, để
  trống.

## Kiểm chứng đã thực hiện

- `npx tsc --noEmit`, `npx eslint .`: sạch.
- `npm test`: 45/45 pass, gồm 2 suite mới — "Production Data Policy" (4
  test) và "Preview CMS — 3 role" (3 test) trong `authorization.test.mts`.
- `npm run build`: build thành công với Postgres thật đang chạy, toàn bộ
  route tĩnh/động render bằng dữ liệu DB thật (31 bài viết seed, tỉnh
  thành, đơn vị thật).
- Playwright thủ công trên `npm run dev`:
  - Trang chủ chứa nội dung DB thật (bài "Mùa hè xanh").
  - `/tin-tuc/dai-hoi-xii-khai-mac` (bài PUBLISHED) trả 200, có headline.
  - Tạo một bài DRAFT qua `/admin/articles/new` (Admin) → preview
    (`/preview/articles/[id]`) trả 200 cho Admin; URL công khai
    `/tin-tuc/[slug-cua-draft]` trả **404**; truy cập preview đó khi
    **không đăng nhập** bị redirect về `/admin/login`.
  - `/api/search?q=...` và `/api/activity-map` đều trả 200 với dữ liệu
    DB thật.
  - Bài DRAFT tạo để test đã được xoá khỏi DB sau khi xác minh xong.
