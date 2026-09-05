"use client";

import { useId, useRef, useState } from "react";
import type { MediaStatus, MediaType, YoutubeVisibility } from "@/generated/prisma/client";

/**
 * Brief section 3: a real YouTube upload with title/description/visibility
 * — one video at a time (unlike `MediaUploader`'s multi-file image queue),
 * since each video needs its own title/description entered before the
 * upload can even start. `XMLHttpRequest` for the same reason as
 * `MediaUploader`: `fetch` has no upload-progress event.
 */

export interface UploadedVideo {
  id: string;
  filename: string | null;
  caption: string | null;
  type: MediaType;
  providerFileId: string | null;
  visibility: YoutubeVisibility | null;
  durationSeconds: number | null;
  status: MediaStatus;
  errorReason: string | null;
}

type UploadState = { phase: "idle" } | { phase: "uploading"; progress: number } | { phase: "error"; message: string };

function uploadOne(file: File, title: string, description: string, visibility: string, onProgress: (percent: number) => void): Promise<UploadedVideo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media/videos/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON response (e.g. a proxy error page) falls through below.
      }
      if (xhr.status >= 200 && xhr.status < 300 && body && typeof body === "object" && "media" in body) {
        resolve((body as { media: UploadedVideo }).media);
        return;
      }
      const serverError = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : null;
      reject(new Error(serverError ?? `Tải lên thất bại (mã lỗi ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Mất kết nối trong khi tải lên."));
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("visibility", visibility);
    xhr.send(formData);
  });
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

export function VideoUploader({ onUploaded, canChooseVisibility }: { onUploaded: (media: UploadedVideo) => void; canChooseVisibility: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("unlisted");
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  function pickFile(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setTitle(titleFromFilename(f.name));
    setState({ phase: "idle" });
  }

  function startUpload() {
    if (!file) return;
    setState({ phase: "uploading", progress: 0 });
    uploadOne(file, title.trim(), description.trim(), canChooseVisibility ? visibility : "unlisted", (progress) => setState({ phase: "uploading", progress }))
      .then((media) => {
        setState({ phase: "idle" });
        setFile(null);
        setTitle("");
        setDescription("");
        onUploaded(media);
      })
      .catch((err: Error) => setState({ phase: "error", message: err.message }));
  }

  if (!file) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Tải video lên"
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
          pickFile(e.dataTransfer.files[0]);
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
        <p className="adminHint" style={{ margin: 0 }}>Kéo thả video vào đây, hoặc bấm để chọn tệp — MP4, MOV, WEBM, AVI, tối đa 200MB.</p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
          style={{ display: "none" }}
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, padding: 10, border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
      <span className="adminHint">Tệp: {file.name} ({(file.size / (1024 * 1024)).toFixed(1)}MB)</span>
      <input className="adminInput" placeholder="Tiêu đề video" value={title} onChange={(e) => setTitle(e.target.value)} disabled={state.phase === "uploading"} />
      <textarea className="adminInput" rows={2} placeholder="Mô tả (tuỳ chọn)" value={description} onChange={(e) => setDescription(e.target.value)} disabled={state.phase === "uploading"} />
      {canChooseVisibility ? (
        <select className="adminSelect" value={visibility} onChange={(e) => setVisibility(e.target.value)} disabled={state.phase === "uploading"}>
          <option value="public">Công khai (Public)</option>
          <option value="unlisted">Không công khai (Unlisted)</option>
          <option value="private">Riêng tư (Private)</option>
        </select>
      ) : (
        <span className="adminHint">Video sẽ ở trạng thái &quot;Không công khai&quot; (unlisted).</span>
      )}

      {state.phase === "uploading" && (
        <div style={{ height: 6, background: "var(--admin-border)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${state.progress}%`, height: "100%", background: "var(--admin-brand)" }} />
        </div>
      )}
      {state.phase === "error" && <p className="adminErrorText" role="alert">{state.message}</p>}

      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className="adminButton adminButtonSmall adminButtonPrimary" onClick={startUpload} disabled={!title.trim() || state.phase === "uploading"}>
          {state.phase === "uploading" ? "Đang tải lên…" : "Tải video lên"}
        </button>
        <button type="button" className="adminButton adminButtonSmall" onClick={() => setFile(null)} disabled={state.phase === "uploading"}>Huỷ</button>
      </div>
    </div>
  );
}
