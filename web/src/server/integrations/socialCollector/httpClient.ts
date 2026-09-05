import "server-only";

/** Every fetcher here talks to a real external endpoint that can be slow
 *  or entirely unreachable — brief section 10: "network" is one of the
 *  four failure kinds every source type must surface clearly. 8s (vs. the
 *  platform adapters' 5s) because a sync fetches a page of *several*
 *  posts, not one small status endpoint. */
const DEFAULT_TIMEOUT_MS = 8000;

export type FetchOutcome =
  | { kind: "success"; ok: boolean; status: number; text: string }
  | { kind: "timeout" }
  | { kind: "network_error"; message: string };

/**
 * Returns the raw response body even on a non-2xx status — unlike
 * `platformAdapters/httpJson.ts`'s `fetchJsonWithTimeout`, which discards
 * the body on failure. That's the wrong contract here: Meta's Graph API
 * and the YouTube Data API both return a structured JSON error body
 * (`{error: {code, message}}`) on 4xx that each fetcher needs to inspect
 * to tell "token expired" apart from "quota exceeded" apart from a plain
 * invalid request — collapsing that to a boolean before it reaches the
 * fetcher would throw away exactly the brief section 10 distinction this
 * task needs to make.
 */
export async function fetchRaw(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<FetchOutcome> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json, application/rss+xml, application/atom+xml, application/xml, text/html" },
    });
    const text = await res.text();
    return { kind: "success", ok: res.ok, status: res.status, text };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { kind: "timeout" };
    }
    return { kind: "network_error", message: err instanceof Error ? err.message : "Lỗi kết nối không xác định." };
  }
}
