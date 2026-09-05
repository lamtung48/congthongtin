"use client";

import { useState, useTransition } from "react";
import { createMediaAction } from "./mediaActions";

export interface MediaOption {
  id: string;
  label: string;
  type: "IMAGE" | "VIDEO";
}

/**
 * Controlled media picker shared by the cover-image field and every
 * image/gallery/youtube block editor (brief section 5's block editor,
 * `BlockEditor.tsx`) — one selection UI, not one per call site. `accept`
 * narrows the dropdown to the relevant `MediaType`; "+ Thêm media mới"
 * expands an inline mini-form that calls `createMediaAction` directly
 * (no full-page form submit) and appends the result to the option list,
 * since there's no real upload flow to redirect through (see
 * `mediaActions.ts`'s header comment).
 */
export function MediaPicker({
  label,
  accept,
  value,
  onChange,
  options,
}: {
  label: string;
  accept: "IMAGE" | "VIDEO" | "ANY";
  value: string | null;
  onChange: (mediaId: string | null) => void;
  options: MediaOption[];
}) {
  const [localOptions, setLocalOptions] = useState(options);
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = accept === "ANY" ? localOptions : localOptions.filter((o) => o.type === accept);

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createMediaAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setLocalOptions((prev) => [{ id: result.id, label: result.label, type: result.type }, ...prev]);
      onChange(result.id);
      setShowCreate(false);
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
        <button type="button" className="adminButton adminButtonSmall" onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? "Đóng" : "+ Thêm mới"}
        </button>
      </div>

      {showCreate && (
        <form
          action={handleCreate}
          style={{ marginTop: 8, padding: 10, border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", display: "grid", gap: 8 }}
        >
          <input type="hidden" name="type" value={accept === "ANY" ? "IMAGE" : accept} />
          <select name="provider" className="adminSelect" defaultValue="GOOGLE_DRIVE" required>
            <option value="GOOGLE_DRIVE">Google Drive</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="LOCAL_PLACEHOLDER">Placeholder (chưa có tệp)</option>
          </select>
          <input name="providerFileId" type="text" placeholder="Drive file id / YouTube video id (tuỳ chọn)" className="adminInput" />
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
