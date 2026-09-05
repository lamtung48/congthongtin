"use client";

import { useState, useTransition } from "react";
import { linkVideoAction, importChannelVideoAction, browseChannelVideosAction, type VideoOption } from "../media/videos/actions";
import { VideoUploader, type UploadedVideo } from "../media/videos/VideoUploader";

export type { VideoOption };

/**
 * The YouTube counterpart to `MediaPicker` — used only by the article
 * editor's YouTube block (`tiptap/nodes.tsx`'s `ArticleYoutubeView`). Kept
 * as its own component rather than folded into `MediaPicker` because
 * video's three add-paths (upload / paste URL-ID / browse channel) don't
 * share enough shape with image's (upload / manual Drive-link fallback) to
 * make a unified component clearer than two focused ones.
 *
 * Brief section 3's PRIVATE-video decision: a private video can never be
 * embedded for an anonymous site visitor, so it is filtered out of the
 * selectable dropdown here entirely (not merely flagged) and a freshly
 * linked/imported video that turns out to be private is added to the
 * library but never auto-selected into the block — see `registerAndSelect`.
 */
function uploadedToOption(media: UploadedVideo): VideoOption | null {
  if (!media.providerFileId) return null;
  return { id: media.id, label: media.filename || media.providerFileId, videoId: media.providerFileId, visibility: media.visibility };
}

interface ChannelItem {
  videoId: string;
  title: string;
  thumbnailUrl: string | undefined;
}

export function VideoPicker({
  label,
  value,
  onChange,
  options,
  canManageAny,
  canUpload,
}: {
  label: string;
  value: string | null;
  onChange: (mediaId: string | null, option?: VideoOption) => void;
  options: VideoOption[];
  canManageAny: boolean;
  canUpload: boolean;
}) {
  const [localOptions, setLocalOptions] = useState(options);
  // React's documented "adjusting state when a prop changes" pattern — see
  // `MediaPicker.tsx`'s identical comment for why this isn't a `useEffect`.
  const [prevOptions, setPrevOptions] = useState(options);
  if (options !== prevOptions) {
    setPrevOptions(options);
    setLocalOptions(options);
  }

  const [mode, setMode] = useState<"none" | "upload" | "link" | "browse">("none");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [browseItems, setBrowseItems] = useState<ChannelItem[] | null>(null);
  const [browseNextToken, setBrowseNextToken] = useState<string | undefined>();

  const selectable = localOptions.filter((o) => o.visibility !== "PRIVATE");

  function registerAndSelect(option: VideoOption) {
    setLocalOptions((prev) => [option, ...prev.filter((o) => o.id !== option.id)]);
    setMode("none");
    if (option.visibility === "PRIVATE") {
      setError("Video này đang ở chế độ riêng tư — không thể gắn vào bài viết công khai. Đã lưu vào thư viện; hãy đổi trạng thái rồi chọn lại.");
      return;
    }
    setError(null);
    onChange(option.id, option);
  }

  function handleUploaded(media: UploadedVideo) {
    const option = uploadedToOption(media);
    if (option) registerAndSelect(option);
  }

  function handleLink(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await linkVideoAction(formData);
      if (!result.ok || !result.video) {
        setError(result.error ?? "Không thể thêm video.");
        return;
      }
      registerAndSelect(result.video);
      setLinkInput("");
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
      if (!result.ok || !result.video) {
        setError(result.error ?? "Không thể thêm video.");
        return;
      }
      registerAndSelect(result.video);
    });
  }

  function toggleMode(next: "upload" | "link" | "browse") {
    const opening = mode !== next;
    setMode(opening ? next : "none");
    setError(null);
    if (opening && next === "browse" && !browseItems) loadChannel(undefined);
  }

  return (
    <div className="adminField" style={{ marginBottom: 0 }}>
      <label className="adminLabel">{label}</label>
      <select className="adminSelect" style={{ width: "100%" }} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— Không chọn —</option>
        {selectable.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>

      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
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

      {mode === "upload" && (
        <div style={{ marginTop: 8 }}>
          <VideoUploader onUploaded={handleUploaded} canChooseVisibility={canManageAny} />
        </div>
      )}

      {mode === "link" && (
        <form action={handleLink} style={{ marginTop: 8, display: "flex", gap: 6 }}>
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
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {!browseItems && pending && <span className="adminHint">Đang tải danh sách video…</span>}
          {browseItems && browseItems.length === 0 && <span className="adminHint">Kênh chưa có video nào.</span>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(browseItems ?? []).map((item) => (
              <button
                key={item.videoId}
                type="button"
                onClick={() => handleImport(item.videoId)}
                disabled={pending}
                className="richGalleryPickerItem"
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

      {error && <p className="adminErrorText" role="alert" style={{ marginTop: 6 }}>{error}</p>}
    </div>
  );
}
