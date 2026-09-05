"use client";

import { useActionState, useRef, useEffect } from "react";
import { createTopicAction, type CreateTopicFormState } from "./actions";

const initialState: CreateTopicFormState = {};

export function CreateTopicForm() {
  const [state, action, pending] = useActionState(createTopicAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) formRef.current?.reset();
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={action} className="adminCard adminCardPad" style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "2fr 3fr auto", gap: 12, alignItems: "end" }}>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-topic-name">Tên chủ đề mới</label>
        <input id="new-topic-name" name="name" type="text" required className="adminInput" disabled={pending} />
      </div>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-topic-description">Mô tả (tuỳ chọn)</label>
        <input id="new-topic-description" name="description" type="text" className="adminInput" disabled={pending} />
      </div>
      <button type="submit" className="adminButton adminButtonPrimary" disabled={pending}>
        {pending ? "Đang tạo…" : "Thêm chủ đề"}
      </button>
      {state.error && (
        <p className="adminErrorText" role="alert" style={{ gridColumn: "1 / -1", margin: 0 }}>{state.error}</p>
      )}
    </form>
  );
}
