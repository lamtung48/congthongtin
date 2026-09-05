import "server-only";

/** Every real external platform this task integrates with is assumed slow
 *  or entirely unreachable at some point — brief section 6: "Có: timeout."
 *  5s is generous enough for a normal JSON status endpoint while still
 *  keeping an Admin's "Làm mới trạng thái" click from hanging indefinitely
 *  on a dead system. */
const DEFAULT_TIMEOUT_MS = 5000;

export type HttpJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: "timeout" | "network_error" | "invalid_response"; message: string };

/**
 * The one place any platform adapter actually calls `fetch()` — every
 * adapter's own parser (`conferenceAdapter.ts`, etc.) builds on top of this
 * instead of handling timeouts/network errors itself, so the failure
 * taxonomy (`PlatformActivityFailure.reason`) stays identical across every
 * category. Never throws.
 */
export async function fetchJsonWithTimeout(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<HttpJsonResult> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, reason: "network_error", message: `HTTP ${res.status} từ ${url}` };
    }
    const data = await res.json().catch(() => undefined);
    if (data === undefined) {
      return { ok: false, reason: "invalid_response", message: "Phản hồi không phải JSON hợp lệ." };
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { ok: false, reason: "timeout", message: `Không nhận được phản hồi sau ${timeoutMs}ms.` };
    }
    return { ok: false, reason: "network_error", message: err instanceof Error ? err.message : "Lỗi kết nối không xác định." };
  }
}
