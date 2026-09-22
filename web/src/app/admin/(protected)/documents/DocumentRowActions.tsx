"use client";

import { useState, useTransition } from "react";
import { deleteDocumentAction, toggleDocumentPublishedAction, deleteDocumentLabelAction } from "./actions";

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error);
    });
  };
  return { error, pending, run };
}

export function DocumentRowActions({ id, title, isPublished }: { id: string; title: string; isPublished: boolean }) {
  const { error, pending, run } = useAction();
  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className="adminButton adminButtonSmall"
          disabled={pending}
          onClick={() => run(() => toggleDocumentPublishedAction(id, !isPublished))}
        >
          {isPublished ? "Ẩn" : "Hiện"}
        </button>
        <button
          type="button"
          className="adminButton adminButtonSmall adminButtonDanger"
          disabled={pending}
          onClick={() =>
            run(
              () => deleteDocumentAction(id),
              `Xoá tài liệu "${title}"? Tệp đã tải lên cũng bị xoá khỏi Drive.`,
            )
          }
        >
          Xoá
        </button>
      </div>
      {error && <span className="adminErrorText" role="alert" style={{ textAlign: "right", maxWidth: 300 }}>{error}</span>}
    </div>
  );
}

export function DeleteLabelButton({ id, name, count }: { id: string; name: string; count: number }) {
  const { error, pending, run } = useAction();
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start" }}>
      <button
        type="button"
        className="adminButton adminButtonSmall"
        disabled={pending}
        title={`Xoá nhãn "${name}"`}
        onClick={() =>
          run(
            () => deleteDocumentLabelAction(id),
            count > 0
              ? `Xoá nhãn "${name}"? ${count} tài liệu sẽ trở thành chưa phân loại (tài liệu vẫn còn).`
              : `Xoá nhãn "${name}"?`,
          )
        }
      >
        ×
      </button>
      {error && <span className="adminErrorText" role="alert">{error}</span>}
    </span>
  );
}
