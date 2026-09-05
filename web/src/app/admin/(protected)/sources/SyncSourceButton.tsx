"use client";

import { useActionState } from "react";
import { syncSourceAction, type SyncSourceFormState } from "./actions";

const initialState: SyncSourceFormState = {};

/** Brief section 4-7/10: triggers `sourceService.sync()` — the one place
 *  in this feature that calls out to a real external API/feed — and
 *  shows exactly what it reports (item counts, or a clear
 *  token/quota/network/invalid-source failure) right next to the button.
 *  No auto-sync anywhere; this is always an explicit Admin click. */
export function SyncSourceButton({ sourceId }: { sourceId: string }) {
  const [state, action, pending] = useActionState(syncSourceAction, initialState);

  return (
    <form action={action} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <input type="hidden" name="sourceId" value={sourceId} />
      <button type="submit" className="adminButton adminButtonSmall" disabled={pending}>
        {pending ? "Đang đồng bộ…" : "Đồng bộ ngay"}
      </button>
      {state.message && (
        <span className={state.ok ? "adminHint" : "adminErrorText"} style={{ fontSize: 11.5 }}>
          {state.message}
        </span>
      )}
    </form>
  );
}
