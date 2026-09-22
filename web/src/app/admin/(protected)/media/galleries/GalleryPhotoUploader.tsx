"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MediaUploader, type UploadedMedia } from "../MediaUploader";
import { addPhotosAction } from "./actions";

/**
 * Wraps the shared `MediaUploader` (drag/drop, multi-file, per-file
 * progress + retry) and attaches each finished upload to this gallery.
 *
 * Uploads are collected rather than attached one-by-one: `MediaUploader`
 * runs every file concurrently, so a per-file Server Action would fire a
 * burst of writes that each revalidate the homepage. "Thêm N ảnh vào nhóm"
 * commits them together once the editor is done.
 */
export function GalleryPhotoUploader({ galleryId, nameHint }: { galleryId: string; nameHint: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<UploadedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function attach() {
    if (pending.length === 0) return;
    const ids = pending.map((m) => m.id);
    startSaving(async () => {
      const result = await addPhotosAction(galleryId, ids);
      if (!result.ok) {
        setError(result.error ?? "Không thêm được ảnh.");
        return;
      }
      setError(null);
      setPending([]);
      router.refresh();
    });
  }

  return (
    <div className="adminCard adminCardPad" style={{ display: "grid", gap: 10 }}>
      <div>
        <span className="adminLabel">Thêm ảnh vào nhóm</span>
        <p className="adminHint" style={{ margin: "2px 0 0" }}>
          Kéo thả nhiều ảnh cùng lúc, hoặc bấm để chọn. Ảnh được tự thu nhỏ về tối đa 1600px và tải lên Google Drive.
        </p>
      </div>

      <MediaUploader nameHint={nameHint} onUploaded={(m) => setPending((prev) => [...prev, m])} />

      {pending.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="adminHint">{pending.length} ảnh đã tải lên, chưa thêm vào nhóm.</span>
          <button type="button" onClick={attach} disabled={saving} className="adminButton adminButtonSmall adminButtonPrimary">
            {saving ? "Đang thêm…" : `Thêm ${pending.length} ảnh vào nhóm`}
          </button>
          <button type="button" onClick={() => setPending([])} disabled={saving} className="adminButton adminButtonSmall">
            Bỏ
          </button>
        </div>
      )}

      {error && <p className="adminErrorText" role="alert" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
