# Editorial workflow (Ban Biên tập)

Hoàn thiện workflow biên tập cho đúng 3 cấp quyền — không thêm role thứ tư
(Editor, Editor-in-Chief, ...). Phần lớn nền tảng (status enum, permission
matrix, `articleService` workflow methods, `/admin/articles`) đã có từ
nhiệm vụ CMS trước; tài liệu này chỉ mô tả những gì nhiệm vụ này **thêm mới**:
Review Queue riêng, thông báo nội bộ, ghi chú nội bộ, và dashboard theo
đúng brief.

## 1. Workflow chính (đã có từ trước, không đổi)

```
DRAFT → (submit) → IN_REVIEW → (approve) → APPROVED → (publish/schedule) → PUBLISHED
                        ↓ (return)                         ↓ (schedule) SCHEDULED → PUBLISHED
                      DRAFT (returnNote)                    
PUBLISHED → (unpublish) → ARCHIVED → (restore) → DRAFT
```

Toàn bộ transition + permission được enforce ở `articleService.ts`
(`ALLOWED_TRANSITIONS`, `assertHasPermission`, `assertCanEdit`) — xem
`docs/AUTHORIZATION.md`. Không có gì trong nhiệm vụ này thay đổi bảng
transition hay permission matrix đó.

## 2-4. Quyền theo role (đã có từ trước, không đổi)

`src/server/auth/permissions.ts` là nguồn sự thật duy nhất. Ba role đúng
tên brief: `ADMIN`, `MANAGER` ("Quản trị viên"), `CONTRIBUTOR` ("Cộng tác
viên"). Không có permission mới nào được thêm trong nhiệm vụ này — Review
Queue tái dùng đúng permission `article.approve` (Admin/Manager) làm
route guard, không tạo permission mới.

## 5. Dashboard (`/admin/dashboard`) — mở rộng

| Role | Trước | Thêm mới (nhiệm vụ này) |
|---|---|---|
| ADMIN | Tổng bài, chờ duyệt, users, media | + Đã lên lịch, Đã xuất bản, Media lỗi (đổi "Media" thành "Media lỗi" — số asset `MediaStatus.MISSING`, con số cần hành động thay vì tổng kho) |
| MANAGER | Chờ duyệt, lên lịch, xuất bản | + Bài bị trả, Xuất bản **hôm nay** (không phải tổng), link nhanh "Vào hàng đợi duyệt bài" + "Quản lý Homepage", "Media lỗi cần xử lý" + "Sự kiện sắp diễn ra" |
| CONTRIBUTOR | Nháp/chờ duyệt/bị trả/xuất bản | Không đổi — đã khớp brief mục 5 từ trước |

Nguồn dữ liệu mới: `articleRepository.countPublishedToday()` (biên giới
ngày tính theo giờ Việt Nam UTC+7 cố định, cùng quy ước với
`parseScheduledAtVietnamTime`), `eventRepository.countByStatus("UPCOMING")`,
`mediaService.count({ status: "MISSING" })`.

## 6-7. Review Queue (`/admin/review`) — MỚI

Route riêng, **chỉ ADMIN/MANAGER** — guard bằng
`requirePermission("article.approve")` (`src/server/auth/guard.ts`), cùng
cơ chế `forbidden()` (HTTP 403 thật) mọi route admin khác đã dùng. Một
Contributor gọi thẳng URL này (không qua UI) nhận 403 ngay từ server —
xác nhận bằng Playwright, xem mục Test bên dưới.

Khác với `/admin/articles` (mọi trạng thái, mọi role, bộ lọc đầy đủ),
Review Queue chỉ liệt kê hai trạng thái cần hành động ngay: `IN_REVIEW`
(chờ Approve/Return) và `APPROVED` (chờ Publish/Schedule) — cũ nhất lên
trước. Cột đúng brief: title, contributor (`createdBy`), category,
organization, submittedAt (đọc từ `AuditLog` — bản ghi `SUBMIT_REVIEW`
gần nhất, cùng cách `/admin/articles` đã làm), nút "Xem trước". Action
Approve/Return/Publish/Schedule tái dùng nguyên `articles/actions.ts` —
một cài đặt workflow, hai điểm vào (danh sách đầy đủ và hàng đợi duyệt),
không có bản sao logic thứ hai.

`articleRepository`/`articleService.listForAdmin` được mở rộng thêm
`statusIn?: ArticleStatus[]` bên cạnh `status` hiện có, cho phép truy vấn
"IN_REVIEW hoặc APPROVED" trong một lần gọi.

## 8. Ghi chú nội bộ (ArticleNote) — MỚI

Model `ArticleNote` (articleId, authorId, body, createdAt) — thread thảo
luận nội bộ, khác với `Article.returnNote` (một ghi chú bắt buộc, gắn với
đúng một lần Return, bị xoá khi gửi duyệt lại). Ghi chú nội bộ:

- Không bao giờ render ở route công khai — chỉ xuất hiện trong panel
  "Ghi chú nội bộ" trên `/admin/articles/[id]/edit`.
- Quyền xem/thêm = đúng quyền `canView` của bài viết (Admin/Manager xem
  mọi bài; Contributor chỉ bài của mình) — không tạo permission thứ tư,
  đúng tinh thần "workflow đơn giản" của brief.
- Không ảnh hưởng trạng thái workflow — thêm ghi chú không đổi `status`.

`articleService.addNote`/`listNotes` (server actions:
`articles/[id]/edit/actions.ts`'s `addNoteAction`).

## 9-10. Notification — MỚI

Model `Notification` (userId, type, entityType, entityId, message,
isRead) — thông báo nội bộ trong app, không email/push. 4
`NotificationType` đúng 4 sự kiện brief yêu cầu, mỗi loại có đúng một
điểm kích hoạt trong `articleService.ts`:

| Sự kiện | Trigger trong articleService | Người nhận |
|---|---|---|
| `ARTICLE_SUBMITTED` | `submitForReview` | Mọi ADMIN + MANAGER đang `ACTIVE` |
| `ARTICLE_RETURNED` | `returnForRevision` | `article.createdById` (Contributor) |
| `ARTICLE_APPROVED` | `approve` | `article.createdById` |
| `ARTICLE_PUBLISHED` | `publish` **và** `schedule` | `article.createdById` |

`schedule` dùng chung `ARTICLE_PUBLISHED` với nội dung "đã được hẹn giờ
xuất bản" — không phải 1 trong 4 trigger brief liệt kê theo tên, nhưng
gộp vào tinh thần "duyệt/publish → notify Contributor": một bài được hẹn
giờ là một quyết định publish, Contributor cần biết thay vì im lặng cho
tới lúc bài tự lên.

`notificationService.ts` là nơi duy nhất quyết định người nhận + nội
dung message (tiếng Việt, dựng sẵn lúc ghi — không tính lại từ `type` lúc
đọc, để đổi câu chữ sau này không viết lại lịch sử). `notifyRoles` fan-out
tới mọi Manager/Admin `ACTIVE` (không có cơ chế "người duyệt được giao"
trong CMS này); `notifyUser` gửi đúng một người.

**Notification Center** (`/admin/notifications`, mọi role): unread/read
(nền xanh nhạt cho chưa đọc), link thẳng tới bài viết
(`/admin/articles/[id]/edit`, cùng trang `canView` đã bảo vệ sẵn), thời
gian, nút "Đã đọc" từng dòng + "Đánh dấu tất cả đã đọc". Sidebar hiện số
chưa đọc cạnh "Thông báo" (`(protected)/layout.tsx` tính
`notificationService.countUnread` mỗi request).

Mọi thao tác đọc/ghi đều tự scope theo `actor.id` ở tầng repository
(`notificationRepository.markRead(id, userId)` where cả hai) — không có
quyền "xem thông báo của người khác" cho bất kỳ role nào, kể cả Admin.

## 11. Audit — không đổi

Mọi transition workflow đã được audit từ trước (`SUBMIT_REVIEW`,
`APPROVE_ARTICLE`, `RETURN_ARTICLE`, `PUBLISH_ARTICLE`,
`SCHEDULE_ARTICLE`, `UNPUBLISH_ARTICLE`, `ARCHIVE_ARTICLE`,
`RESTORE_ARTICLE`). Ghi chú nội bộ và notification **không** ghi audit —
chúng không phải write có thể thay đổi trạng thái hệ thống theo cách audit
log cần lần vết lại, cùng logic với việc autosave draft không tạo
`ArticleRevision`.

## 12. Server authorization

Review Queue là route mới duy nhất cần một guard mới — dùng lại
`requirePermission("article.approve")` sẵn có thay vì tạo permission
riêng. Test trực tiếp bằng Playwright (không qua UI): đăng nhập
Contributor, `page.goto("/admin/review")` thẳng → nhận **HTTP 403** thật
từ server (không phải ẩn link rồi vẫn cho vào). Notification/ArticleNote
cũng được test bằng cách gọi thẳng `articleService`/`notificationService`
(giống toàn bộ `authorization.test.mts`, không qua HTTP).

## 13. UX

Không thêm tầng duyệt: vẫn đúng Contributor → Manager/Admin → Publish, 2
bước như brief yêu cầu. Review Queue chỉ là một "view" khác của cùng một
workflow (lọc + rút gọn cột cho đúng việc cần làm ngay), không phải một
bước phê duyệt mới. Ghi chú nội bộ và notification là tiện ích hỗ trợ
giao tiếp, không chèn thêm bước bắt buộc nào vào chuỗi
Draft→Review→Approve→Publish.

## 14. Test

`src/server/__tests__/authorization.test.mts` — 3 describe block mới:

- **"Review Queue /admin/review — chỉ ADMIN/MANAGER"**: xác nhận
  `article.approve` (permission route guard dùng) đúng là true cho
  ADMIN/MANAGER, false cho CONTRIBUTOR; `listForAdmin({ statusIn })` trả
  đúng tập IN_REVIEW+APPROVED.
- **"Notification — thông báo nội bộ theo workflow"**: submit → cả
  Admin lẫn Manager nhận, Contributor không tự nhận; return → đúng
  Contributor tác giả nhận kèm nội dung note, Contributor khác không
  thấy; approve/publish → đúng Contributor tác giả nhận; `markRead` chỉ
  đổi được trạng thái đọc của chính người nhận.
- **"Ghi chú nội bộ (ArticleNote)"**: Contributor ghi/xem được ghi chú
  trên bài của mình; Contributor khác bị chặn cả ghi lẫn xem; Manager/
  Admin ghi được trên mọi bài mà không đổi status; ghi chú rỗng bị từ
  chối.

Playwright thủ công (3 tài khoản mẫu `admin@`/`manager@`/`contributor@hoisinhvien.vn`):
CONTRIBUTOR gọi thẳng `/admin/review` → **403** xác nhận; MANAGER vào
được, thấy đúng bài vừa gửi duyệt; luồng đầy đủ Contributor tạo bài → gửi
duyệt → Manager thấy thông báo + duyệt + xuất bản từ Review Queue →
Contributor nhận đủ 2 thông báo (đã duyệt, đã xuất bản); dashboard cả 3
role render đúng số liệu mới; panel Ghi chú nội bộ hoạt động đúng
(hiển thị "Chỉ hiển thị trong CMS — không public.", thêm/liệt kê ghi chú
theo đúng tác giả + thời gian).

`npx tsc --noEmit`, `npx eslint .`, `npm test` (55/55), `npm run build`
đều sạch.

## Bẫy đã gặp khi implement — ghi lại để không lặp lại

`notifyRoles(["ADMIN","MANAGER"])` fan-out tới **mọi** Manager/Admin
`ACTIVE` trong DB thật, kể cả 3 tài khoản mẫu seed sẵn
(`admin@hoisinhvien.vn`, `manager@hoisinhvien.vn`) — không chỉ các actor
throwaway mà test suite tự tạo. `Notification.userId` cascade-xoá khi xoá
User, nhưng test suite chỉ xoá `testUserIds` (4 actor tự tạo) chứ không
xoá 2 tài khoản mẫu thật — nên mỗi lần `npm test` chạy, thông báo test sẽ
"rò rỉ" vĩnh viễn vào Notification Center của tài khoản mẫu thật nếu
không dọn riêng. Sửa bằng cách dọn `Notification` trong `after()` theo
`entityId` (mọi bài test suite từng tạo, kể cả bài đã bị xoá thẳng qua
`articleService.remove()` giữa bài test — theo dõi riêng bằng
`allArticleIdsEverCreated`, không dùng `testArticleIds` vốn bị splice khi
một bài bị xoá sớm) thay vì theo người nhận.
