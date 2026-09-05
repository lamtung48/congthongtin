import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/server/auth/session";
import { articleService } from "@/server/services/articleService";
import { taxonomyService } from "@/server/services/taxonomyService";
import { organizationRepository } from "@/server/repositories/organizationRepository";
import { provinceRepository } from "@/server/repositories/provinceRepository";
import { authorProfileRepository } from "@/server/repositories/authorProfileRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { hasPermission } from "@/server/auth/permissions";
import {
  submitForReviewAction,
  approveAction,
  returnForRevisionAction,
  publishAction,
  scheduleAction,
  unpublishAction,
  archiveAction,
  restoreFromArchiveAction,
  deleteArticleAction,
} from "./actions";
import type { ArticleAdminFilter } from "@/server/repositories/articleRepository";
import type { ArticleStatus } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Bài viết" };

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "Nháp",
  IN_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  SCHEDULED: "Hẹn giờ",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};

const STATUS_BADGE: Record<ArticleStatus, string> = {
  DRAFT: "adminBadgeNeutral",
  IN_REVIEW: "adminBadgeWarning",
  APPROVED: "adminBadgeWarning",
  SCHEDULED: "adminBadgeWarning",
  PUBLISHED: "adminBadgeSuccess",
  ARCHIVED: "adminBadgeDanger",
};

/** One tab = one named slice of the admin listing (brief section 3's
 *  per-role tab sets). `filter` is applied on top of whatever the GET
 *  filter form/pagination already sets — a tab is just a named shortcut
 *  for a fixed `status`/`hasReturnNote` combination, not a separate query
 *  path. */
interface TabDef {
  key: string;
  label: string;
  filter: Pick<ArticleAdminFilter, "status" | "hasReturnNote">;
}

const MANAGER_ADMIN_TABS: TabDef[] = [
  { key: "all", label: "Tất cả bài", filter: {} },
  { key: "IN_REVIEW", label: "Chờ duyệt", filter: { status: "IN_REVIEW" } },
  { key: "APPROVED", label: "Đã duyệt", filter: { status: "APPROVED" } },
  { key: "SCHEDULED", label: "Đã lên lịch", filter: { status: "SCHEDULED" } },
  { key: "PUBLISHED", label: "Đã xuất bản", filter: { status: "PUBLISHED" } },
  { key: "ARCHIVED", label: "Bị lưu trữ", filter: { status: "ARCHIVED" } },
];

/** `RETURNED` isn't a real `ArticleStatus` — a returned article is DRAFT
 *  again (`Article.returnNote` set), so the tab is `status: "DRAFT",
 *  hasReturnNote: true`; the plain "Nháp" tab is the complementary
 *  `hasReturnNote: false`, so the two tabs partition DRAFT rows instead of
 *  overlapping. */
const CONTRIBUTOR_TABS: TabDef[] = [
  { key: "mine", label: "Bài của tôi", filter: {} },
  { key: "DRAFT", label: "Nháp", filter: { status: "DRAFT", hasReturnNote: false } },
  { key: "IN_REVIEW", label: "Chờ duyệt", filter: { status: "IN_REVIEW" } },
  { key: "RETURNED", label: "Bị trả lại", filter: { status: "DRAFT", hasReturnNote: true } },
  { key: "PUBLISHED", label: "Đã xuất bản", filter: { status: "PUBLISHED" } },
];

function buildQuery(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

interface SearchParams {
  tab?: string;
  q?: string;
  category?: string;
  topic?: string;
  tag?: string;
  author?: string;
  org?: string;
  province?: string;
  from?: string;
  to?: string;
  page?: string;
}

/**
 * Brief section 2/3: the full CMS article listing — every column, every
 * filter, search, per-role tabs, server-side pagination. Action buttons are
 * shown/hidden by permission + status (brief: "Không hiển thị action mà
 * user không có quyền... nhưng tuyệt đối không coi việc ẩn UI là
 * authorization") — every button posts to a Server Action in `./actions.ts`
 * that re-checks the same permission independently.
 */
export default async function AdminArticlesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();
  const params = await searchParams;
  const isContributor = session.role === "CONTRIBUTOR";
  const tabs = isContributor ? CONTRIBUTOR_TABS : MANAGER_ADMIN_TABS;
  const activeTab = tabs.find((t) => t.key === params.tab) ?? tabs[0];
  const page = Math.max(1, Number(params.page) || 1);

  const filter: ArticleAdminFilter = {
    ...activeTab.filter,
    categoryId: params.category || undefined,
    topicId: params.topic || undefined,
    tagId: params.tag || undefined,
    authorId: params.author || undefined,
    organizationId: params.org || undefined,
    provinceId: params.province || undefined,
    createdFrom: params.from ? new Date(params.from) : undefined,
    createdTo: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
    search: params.q || undefined,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  };

  const [articles, total, categories, topics, tags, organizations, provinces, authors] = await Promise.all([
    articleService.listForAdmin(session, filter),
    articleService.countForAdmin(session, filter),
    taxonomyService.listCategories(),
    taxonomyService.listTopics(),
    taxonomyService.listTags(),
    organizationRepository.list(),
    provinceRepository.list(),
    authorProfileRepository.list(),
  ]);

  const submittedAtByArticle = await auditLogRepository.findLatestActionDates(
    "SUBMIT_REVIEW",
    "Article",
    articles.map((a) => a.id),
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canApprove = hasPermission(session.role, "article.approve");
  const canReturn = hasPermission(session.role, "article.return");
  const canPublish = hasPermission(session.role, "article.publish");
  const canSchedule = hasPermission(session.role, "article.schedule");
  const canUnpublish = hasPermission(session.role, "article.unpublish");
  const canDelete = hasPermission(session.role, "article.delete");
  const canCreate = hasPermission(session.role, "article.create");

  const filterQueryOnly: Record<string, string | undefined> = {
    tab: params.tab,
    q: params.q,
    category: params.category,
    topic: params.topic,
    tag: params.tag,
    author: params.author,
    org: params.org,
    province: params.province,
    from: params.from,
    to: params.to,
  };

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">{isContributor ? "Bài viết của tôi" : "Bài viết"}</h1>
          <p className="adminPageSubtitle">Toàn bộ quy trình từ nháp đến xuất bản.</p>
        </div>
        {canCreate && (
          <Link href="/admin/articles/new" className="adminButton adminButtonPrimary">
            + Bài viết mới
          </Link>
        )}
      </div>

      <nav className="adminTabs">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/articles${buildQuery(filterQueryOnly, { tab: tab.key === tabs[0].key ? undefined : tab.key })}`}
            className={tab.key === activeTab.key ? "adminTab adminTabActive" : "adminTab"}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <form className="adminFilterGrid adminCard adminCardPad" method="get">
        <input type="hidden" name="tab" value={params.tab ?? ""} />
        <div className="adminField" style={{ marginBottom: 0, gridColumn: "span 2" }}>
          <label className="adminLabel" htmlFor="f-q">Tìm kiếm</label>
          <input id="f-q" name="q" type="text" placeholder="Tiêu đề, slug, nội dung…" defaultValue={params.q ?? ""} className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-category">Chuyên mục</label>
          <select id="f-category" name="category" defaultValue={params.category ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-topic">Chủ đề</label>
          <select id="f-topic" name="topic" defaultValue={params.topic ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-tag">Tag</label>
          <select id="f-tag" name="tag" defaultValue={params.tag ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-author">Tác giả</label>
          <select id="f-author" name="author" defaultValue={params.author ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            {authors.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-org">Đơn vị</label>
          <select id="f-org" name="org" defaultValue={params.org ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-province">Địa phương</label>
          <select id="f-province" name="province" defaultValue={params.province ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-from">Từ ngày</label>
          <input id="f-from" name="from" type="date" defaultValue={params.from ?? ""} className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-to">Đến ngày</label>
          <input id="f-to" name="to" type="date" defaultValue={params.to ?? ""} className="adminInput" />
        </div>
        <button type="submit" className="adminButton">Lọc</button>
        <Link href="/admin/articles" className="adminButton">Xoá lọc</Link>
      </form>

      <div className="adminCard">
        {articles.length === 0 ? (
          <div className="adminEmptyState">Không có bài viết nào khớp bộ lọc.</div>
        ) : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Tiêu đề</th>
                  <th>Chuyên mục</th>
                  <th>Tác giả / Người tạo</th>
                  <th>Đơn vị</th>
                  <th>Trạng thái</th>
                  <th>Người cập nhật</th>
                  <th>Ngày tạo</th>
                  <th>Ngày gửi duyệt</th>
                  <th>Ngày xuất bản</th>
                  <th style={{ minWidth: 280 }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => {
                  const isOwner = a.createdById === session.id;
                  const canEditThis = articleService.canEdit(session, a);
                  const submittedAt = submittedAtByArticle.get(a.id);
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/articles/${a.id}/edit`} style={{ fontWeight: 600 }}>{a.title}</Link>
                        {a.returnNote && (
                          <div className="adminHint" style={{ color: "var(--admin-danger)", marginTop: 2 }}>
                            Bị trả lại: {a.returnNote}
                          </div>
                        )}
                      </td>
                      <td className="adminHint">{a.category.name}</td>
                      <td className="adminHint">{a.author?.displayName ?? a.createdBy?.displayName ?? "—"}</td>
                      <td className="adminHint">{a.organization?.name ?? "—"}</td>
                      <td><span className={`adminBadge ${STATUS_BADGE[a.status]}`}>{STATUS_LABELS[a.status]}</span></td>
                      <td className="adminHint">{a.updatedBy?.displayName ?? "—"}</td>
                      <td className="adminHint">{a.createdAt.toLocaleDateString("vi-VN")}</td>
                      <td className="adminHint">{submittedAt ? submittedAt.toLocaleDateString("vi-VN") : "—"}</td>
                      <td className="adminHint">{a.publishedAt ? a.publishedAt.toLocaleDateString("vi-VN") : "—"}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          <Link href={`/preview/articles/${a.id}`} target="_blank" className="adminButton adminButtonSmall">Xem trước ↗</Link>
                          {a.status === "DRAFT" && canEditThis && (
                            <form action={submitForReviewAction}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <button type="submit" className="adminButton adminButtonSmall">Gửi duyệt</button>
                            </form>
                          )}
                          {a.status === "IN_REVIEW" && canApprove && (
                            <form action={approveAction}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <button type="submit" className="adminButton adminButtonSmall adminButtonPrimary">Duyệt</button>
                            </form>
                          )}
                          {(a.status === "IN_REVIEW" || a.status === "APPROVED") && canReturn && (
                            <form action={returnForRevisionAction} style={{ display: "flex", gap: 4 }}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <input type="text" name="note" required placeholder="Ghi chú trả lại…" className="adminInput" style={{ padding: "4px 8px", fontSize: 12, width: 130 }} />
                              <button type="submit" className="adminButton adminButtonSmall">Trả lại</button>
                            </form>
                          )}
                          {(a.status === "APPROVED" || a.status === "SCHEDULED") && canPublish && (
                            <form action={publishAction}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <button type="submit" className="adminButton adminButtonSmall adminButtonPrimary">Xuất bản</button>
                            </form>
                          )}
                          {a.status === "APPROVED" && canSchedule && (
                            <form action={scheduleAction} style={{ display: "flex", gap: 4 }}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <input type="datetime-local" name="scheduledAt" required className="adminInput" style={{ padding: "4px 8px", fontSize: 12 }} />
                              <button type="submit" className="adminButton adminButtonSmall">Hẹn giờ</button>
                            </form>
                          )}
                          {a.status === "PUBLISHED" && canUnpublish && (
                            <form action={unpublishAction}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <button type="submit" className="adminButton adminButtonSmall adminButtonDanger">Gỡ bài</button>
                            </form>
                          )}
                          {a.status !== "PUBLISHED" && a.status !== "ARCHIVED" && canUnpublish && (
                            <form action={archiveAction}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <button type="submit" className="adminButton adminButtonSmall">Lưu trữ</button>
                            </form>
                          )}
                          {a.status === "ARCHIVED" && canUnpublish && (
                            <form action={restoreFromArchiveAction}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <button type="submit" className="adminButton adminButtonSmall">Khôi phục</button>
                            </form>
                          )}
                          {canDelete && !(session.role === "MANAGER" && a.status === "PUBLISHED") && (isOwner || !isContributor) && (
                            <form action={deleteArticleAction}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <button type="submit" className="adminButton adminButtonSmall adminButtonDanger">Xoá</button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="adminPagination">
          <span>Trang {page}/{totalPages} · {total} bài viết</span>
          {page > 1 && (
            <Link href={`/admin/articles${buildQuery(filterQueryOnly, { tab: params.tab, page: String(page - 1) })}`} className="adminButton adminButtonSmall">← Trước</Link>
          )}
          {page < totalPages && (
            <Link href={`/admin/articles${buildQuery(filterQueryOnly, { tab: params.tab, page: String(page + 1) })}`} className="adminButton adminButtonSmall">Sau →</Link>
          )}
        </div>
      )}
    </>
  );
}
