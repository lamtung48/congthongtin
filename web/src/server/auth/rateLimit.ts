import { createRateLimiter, type RateLimitResult } from "@/server/security/rateLimit";

/**
 * Login brute-force mitigation (brief section 13/9: "brute-force
 * mitigation; login rate limiting"). Keyed by a caller-supplied string
 * (email+IP combined, so a distributed attempt across many IPs against one
 * account or across many accounts from one IP still gets rate-limited on
 * whichever dimension the caller cares about) — see `authService.ts`.
 *
 * Built on the generic limiter in `src/server/security/rateLimit.ts` (kept
 * as its own module/exports, unchanged, so nothing else needs to change);
 * see that module's header comment for the shared in-memory/per-process
 * limitation.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const limiter = createRateLimiter(WINDOW_MS, MAX_ATTEMPTS);

export type { RateLimitResult };

export function checkLoginRateLimit(key: string): RateLimitResult {
  return limiter.check(key);
}

/** Called only after a failed login — a successful one should not count
 *  toward the limit for the account that just proved it owns the password. */
export function recordFailedLogin(key: string): void {
  limiter.record(key);
}

export function clearLoginRateLimit(key: string): void {
  limiter.clear(key);
}
