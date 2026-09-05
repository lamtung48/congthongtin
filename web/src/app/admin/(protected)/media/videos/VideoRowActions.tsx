"use client";

import { useState, useTransition } from "react";
import { updateVideoMetadataAction, refreshVideoStatusAction, unlinkVideoAction, type VideoActionResult } from "./actions";

/**
 * Per-row manage controls on `/admin/media/videos` — the video counterpart
 * to `MediaRowActions.tsx`, plus two things images don't have: a visibility
 * field (with the same "Contributor can only pick unlisted" restriction
 * `youtubeService.updateVideoMetadata` enforces server-side) and a "kiểm tra
 * trạng thái" button that re-reads the video's live state from YouTube.
 * `canManage`/`isAdmin` are UI convenience only — every actual check runs
 * inside `youtubeService`/`mediaService` regardless of what this shows.
 */
export function VideoRowActions({
  mediaId,
  title,
  description,
  visibility,
  canManage,
  canSetAnyVisibility,
  isAdmin,
}: {
  mediaId: string;
  title: string;
  description: string;
  visibility: string;
  canManage: boolean;
  canSetAnyVisibility: boolean;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<VideoActionResult["usage"] | null>(null);

  if (!canManage) return <span className="adminHint">—</span>;

  function submitMetadata(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateVideoMetadataAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Không thể cập nhật.");
        return;
      }
      setEditing(false);
    });
  }

  function submitRefresh() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("mediaId", mediaId);
      const result = await refreshVideoStatusAction(formData);
      if (!result.ok) setError(result.error ?? "Không thể làm mới trạng thái.");
    });
  }

  function submitUnlink(force: boolean) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("mediaId", mediaId);
      formData.set("force", force ? "true" : "false");
      const result = await unlinkVideoAction(formData);
      if (!result.ok) {
        setUsage(result.usage ?? null);
        setError(result.error ?? "Không thể gỡ liên kết.");
        return;
      }
      setUsage(null);
    });
  }

  const canForceUnlink = isAdmin && !!usage && usage.length > 0 && !usage.some((u) => u.hardBlock);

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 180 }}>
      {editing ? (
        <form action={submitMetadata} style={{ display: "grid", gap: 4 }}>
          <input type="hidden" name="mediaId" value={mediaId} />
          <input name="title" defaultValue={title} placeholder="Tiêu đề" className="adminInput" style={{ fontSize: 12 }} />
          <textarea name="description" defaultValue={description} placeholder="Mô tả" rows={2} className="adminInput" style={{ fontSize: 12 }} />
          <select name="visibility" defaultValue={visibility.toLowerCase()} className="adminSelect" style={{ fontSize: 12 }}>
            {canSetAnyVisibility && <option value="public">Công khai</option>}
            <option value="unlisted">Không công khai</option>
            {canSetAnyVisibility && <option value="private">Riêng tư</option>}
          </select>
          <div style={{ display: "flex", gap: 4 }}>
            <button type="submit" className="adminButton adminButtonSmall adminButtonPrimary" disabled={pending}>Lưu</button>
            <button type="button" className="adminButton adminButtonSmall" onClick={() => setEditing(false)} disabled={pending}>Huỷ</button>
          </div>
        </form>
      ) : (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button type="button" className="adminButton adminButtonSmall" onClick={() => setEditing(true)}>Sửa</button>
          <button type="button" className="adminButton adminButtonSmall" onClick={submitRefresh} disabled={pending}>Làm mới</button>
          <button type="button" className="adminButton adminButtonSmall adminButtonDanger" onClick={() => submitUnlink(false)} disabled={pending}>Gỡ liên kết</button>
        </div>
      )}

      {error && (
        <div style={{ display: "grid", gap: 4 }}>
          <p className="adminErrorText" role="alert" style={{ margin: 0 }}>{error}</p>
          {usage && usage.length > 0 && (
            <ul className="adminHint" style={{ margin: 0, paddingLeft: 16 }}>
              {usage.map((u, i) => <li key={i}>{u.entityLabel}</li>)}
            </ul>
          )}
          {canForceUnlink && (
            <button type="button" className="adminButton adminButtonSmall adminButtonDanger" onClick={() => submitUnlink(true)} disabled={pending}>
              Vẫn gỡ (khỏi các nơi trên)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
