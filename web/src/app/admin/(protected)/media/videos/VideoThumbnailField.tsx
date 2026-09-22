"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * "Ảnh thumbnail thay thế (tuỳ chọn)" — a video's own cover image, stored on
 * Google Drive (Shared Drive) like every other CMS image. This field only
 * *picks* the file and previews it at the real 16:9 crop; the parent uploads
 * it with `uploadImageFile` right before it submits the video, so an
 * abandoned form never leaves a stray image in the library. With no file
 * chosen the preview shows what visitors will get instead: YouTube's own
 * thumbnail (`fallbackVideoId`), or the image already set (`currentUrl`).
 */

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024; // same cap as /api/admin/media/upload

export function VideoThumbnailField({
  file,
  onChange,
  disabled = false,
  currentUrl,
  fallbackVideoId,
  label = "Ảnh thumbnail thay thế (tuỳ chọn)",
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  /** The custom image already set on this video, if any. */
  currentUrl?: string | null;
  /** YouTube video id — its default thumbnail is what shows without a custom one. */
  fallbackVideoId?: string | null;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) {
      setError("Chỉ nhận ảnh JPG, PNG hoặc WEBP.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Ảnh vượt quá 10MB.");
      return;
    }
    setError(null);
    onChange(f);
  }

  const shown = previewUrl ?? currentUrl ?? (fallbackVideoId ? `https://img.youtube.com/vi/${fallbackVideoId}/mqdefault.jpg` : null);
  const caption = previewUrl
    ? `Ảnh mới: ${file?.name}`
    : currentUrl
      ? "Đang dùng ảnh thumbnail riêng"
      : "Chưa chọn — sẽ dùng ảnh mặc định của YouTube";

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label className="adminLabel" htmlFor={inputId} style={{ marginBottom: 0 }}>{label}</label>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            position: "relative",
            width: 160,
            aspectRatio: "16 / 9",
            borderRadius: "var(--admin-radius)",
            overflow: "hidden",
            background: "var(--admin-bg)",
            border: `1px ${previewUrl || currentUrl ? "solid" : "dashed"} var(--admin-border)`,
            flex: "none",
          }}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL / YouTube still, not something next/image can optimize
            <img src={shown} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: previewUrl || currentUrl ? 1 : 0.7 }} />
          ) : (
            <span className="adminHint" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 11, textAlign: "center", padding: 6 }}>
              Ảnh mặc định của YouTube
            </span>
          )}
        </div>
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <span className="adminHint" style={{ fontSize: 12 }}>{caption}</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="adminButton adminButtonSmall" onClick={() => inputRef.current?.click()} disabled={disabled}>
              {file || currentUrl ? "Chọn ảnh khác" : "Chọn ảnh"}
            </button>
            {file && (
              <button type="button" className="adminButton adminButtonSmall" onClick={() => onChange(null)} disabled={disabled}>
                Bỏ ảnh đã chọn
              </button>
            )}
          </div>
          <span className="adminHint" style={{ fontSize: 11 }}>JPG/PNG/WEBP, tối đa 10MB, nên dùng tỉ lệ 16:9 (vd. 1280×720). Ảnh lưu trên Google Drive của Hội.</span>
        </div>
      </div>
      {error && <p className="adminErrorText" role="alert" style={{ margin: 0 }}>{error}</p>}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
