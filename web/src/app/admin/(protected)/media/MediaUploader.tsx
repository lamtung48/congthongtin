"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { MediaStatus, MediaType } from "@/generated/prisma/client";

/**
 * Brief section 4: "[Upload ảnh] ... hỗ trợ drag/drop, multi upload,
 * progress, retry, error." One `XMLHttpRequest` per file — `fetch` has no
 * upload-progress event, so this is the only way to show a real percentage
 * per file rather than a fake spinner. Multi-file selection just starts one
 * of these per file concurrently; each tracks and retries independently, so
 * one large/slow/failing file never blocks the others.
 */

export interface UploadedMedia {
  id: string;
  filename: string | null;
  alt: string | null;
  caption: string | null;
  type: MediaType;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  status: MediaStatus;
}

interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  state: "uploading" | "success" | "error";
  error?: string;
}

function uploadOne(file: File, onProgress: (percent: number) => void): Promise<UploadedMedia> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON response (e.g. a proxy error page) falls through to the
        // generic message below.
      }
      if (xhr.status >= 200 && xhr.status < 300 && body && typeof body === "object" && "media" in body) {
        resolve((body as { media: UploadedMedia }).media);
        return;
      }
      const serverError = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : null;
      reject(new Error(serverError ?? `Tải lên thất bại (mã lỗi ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Mất kết nối trong khi tải lên."));
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export function MediaUploader({ onUploaded }: { onUploaded: (media: UploadedMedia) => void }) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const startUpload = useCallback(
    (file: File) => {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setItems((prev) => [...prev, { id: localId, file, progress: 0, state: "uploading" }]);
      uploadOne(file, (percent) => setItems((prev) => prev.map((it) => (it.id === localId ? { ...it, progress: percent } : it))))
        .then((media) => {
          setItems((prev) => prev.map((it) => (it.id === localId ? { ...it, progress: 100, state: "success" } : it)));
          onUploaded(media);
        })
        .catch((err: Error) => {
          setItems((prev) => prev.map((it) => (it.id === localId ? { ...it, state: "error", error: err.message } : it)));
        });
    },
    [onUploaded],
  );

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    Array.from(fileList).forEach(startUpload);
  }

  function retry(itemId: string) {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    startUpload(item.file);
  }

  function dismiss(itemId: string) {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Tải ảnh lên"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${dragOver ? "var(--admin-brand)" : "var(--admin-border)"}`,
          borderRadius: "var(--admin-radius)",
          padding: 14,
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "var(--admin-bg)" : "transparent",
        }}
      >
        <p className="adminHint" style={{ margin: 0 }}>
          Kéo thả ảnh vào đây, hoặc bấm để chọn tệp — JPEG, PNG, WEBP, GIF, tối đa 10MB.
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 6 }}>
          {items.map((it) => (
            <li key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ flex: "0 1 160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.file.name}</span>
              {it.state === "uploading" && (
                <div style={{ flex: 1, height: 6, background: "var(--admin-border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${it.progress}%`, height: "100%", background: "var(--admin-brand)" }} />
                </div>
              )}
              {it.state === "success" && <span className="adminBadge adminBadgeSuccess">Xong</span>}
              {it.state === "error" && (
                <>
                  <span className="adminErrorText" role="alert" style={{ flex: 1 }}>{it.error}</span>
                  <button type="button" className="adminButton adminButtonSmall" onClick={() => retry(it.id)}>Thử lại</button>
                </>
              )}
              <button type="button" className="adminButton adminButtonSmall" onClick={() => dismiss(it.id)} aria-label="Đóng thông báo">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
