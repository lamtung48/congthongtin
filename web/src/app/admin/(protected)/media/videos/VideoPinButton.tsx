"use client";

import { useState, useTransition } from "react";
import { toggleVideoHomepagePinAction } from "./actions";

/**
 * Two-state homepage pin for one video. `pinRank` is the video's 1-based
 * position in the homepage section, shown on the badge, because the admin
 * list is paginated while the homepage is not: a pinned video sitting on
 * page 2 would otherwise give no clue that it is actually the first thing a
 * visitor sees.
 *
 * A media asset that was never published as a video has nothing to pin, so
 * it gets an explanation instead of a button that would only fail.
 */
export function VideoPinButton({
  mediaId,
  videoId,
  pinRank,
  canManage,
}: {
  mediaId: string;
  videoId: string | null;
  pinRank: number | null;
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pinned = pinRank !== null;

  if (!videoId) {
    return <span className="adminHint">Chưa đăng công khai</span>;
  }
  if (!canManage) {
    return pinned ? <span className="adminBadge adminBadgeBrand">★ Trang chủ #{pinRank}</span> : <span className="adminHint">—</span>;
  }

  function toggle() {
    setError(null);
    const form = new FormData();
    form.set("mediaId", mediaId);
    form.set("pinned", pinned ? "false" : "true");
    start(async () => {
      const result = await toggleVideoHomepagePinAction(form);
      if (!result.ok) setError(result.error ?? "Không đổi được trạng thái ghim.");
    });
  }

  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
      {pinned && <span className="adminBadge adminBadgeBrand">★ Trang chủ #{pinRank}</span>}
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`adminButton adminButtonSmall${pinned ? "" : " adminButtonPrimary"}`}
        title={pinned ? "Bỏ ghim video này khỏi trang chủ" : "Ghim video này lên đầu mục Video và phóng sự"}
      >
        {pending ? "Đang lưu…" : pinned ? "Gỡ khỏi trang chủ" : "★ Ghim trang chủ"}
      </button>
      {error && <span className="adminErrorText" role="alert" style={{ maxWidth: 220 }}>{error}</span>}
    </div>
  );
}
