"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { linkVideoAction, importChannelVideoAction, browseChannelVideosAction } from "./actions";
import { VideoUploader, type UploadedVideo } from "./VideoUploader";

/**
 * "Thêm video" panel on `/admin/media/videos` itself — the same three
 * add-paths `VideoPicker.tsx` offers inside the article editor (upload /
 * paste URL-ID / browse channel), just without a "selected value" concept:
 * every successful add lands in the library table below via the server
 * actions' own `revalidatePath("/admin/media/videos")` (see `actions.ts`),
 * except the upload path, which goes through the plain route handler
 * (`VideoUploader` needs `XMLHttpRequest` progress events a Server Action
 * can't give it) and so calls `router.refresh()` itself in `handleUploaded`.
 */
export function AddVideoPanel({ canUpload, canManageAny }: { canUpload: boolean; canManageAny: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "upload" | "link" | "browse">("none");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [browseItems, setBrowseItems] = useState<{ videoId: string; title: string; thumbnailUrl: string | undefined }[] | null>(null);
  const [browseNextToken, setBrowseNextToken] = useState<string | undefined>();

  // The route handler's response is discarded here — `router.refresh()`
  // simply re-fetches this Server Component page, which already has
  // everything it needs to render the freshly-uploaded row.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleUploaded(media: UploadedVideo) {
    setMode("none");
    router.refresh();
  }

  function handleLink(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await linkVideoAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Không thể thêm video.");
        return;
      }
      setLinkInput("");
      setMode("none");
    });
  }

  function loadChannel(pageToken?: string) {
    setError(null);
    startTransition(async () => {
      const result = await browseChannelVideosAction(pageToken);
      if (!result.ok) {
        setError(result.error ?? "Không thể tải danh sách video từ kênh.");
        return;
      }
      setBrowseItems((prev) => (pageToken ? [...(prev ?? []), ...(result.items ?? [])] : (result.items ?? [])));
      setBrowseNextToken(result.nextPageToken);
    });
  }

  function handleImport(videoId: string) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("videoId", videoId);
      const result = await importChannelVideoAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Không thể thêm video.");
        return;
      }
      setMode("none");
    });
  }

  function toggleMode(next: "upload" | "link" | "browse") {
    const opening = mode !== next;
    setMode(opening ? next : "none");
    setError(null);
    if (opening && next === "browse" && !browseItems) loadChannel(undefined);
  }

  return (
    <div className="adminCard adminCardPad" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {canUpload && (
          <button type="button" className="adminButton adminButtonSmall" onClick={() => toggleMode("upload")}>
            {mode === "upload" ? "Đóng" : "Tải video lên"}
          </button>
        )}
        <button type="button" className="adminButton adminButtonSmall" onClick={() => toggleMode("link")}>
          {mode === "link" ? "Đóng" : "Dán URL / ID"}
        </button>
        {canManageAny && (
          <button type="button" className="adminButton adminButtonSmall" onClick={() => toggleMode("browse")}>
            {mode === "browse" ? "Đóng" : "Chọn từ kênh"}
          </button>
        )}
      </div>

      {mode === "upload" && <VideoUploader onUploaded={handleUploaded} canChooseVisibility={canManageAny} />}

      {mode === "link" && (
        <form action={handleLink} style={{ display: "flex", gap: 6 }}>
          <input
            name="input"
            className="adminInput"
            style={{ flex: 1 }}
            placeholder="URL YouTube hoặc video ID"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
          />
          <button type="submit" className="adminButton adminButtonSmall adminButtonPrimary" disabled={pending}>
            {pending ? "Đang thêm…" : "Thêm"}
          </button>
        </form>
      )}

      {mode === "browse" && (
        <div style={{ display: "grid", gap: 6 }}>
          {!browseItems && pending && <span className="adminHint">Đang tải danh sách video…</span>}
          {browseItems && browseItems.length === 0 && <span className="adminHint">Kênh chưa có video nào.</span>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(browseItems ?? []).map((item) => (
              <button
                key={item.videoId}
                type="button"
                onClick={() => handleImport(item.videoId)}
                disabled={pending}
                style={{ width: 120, border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", padding: 4, background: "var(--admin-surface)", cursor: "pointer", textAlign: "left" }}
              >
                {item.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- a public YouTube thumbnail URL, not a local asset next/image would optimize
                  <img src={item.thumbnailUrl} alt={item.title} style={{ width: "100%", borderRadius: 4, display: "block" }} />
                )}
                <span style={{ fontSize: 11, display: "block", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
              </button>
            ))}
          </div>
          {browseNextToken && (
            <button type="button" className="adminButton adminButtonSmall" onClick={() => loadChannel(browseNextToken)} disabled={pending}>
              Tải thêm
            </button>
          )}
        </div>
      )}

      {error && <p className="adminErrorText" role="alert">{error}</p>}
    </div>
  );
}
