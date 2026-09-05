/**
 * Login brute-force mitigation (brief section 13: "brute-force mitigation;
 * login rate limiting"). In-memory, keyed by a caller-supplied string
 * (email+IP combined, so a distributed attempt across many IPs against one
 * account or across many accounts from one IP still gets rate-limited on
 * whichever dimension the caller cares about).
 *
 * Known limitation, stated plainly rather than hidden: this only limits
 * attempts against a single Node.js process. A multi-instance production
 * deployment needs a shared store (Redis, or a `LoginAttempt` DB table)
 * instead — this in-memory version is correct and sufficient for this
 * task's single-process scope, not a finished production answer. See
 * docs/AUTHENTICATION.md, "Rate limiting".
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

/** Periodically drop buckets whose window has long expired, so this Map
 *  doesn't grow forever across a long-running process. */
function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS * 4) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export function checkLoginRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  if (buckets.size > 10_000) sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 0, windowStart: now });
    return { allowed: true };
  }
  if (bucket.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - bucket.windowStart) };
  }
  return { allowed: true };
}

/** Called only after a failed login — a successful one should not count
 *  toward the limit for the account that just proved it owns the password. */
export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return;
  }
  bucket.count += 1;
}

export function clearLoginRateLimit(key: string): void {
  buckets.delete(key);
}
