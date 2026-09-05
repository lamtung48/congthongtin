"use client";

import { useState, useTransition } from "react";
import { updateMediaMetadataAction, deleteMediaAction, type DeleteMediaResult } from "./actions";

/**
 * Per-row manage controls on `/admin/media` — inline alt/caption edit plus
 * delete, including the two-step force-delete confirmation an Admin needs
 * when `mediaService.remove` refuses a still-referenced asset (brief section
 * 7: "bắt buộc cảnh báo/block theo policy"). `canManage` is a UI convenience
 * only (hide controls a role obviously can't use) — every actual check runs
 * server-side inside `mediaService` regardless of what this component shows.
 */
export function MediaRowActions({
  mediaId,
  alt,
  caption,
  canManage,
  isAdmin,
}: {
  mediaId: string;
  alt: string;
  caption: string;
  canManage: boolean;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<DeleteMediaResult["usage"] | null>(null);

  if (!canManage) return <span className="adminHint">—</span>;

  function submitMetadata(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateMediaMetadataAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Không thể cập nhật.");
        return;
      }
      setEditing(false);
    });
  }

  function submitDelete(force: boolean) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("mediaId", mediaId);
      formData.set("force", force ? "true" : "false");
      const result = await deleteMediaAction(formData);
      if (!result.ok) {
        setUsage(result.usage ?? null);
        setError(result.error ?? "Không thể xoá.");
        return;
      }
      setUsage(null);
    });
  }

  const canForceDelete = isAdmin && !!usage && usage.length > 0 && !usage.some((u) => u.hardBlock);

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 160 }}>
      {editing ? (
        <form action={submitMetadata} style={{ display: "grid", gap: 4 }}>
          <input type="hidden" name="mediaId" value={mediaId} />
          <input name="alt" defaultValue={alt} placeholder="Mô tả ảnh (alt)" className="adminInput" style={{ fontSize: 12 }} />
          <input name="caption" defaultValue={caption} placeholder="Chú thích" className="adminInput" style={{ fontSize: 12 }} />
          <div style={{ display: "flex", gap: 4 }}>
            <button type="submit" className="adminButton adminButtonSmall adminButtonPrimary" disabled={pending}>Lưu</button>
            <button type="button" className="adminButton adminButtonSmall" onClick={() => setEditing(false)} disabled={pending}>Huỷ</button>
          </div>
        </form>
      ) : (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button type="button" className="adminButton adminButtonSmall" onClick={() => setEditing(true)}>Sửa</button>
          <button type="button" className="adminButton adminButtonSmall adminButtonDanger" onClick={() => submitDelete(false)} disabled={pending}>Xoá</button>
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
          {canForceDelete && (
            <button type="button" className="adminButton adminButtonSmall adminButtonDanger" onClick={() => submitDelete(true)} disabled={pending}>
              Vẫn xoá (gỡ khỏi các nơi trên)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
