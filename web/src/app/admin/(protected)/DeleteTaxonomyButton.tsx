"use client";

import { useState, useTransition } from "react";

/**
 * Shared "Xoá" control for the three taxonomy screens (chuyên mục, chủ đề,
 * tag). Confirmation text is passed in rather than built here because each
 * screen knows something different about the consequence — deleting a topic
 * detaches N articles, deleting a category is refused outright if anything
 * points at it.
 *
 * The action returns `{ ok, error }` instead of throwing, so a refusal
 * ("còn 7 bài viết") shows up next to the row it belongs to instead of
 * replacing the whole page with an error boundary.
 */
export function DeleteTaxonomyButton({
  id,
  confirmMessage,
  action,
}: {
  id: string;
  confirmMessage: string;
  action: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onClick() {
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    start(async () => {
      const result = await action(id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
      <button type="button" onClick={onClick} disabled={pending} className="adminButton adminButtonSmall adminButtonDanger">
        {pending ? "Đang xoá…" : "Xoá"}
      </button>
      {error && (
        <span className="adminErrorText" role="alert" style={{ maxWidth: 340, textAlign: "right" }}>
          {error}
        </span>
      )}
    </div>
  );
}
