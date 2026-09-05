"use client";

import { useActionState, useRef, useEffect } from "react";
import { createTagAction, type CreateTagFormState } from "./actions";

const initialState: CreateTagFormState = {};

export function CreateTagForm() {
  const [state, action, pending] = useActionState(createTagAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) formRef.current?.reset();
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={action} className="adminCard adminCardPad" style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "2fr auto", gap: 12, alignItems: "end" }}>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-tag-name">Tên tag mới</label>
        <input id="new-tag-name" name="name" type="text" required className="adminInput" disabled={pending} />
      </div>
      <button type="submit" className="adminButton adminButtonPrimary" disabled={pending}>
        {pending ? "Đang tạo…" : "Thêm tag"}
      </button>
      {state.error && (
        <p className="adminErrorText" role="alert" style={{ gridColumn: "1 / -1", margin: 0 }}>{state.error}</p>
      )}
    </form>
  );
}
