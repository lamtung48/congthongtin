"use client";

import { useActionState } from "react";
import { createDraftAction, type CreateDraftFormState } from "./actions";

const initialState: CreateDraftFormState = {};

export function NewArticleForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createDraftAction, initialState);

  return (
    <form action={action} className="adminCard adminCardPad" style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="title">Tiêu đề bài viết</label>
        <input id="title" name="title" type="text" required autoFocus className="adminInput" disabled={pending} />
      </div>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="categoryId">Chuyên mục</label>
        <select id="categoryId" name="categoryId" required className="adminSelect" disabled={pending}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <p className="adminHint">Các trường còn lại (sapo, chủ đề, tag, tác giả, đơn vị, địa phương, ảnh cover, nội dung, SEO) sẽ được điền ở bước tiếp theo.</p>
      <button type="submit" className="adminButton adminButtonPrimary" disabled={pending}>
        {pending ? "Đang tạo…" : "Tạo bản nháp và tiếp tục"}
      </button>
      {state.error && <p className="adminErrorText" role="alert">{state.error}</p>}
    </form>
  );
}
