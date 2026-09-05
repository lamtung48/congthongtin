"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArticleContentEditor, type EditorBlock } from "./ArticleContentEditor";
import { MediaPicker, type MediaOption } from "../../MediaPicker";
import type { VideoOption } from "../../VideoPicker";
import { autosaveAction, saveAction, restoreRevisionAction, addNoteAction, type EditorFormPayload } from "./actions";
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
} from "../../actions";
import type { ArticleStatus } from "@/generated/prisma/client";

interface Option { id: string; name: string }

interface InitialData {
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  categoryId: string;
  authorId: string | null;
  organizationId: string | null;
  provinceId: string | null;
  coverMediaId: string | null;
  ogMediaId: string | null;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  topicIds: string[];
  tagIds: string[];
  blocks: EditorBlock[];
  status: ArticleStatus;
  returnNote: string | null;
  publishedAt: string | null;
}

interface Permissions {
  canEditNow: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReturn: boolean;
  canPublish: boolean;
  canSchedule: boolean;
  canUnpublish: boolean;
  canDelete: boolean;
  canRestoreRevision: boolean;
  authorRestricted: boolean;
  ownAuthorId: string | null;
  canManageMediaAny: boolean;
  canUploadVideo: boolean;
}

interface RevisionRow {
  version: number;
  changedByName: string;
  createdAt: string;
  note: string | null;
}

interface NoteRow {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

const STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "Nháp",
  IN_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  SCHEDULED: "Hẹn giờ",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};

const AUTOSAVE_DELAY_MS = 2500;

function toPayload(fields: Omit<InitialData, "blocks" | "status" | "returnNote" | "publishedAt">, blocks: EditorBlock[]): EditorFormPayload {
  return {
    fields: {
      slug: fields.slug,
      title: fields.title,
      subtitle: fields.subtitle || null,
      excerpt: fields.excerpt || null,
      categoryId: fields.categoryId,
      authorId: fields.authorId,
      organizationId: fields.organizationId,
      provinceId: fields.provinceId,
      coverMediaId: fields.coverMediaId,
      ogMediaId: fields.ogMediaId,
      seoTitle: fields.seoTitle || null,
      seoDescription: fields.seoDescription || null,
      canonicalUrl: fields.canonicalUrl || null,
      topicIds: fields.topicIds,
      tagIds: fields.tagIds,
    },
    blocks,
  };
}

function MultiCheckList({ label, options, selected, onChange }: { label: string; options: Option[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="adminField">
      <span className="adminLabel">{label}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto", border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", padding: 8 }}>
        {options.length === 0 && <span className="adminHint">Chưa có dữ liệu.</span>}
        {options.map((o) => (
          <label key={o.id} style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))}
            />
            {o.name}
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Brief section 6/16: the whole `/admin/articles/[id]/edit` screen — every
 * field, the block editor, autosave (DRAFT only, debounced, three visible
 * states), a sticky action bar whose buttons are shown by permission+status
 * (never the actual guard — every one posts to a Server Action that
 * re-checks itself), an unsaved-changes warning, and the review-note
 * banner. Locked read-only for a Contributor once the article has left
 * DRAFT (brief: "Cộng tác viên không được tự ý sửa nếu workflow đang khóa
 * bài, trừ khi bài được trả lại") — enforced again server-side by
 * `articleService.assertCanEdit`, this is only the UI reflecting it.
 */
export function ArticleEditor({
  articleId,
  initial,
  options,
  permissions,
  revisions,
  notes,
}: {
  articleId: string;
  initial: InitialData;
  options: { categories: Option[]; topics: Option[]; tags: Option[]; organizations: Option[]; provinces: Option[]; authors: Option[]; media: MediaOption[]; video: VideoOption[] };
  permissions: Permissions;
  revisions: RevisionRow[];
  notes: NoteRow[];
}) {
  const router = useRouter();
  const locked = !permissions.canEditNow;

  const [slug, setSlug] = useState(initial.slug);
  const [title, setTitle] = useState(initial.title);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [authorId, setAuthorId] = useState(initial.authorId);
  const [organizationId, setOrganizationId] = useState(initial.organizationId);
  const [provinceId, setProvinceId] = useState(initial.provinceId);
  const [coverMediaId, setCoverMediaId] = useState(initial.coverMediaId);
  const [ogMediaId, setOgMediaId] = useState(initial.ogMediaId);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);
  const [canonicalUrl, setCanonicalUrl] = useState(initial.canonicalUrl);
  const [topicIds, setTopicIds] = useState(initial.topicIds);
  const [tagIds, setTagIds] = useState(initial.tagIds);
  const [blocks, setBlocks] = useState(initial.blocks);

  const payload = useMemo(
    () => toPayload({ slug, title, subtitle, excerpt, categoryId, authorId, organizationId, provinceId, coverMediaId, ogMediaId, seoTitle, seoDescription, canonicalUrl, topicIds, tagIds }, blocks),
    [slug, title, subtitle, excerpt, categoryId, authorId, organizationId, provinceId, coverMediaId, ogMediaId, seoTitle, seoDescription, canonicalUrl, topicIds, tagIds, blocks],
  );
  const serialized = useMemo(() => JSON.stringify(payload), [payload]);
  // A plain state (not a ref) holds "what's saved so far" — reading `.current`
  // during render to compute `dirty` would violate React's rule against
  // accessing refs while rendering; state is the render-safe equivalent here
  // since it only ever changes after a save actually completes.
  const [baseline, setBaseline] = useState(serialized);
  const dirty = serialized !== baseline;

  // No "saving" state is set synchronously inside the effect below (React's
  // rule against synchronous setState-in-effect) — the visible "Đang lưu…"/
  // "Đã lưu" state is derived straight from `dirty` in the JSX instead;
  // `saveError` is the only state this effect sets, and only from inside
  // the async transition callback, not the effect body itself.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startSaveTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canAutosave = !locked && initial.status === "DRAFT";

  useEffect(() => {
    if (!canAutosave || serialized === baseline) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startSaveTransition(async () => {
        const result = await autosaveAction(articleId, payload);
        if (result.ok) {
          setBaseline(serialized);
          setSaveError(null);
        } else {
          setSaveError(result.error ?? "Không thể tự động lưu.");
        }
      });
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [serialized, baseline, canAutosave, articleId, payload]);

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleManualSave = useCallback(() => {
    startSaveTransition(async () => {
      const result = await saveAction(articleId, payload);
      if (result.ok) {
        setBaseline(serialized);
        setSaveError(null);
        router.refresh();
      } else {
        setSaveError(result.error ?? "Không thể lưu bài viết.");
      }
    });
  }, [articleId, payload, serialized, router]);

  const handleDelete = useCallback(() => {
    if (!confirm("Xoá bài viết này? Hành động không thể hoàn tác.")) return;
    startSaveTransition(async () => {
      const fd = new FormData();
      fd.set("articleId", articleId);
      await deleteArticleAction(fd);
      router.push("/admin/articles");
    });
  }, [articleId, router]);

  const authorOptions = permissions.authorRestricted
    ? options.authors.filter((a) => a.id === permissions.ownAuthorId)
    : options.authors;

  const actionsBlocked = dirty; // brief-CMS: workflow actions require the latest content to be saved first

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">{initial.title || "Bài viết"}</h1>
          <p className="adminPageSubtitle">
            <span className="adminBadge adminBadgeNeutral">{STATUS_LABELS[initial.status]}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/preview/articles/${articleId}`} target="_blank" className="adminButton adminButtonSmall">Xem trước ↗</Link>
          <Link href="/admin/articles" className="adminButton adminButtonSmall">← Danh sách</Link>
        </div>
      </div>

      {initial.returnNote && (
        <div className="adminReturnBanner">
          <strong>Bài viết đã bị trả lại để chỉnh sửa:</strong> {initial.returnNote}
        </div>
      )}
      {locked && (
        <div className="adminLockedBanner">
          Bài đang trong quy trình duyệt — bạn không thể chỉnh sửa nội dung cho đến khi bài được trả lại.
        </div>
      )}

      <div className="adminEditorGrid">
        <div>
          <div className="adminCard adminCardPad" style={{ marginBottom: 16, display: "grid", gap: 12 }}>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="e-title">Tiêu đề</label>
              <input id="e-title" className="adminInput" value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} />
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="e-subtitle">Sapo</label>
              <textarea id="e-subtitle" className="adminInput" rows={2} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} disabled={locked} />
              <span className="adminHint">Hiển thị ngay dưới tiêu đề trên trang bài viết.</span>
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="e-excerpt">Tóm tắt</label>
              <textarea id="e-excerpt" className="adminInput" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} disabled={locked} />
              <span className="adminHint">Dùng làm mô tả mặc định khi chia sẻ/tìm kiếm nếu chưa điền SEO description.</span>
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="e-slug">Slug</label>
              <input id="e-slug" className="adminInput" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={locked} />
            </div>
          </div>

          <div className="adminCard adminCardPad" style={{ marginBottom: 16 }}>
            <h2 className="adminLabel" style={{ marginBottom: 10, fontSize: 13 }}>Nội dung</h2>
            <ArticleContentEditor blocks={blocks} onChange={setBlocks} mediaOptions={options.media} videoOptions={options.video} canManageMediaAny={permissions.canManageMediaAny} canUploadVideo={permissions.canUploadVideo} editable={!locked} />
          </div>

          <div className="adminCard adminCardPad">
            <h2 className="adminLabel" style={{ marginBottom: 10, fontSize: 13 }}>SEO</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <div className="adminField" style={{ marginBottom: 0 }}>
                <label className="adminLabel" htmlFor="e-seo-title">SEO title</label>
                <input id="e-seo-title" className="adminInput" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} disabled={locked} />
              </div>
              <div className="adminField" style={{ marginBottom: 0 }}>
                <label className="adminLabel" htmlFor="e-seo-desc">SEO description</label>
                <textarea id="e-seo-desc" className="adminInput" rows={2} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} disabled={locked} />
              </div>
              <div className="adminField" style={{ marginBottom: 0 }}>
                <label className="adminLabel" htmlFor="e-canonical">Canonical URL</label>
                <input id="e-canonical" className="adminInput" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} disabled={locked} />
              </div>
              <MediaPicker label="Ảnh chia sẻ (OG image)" value={ogMediaId} onChange={setOgMediaId} options={options.media} canManageAny={permissions.canManageMediaAny} />
            </div>
          </div>
        </div>

        <div>
          <div className="adminCard adminCardPad" style={{ marginBottom: 16, display: "grid", gap: 12 }}>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="e-category">Chuyên mục</label>
              <select id="e-category" className="adminSelect" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={locked}>
                {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="e-author">Tác giả</label>
              <select id="e-author" className="adminSelect" value={authorId ?? ""} onChange={(e) => setAuthorId(e.target.value || null)} disabled={locked}>
                <option value="">— Không chọn —</option>
                {authorOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {permissions.authorRestricted && <span className="adminHint">Bạn chỉ có thể chọn chính mình làm tác giả.</span>}
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="e-org">Đơn vị</label>
              <select id="e-org" className="adminSelect" value={organizationId ?? ""} onChange={(e) => setOrganizationId(e.target.value || null)} disabled={locked}>
                <option value="">— Không chọn —</option>
                {options.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="e-province">Địa phương</label>
              <select id="e-province" className="adminSelect" value={provinceId ?? ""} onChange={(e) => setProvinceId(e.target.value || null)} disabled={locked}>
                <option value="">— Không chọn —</option>
                {options.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <MediaPicker label="Ảnh cover" value={coverMediaId} onChange={setCoverMediaId} options={options.media} canManageAny={permissions.canManageMediaAny} />
          </div>

          <div className="adminCard adminCardPad" style={{ marginBottom: 16 }}>
            <MultiCheckList label="Chủ đề" options={options.topics} selected={topicIds} onChange={setTopicIds} />
            <div style={{ height: 10 }} />
            <MultiCheckList label="Tag" options={options.tags} selected={tagIds} onChange={setTagIds} />
          </div>

          {revisions.length > 0 && (
            <div className="adminCard adminCardPad">
              <h2 className="adminLabel" style={{ marginBottom: 10, fontSize: 13 }}>Lịch sử phiên bản</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                {revisions.map((r) => (
                  <div key={r.version} style={{ fontSize: 12, borderBottom: "1px solid var(--admin-border)", paddingBottom: 6 }}>
                    <div><strong>v{r.version}</strong> — {r.changedByName}</div>
                    <div className="adminHint">{new Date(r.createdAt).toLocaleString("vi-VN")}{r.note ? ` · ${r.note}` : ""}</div>
                    {permissions.canRestoreRevision && (
                      <form action={restoreRevisionAction}>
                        <input type="hidden" name="articleId" value={articleId} />
                        <input type="hidden" name="version" value={r.version} />
                        <button type="submit" className="adminButton adminButtonSmall" style={{ marginTop: 4 }}>Khôi phục phiên bản này</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="adminCard adminCardPad" style={{ marginTop: 16 }}>
            <h2 className="adminLabel" style={{ marginBottom: 10, fontSize: 13 }}>Ghi chú nội bộ</h2>
            <p className="adminHint" style={{ marginTop: 0, marginBottom: 10 }}>Chỉ hiển thị trong CMS — không public.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", marginBottom: 10 }}>
              {notes.length === 0 && <span className="adminHint">Chưa có ghi chú nào.</span>}
              {notes.map((n) => (
                <div key={n.id} style={{ fontSize: 12, borderBottom: "1px solid var(--admin-border)", paddingBottom: 6 }}>
                  <div><strong>{n.authorName}</strong> <span className="adminHint">· {new Date(n.createdAt).toLocaleString("vi-VN")}</span></div>
                  <div style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>{n.body}</div>
                </div>
              ))}
            </div>
            <form action={addNoteAction} style={{ display: "flex", gap: 6 }}>
              <input type="hidden" name="articleId" value={articleId} />
              <input type="text" name="body" required placeholder="Thêm ghi chú nội bộ…" className="adminInput" style={{ flex: 1 }} />
              <button type="submit" className="adminButton adminButtonSmall">Gửi</button>
            </form>
          </div>
        </div>
      </div>

      <div className="adminStickyBar">
        <span className={saveError ? "adminSaveStatus adminSaveStatusError" : "adminSaveStatus"}>
          {saveError
            ? `Lỗi lưu: ${saveError}`
            : dirty
              ? (canAutosave ? "Đang lưu…" : "Có thay đổi chưa lưu")
              : "Đã lưu"}
        </span>

        <button type="button" className="adminButton adminButtonPrimary" onClick={handleManualSave} disabled={locked}>
          Lưu
        </button>

        {!locked && permissions.canSubmit && initial.status === "DRAFT" && (
          <form action={submitForReviewAction}>
            <input type="hidden" name="articleId" value={articleId} />
            <button type="submit" className="adminButton" disabled={actionsBlocked}>Gửi duyệt</button>
          </form>
        )}
        {permissions.canApprove && initial.status === "IN_REVIEW" && (
          <form action={approveAction}>
            <input type="hidden" name="articleId" value={articleId} />
            <button type="submit" className="adminButton adminButtonPrimary" disabled={actionsBlocked}>Duyệt</button>
          </form>
        )}
        {permissions.canReturn && (initial.status === "IN_REVIEW" || initial.status === "APPROVED") && (
          <form action={returnForRevisionAction} style={{ display: "flex", gap: 4 }}>
            <input type="hidden" name="articleId" value={articleId} />
            <input type="text" name="note" required placeholder="Ghi chú trả lại…" className="adminInput" style={{ width: 160 }} />
            <button type="submit" className="adminButton" disabled={actionsBlocked}>Trả lại</button>
          </form>
        )}
        {permissions.canPublish && (initial.status === "APPROVED" || initial.status === "SCHEDULED") && (
          <form action={publishAction}>
            <input type="hidden" name="articleId" value={articleId} />
            <button type="submit" className="adminButton adminButtonPrimary" disabled={actionsBlocked}>Xuất bản</button>
          </form>
        )}
        {permissions.canSchedule && initial.status === "APPROVED" && (
          <form action={scheduleAction} style={{ display: "flex", gap: 4 }}>
            <input type="hidden" name="articleId" value={articleId} />
            <input type="datetime-local" name="scheduledAt" required className="adminInput" />
            <button type="submit" className="adminButton" disabled={actionsBlocked}>Hẹn giờ</button>
          </form>
        )}
        {permissions.canUnpublish && initial.status === "PUBLISHED" && (
          <form action={unpublishAction}>
            <input type="hidden" name="articleId" value={articleId} />
            <button type="submit" className="adminButton adminButtonDanger" disabled={actionsBlocked}>Gỡ bài</button>
          </form>
        )}
        {permissions.canUnpublish && initial.status !== "PUBLISHED" && initial.status !== "ARCHIVED" && (
          <form action={archiveAction}>
            <input type="hidden" name="articleId" value={articleId} />
            <button type="submit" className="adminButton" disabled={actionsBlocked}>Lưu trữ</button>
          </form>
        )}
        {permissions.canUnpublish && initial.status === "ARCHIVED" && (
          <form action={restoreFromArchiveAction}>
            <input type="hidden" name="articleId" value={articleId} />
            <button type="submit" className="adminButton" disabled={actionsBlocked}>Khôi phục</button>
          </form>
        )}
        {permissions.canDelete && (
          <button type="button" className="adminButton adminButtonDanger" onClick={handleDelete} disabled={actionsBlocked}>Xoá</button>
        )}
      </div>
    </>
  );
}
