"use client";

import { useActionState } from "react";
import { refreshActivityAction, type RefreshActivityFormState } from "./actions";

const initialState: RefreshActivityFormState = {};

/**
 * Brief section 5/6: triggers `platformService.refreshActivity` — the one
 * place in this whole app that calls out to an external platform's API —
 * and shows whatever it reports (success or a timeout/network/invalid-
 * response failure) right next to the button. A failure here never blocks
 * anything else on the page; the platform's last-known `currentActivity`
 * stays exactly as it was (see `platformService.ts`'s own comment).
 */
export function RefreshActivityButton({ platformId }: { platformId: string }) {
  const [state, action, pending] = useActionState(refreshActivityAction, initialState);

  return (
    <form action={action} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <input type="hidden" name="platformId" value={platformId} />
      <button type="submit" className="adminButton adminButtonSmall" disabled={pending}>
        {pending ? "Đang làm mới…" : "Làm mới trạng thái"}
      </button>
      {state.message && (
        <span className={state.ok ? "adminHint" : "adminErrorText"} style={{ fontSize: 11.5 }}>
          {state.message}
        </span>
      )}
    </form>
  );
}
