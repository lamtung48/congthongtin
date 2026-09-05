import type { PlatformCategory, PlatformStatus } from "@/generated/prisma/client";

/**
 * Ecosystem integration task, brief section 5: the contract every
 * category-specific adapter implements. Nothing outside this directory
 * calls `fetch()` against an external platform's API — `platformService.ts`
 * only ever calls `fetchActivity()` and handles the result generically,
 * exactly the "không nhồi business logic vào UI" separation the brief asks
 * for, one layer further in: the *service* layer doesn't know what shape
 * any given platform's real API returns either, only this adapter does.
 */
export interface PlatformActivitySuccess {
  ok: true;
  /** Rendered straight into `Platform.currentActivity` — already in
   *  Vietnamese, ready to display, not raw API data. */
  currentActivity: string;
  /** An adapter may optionally report a live status derived from its own
   *  API response (e.g. a conference API saying a session is live right
   *  now) — omitted when the adapter has no opinion, in which case
   *  `Platform.status` is left exactly as an editor last set it. */
  status?: PlatformStatus;
}

/**
 * Brief section 6: "External platform chết: Portal vẫn hoạt động... Có:
 * timeout; fallback; cached/default state." Every failure mode collapses to
 * this one shape — `platformService.refreshActivity` never throws past an
 * adapter call, and a failure here always means "the platform's last known
 * `currentActivity` stays exactly as it was," never "the request that
 * triggered this crashes."
 */
export interface PlatformActivityFailure {
  ok: false;
  reason: "not_configured" | "timeout" | "network_error" | "invalid_response";
  message: string;
}

export type PlatformActivityResult = PlatformActivitySuccess | PlatformActivityFailure;

export interface PlatformAdapter {
  readonly category: PlatformCategory;
  /** `apiBaseUrl` is passed in (not read from the DB by the adapter itself)
   *  so this stays a pure function of its input — easy to unit test with a
   *  mocked `fetch`, no Prisma import needed in this directory at all. */
  fetchActivity(input: { apiBaseUrl: string | null }): Promise<PlatformActivityResult>;
}
