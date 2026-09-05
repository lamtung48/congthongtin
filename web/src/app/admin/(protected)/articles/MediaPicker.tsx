"use client";

import { useState, useTransition } from "react";
import { linkMediaAction } from "./mediaActions";
import { MediaUploader, type UploadedMedia } from "../media/MediaUploader";

export interface MediaOption {
  id: string;
  label: string;
  type: "IMAGE" | "VIDEO";
}

function uploadedMediaLabel(media: UploadedMedia): string {
  return media.alt || media.caption || media.filename || media.id;
}

/**
 * Controlled media picker shared by the cover-image field and every
 * image/gallery/youtube block editor (brief section 5's block editor,
 * `BlockEditor.tsx`) — one selection UI, not one per call site. `accept`
 * narrows the dropdown to the relevant `MediaType`.
 *
 * For `accept === "IMAGE"` the primary way to add a new option is a real
 * upload through `MediaUploader` (brief section 4) — every role that can
 * reach this picker already holds at least `media.manage.own`, so uploading
 * for one's own use needs no extra gate here (`/api/admin/media/upload`
 * re-checks permission server-side regardless). The old manual
 * provider/providerFileId form survives only as a collapsed "nâng cao"
 * fallback, and only for Admin/Manager (`canManageAny`) — see
 * `mediaService.registerManualLink`'s own header comment for why. For
 * `accept === "VIDEO"` there is no upload path at all (a YouTube video isn't
 * a file this app hosts), so that same form is the *only* way to add one and
 * stays open to anyone who can reach this picker.
 */
export function MediaPicker({
  label,
  accept,
  value,
  onChange,
  options,
  canManageAny = false,
}: {
  label: string;
  accept: "IMAGE" | "VIDEO" | "ANY";
  value: string | null;
  onChange: (mediaId: string | null) => void;
  options: MediaOption[];
  canManageAny?: boolean;
}) {
  const [localOptions, setLocalOptions] = useState(options);
  const [showManualLink, setShowManualLink] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = accept === "ANY" ? localOptions : localOptions.filter((o) => o.type === accept);
  const showUploader = accept === "IMAGE" || accept === "ANY";
  const showManualLinkToggle = accept === "VIDEO" || canManageAny;

  function handleUploaded(media: UploadedMedia) {
    setLocalOptions((prev) => [{ id: media.id, label: uploadedMediaLabel(media), type: media.type }, ...prev]);
    onChange(media.id);
  }

  function handleManualLink(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await linkMediaAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setLocalOptions((prev) => [{ id: result.id, label: result.label, type: result.type }, ...prev]);
      onChange(result.id);
      setShowManualLink(false);
    });
  }

  return (
    <div className="adminField" style={{ marginBottom: 0 }}>
      <label className="adminLabel">{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <select
          className="adminSelect"
          style={{ flex: 1 }}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">— Không chọn —</option>
          {filtered.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {showManualLinkToggle && (
          <button type="button" className="adminButton adminButtonSmall" onClick={() => setShowManualLink((s) => !s)}>
            {showManualLink ? "Đóng" : accept === "VIDEO" ? "+ Thêm video" : "Nâng cao"}
          </button>
        )}
      </div>

      {showUploader && (
        <div style={{ marginTop: 8 }}>
          <MediaUploader onUploaded={handleUploaded} />
        </div>
      )}

      {showManualLink && (
        <form
          action={handleManualLink}
          style={{ marginTop: 8, padding: 10, border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", display: "grid", gap: 8 }}
        >
          {accept !== "VIDEO" && (
            <p className="adminHint" style={{ margin: 0 }}>Liên kết thủ công một tệp đã có trên Drive — chỉ dùng khi không thể tải lên trực tiếp.</p>
          )}
          <input type="hidden" name="type" value={accept === "ANY" ? "IMAGE" : accept} />
          <select name="provider" className="adminSelect" defaultValue={accept === "VIDEO" ? "YOUTUBE" : "GOOGLE_DRIVE"} required>
            {accept !== "VIDEO" && <option value="GOOGLE_DRIVE">Google Drive</option>}
            {(accept === "VIDEO" || accept === "ANY") && <option value="YOUTUBE">YouTube</option>}
            {accept !== "VIDEO" && <option value="LOCAL_PLACEHOLDER">Placeholder (chưa có tệp)</option>}
          </select>
          <input
            name="providerFileId"
            type="text"
            placeholder={accept === "VIDEO" ? "YouTube video id" : "Drive file id (tuỳ chọn)"}
            className="adminInput"
          />
          <input name="alt" type="text" placeholder="Mô tả ảnh (alt)" className="adminInput" />
          <input name="caption" type="text" placeholder="Chú thích (tuỳ chọn)" className="adminInput" />
          <button type="submit" className="adminButton adminButtonPrimary adminButtonSmall" disabled={pending}>
            {pending ? "Đang thêm…" : "Thêm media"}
          </button>
          {error && <p className="adminErrorText" role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}
