"use client";

import { useActionState, useRef, useEffect } from "react";
import { createArticleAction, type CreateArticleFormState } from "./actions";

const initialState: CreateArticleFormState = {};

export function CreateArticleForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createArticleAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) formRef.current?.reset();
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={action} className="adminCard adminCardPad" style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "2fr 1fr 2fr auto", gap: 12, alignItems: "end" }}>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-article-title">Tiêu đề bài viết mới</label>
        <input id="new-article-title" name="title" type="text" required className="adminInput" disabled={pending} />
      </div>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-article-category">Chuyên mục</label>
        <select id="new-article-category" name="categoryId" required className="adminSelect" disabled={pending}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-article-excerpt">Tóm tắt (tuỳ chọn)</label>
        <input id="new-article-excerpt" name="excerpt" type="text" className="adminInput" disabled={pending} />
      </div>
      <button type="submit" className="adminButton adminButtonPrimary" disabled={pending}>
        {pending ? "Đang tạo…" : "Tạo bản nháp"}
      </button>
      {state.error && (
        <p className="adminErrorText" role="alert" style={{ gridColumn: "1 / -1", margin: 0 }}>{state.error}</p>
      )}
    </form>
  );
}
