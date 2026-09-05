"use client";

import { useState, useTransition } from "react";
import { linkMediaAction } from "./mediaActions";
import { MediaUploader, type UploadedMedia } from "../media/MediaUploader";

export interface MediaOption {
  id: string;
  label: string;
  type: "IMAGE" | "VIDEO";
  /** Set only for a `GOOGLE_DRIVE`+`READY` asset — the `/api/media/[id]`
   *  delivery URL a caller can drop straight into an `<img>` for a real
   *  thumbnail (brief: "embed ảnh ... trong cùng một khung"). `undefined`
   *  for anything else (YouTube, a placeholder, or a Drive asset still
   *  missing its file) — callers fall back to a label-only placeholder. */
  previewUrl?: string;
}

function uploadedMediaLabel(media: UploadedMedia): string {
  return media.alt || media.caption || media.filename || media.id;
}

/**
 * Controlled media picker shared by the cover-image/OG-image fields
 * (`ArticleEditor.tsx`) and every image/gallery/youtube node view embedded
 * in the rich-text body editor (`tiptap/nodes.tsx`) — one selection UI, not
 * one per call site. `accept` narrows the dropdown to the relevant
 * `MediaType`.
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
 *
 * `onChange`'s second argument carries the freshly created/uploaded
 * option's full metadata (never present for a plain pick from the existing
 * dropdown, which the caller can already resolve from its own `options`) —
 * the rich-text editor's node views (`tiptap/nodes.tsx`) use it to register
 * a brand-new upload into the shared cross-node media registry so every
 * other embedded picker in the same document sees it immediately, without
 * which each `MediaPicker` instance's own upload would only ever be visible
 * to itself for the rest of the session.
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
  onChange: (mediaId: string | null, option?: MediaOption) => void;
  options: MediaOption[];
  canManageAny?: boolean;
}) {
  const [localOptions, setLocalOptions] = useState(options);
  const [showManualLink, setShowManualLink] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Keeps this dropdown in sync with options registered elsewhere (another
  // `MediaPicker` instance's upload, relayed back down through the parent's
  // `options` prop) — `useState(options)` above only seeds the *initial*
  // value, so without this a sibling picker's upload would never appear
  // here. React's documented "adjusting state when a prop changes" pattern
  // (setState during render, gated on the prop's identity actually
  // changing) rather than an effect — an effect's setState would commit one
  // extra render behind, and this codebase's lint rules disallow it anyway.
  const [prevOptions, setPrevOptions] = useState(options);
  if (options !== prevOptions) {
    setPrevOptions(options);
    setLocalOptions(options);
  }

  const filtered = accept === "ANY" ? localOptions : localOptions.filter((o) => o.type === accept);
  const showUploader = accept === "IMAGE" || accept === "ANY";
  const showManualLinkToggle = accept === "VIDEO" || canManageAny;

  function handleUploaded(media: UploadedMedia) {
    const option: MediaOption = {
      id: media.id,
      label: uploadedMediaLabel(media),
      type: media.type,
      previewUrl: `/api/media/${media.id}`, // registerUpload always creates a GOOGLE_DRIVE + READY asset
    };
    setLocalOptions((prev) => [option, ...prev]);
    onChange(media.id, option);
  }

  function handleManualLink(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await linkMediaAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      const option: MediaOption = { id: result.id, label: result.label, type: result.type, previewUrl: result.previewUrl };
      setLocalOptions((prev) => [option, ...prev]);
      onChange(result.id, option);
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
