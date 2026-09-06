/**
 * Generic in-memory rate limiter. Production readiness task, brief section
 * 9: "/admin/login" already has its own limiter
 * (`src/server/auth/rateLimit.ts`, untouched — `authService.ts` imports it
 * by name); this module gives every *other* priority the brief names —
 * "sensitive admin API; upload init; external integration endpoint" — its
 * own independent bucket space without duplicating the window/sweep
 * bookkeeping four more times.
 *
 * Same known limitation as the login limiter, stated the same way rather
 * than hidden: in-memory, per-process only. Correct for this app's actual
 * topology (brief section 1: one reverse proxy in front of one Next.js
 * process on one VPS — "Redis chỉ nếu thực sự cần", and nothing here needs
 * it yet); a horizontally-scaled deployment would need a shared store
 * instead. See docs/SECURITY.md, "Rate limiting".
 */

interface Bucket {
  count: number;
  windowStart: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export interface RateLimiter {
  /** Read-only: does NOT count as an attempt. Callers that want every check
   *  to count should call `record()` themselves right after. */
  check(key: string): RateLimitResult;
  record(key: string): void;
  clear(key: string): void;
}

export function createRateLimiter(windowMs: number, maxAttempts: number): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function sweep(now: number) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart > windowMs * 4) buckets.delete(key);
    }
  }

  return {
    check(key) {
      const now = Date.now();
      if (buckets.size > 10_000) sweep(now);
      const bucket = buckets.get(key);
      if (!bucket || now - bucket.windowStart > windowMs) return { allowed: true };
      if (bucket.count >= maxAttempts) return { allowed: false, retryAfterMs: windowMs - (now - bucket.windowStart) };
      return { allowed: true };
    },
    record(key) {
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket || now - bucket.windowStart > windowMs) {
        buckets.set(key, { count: 1, windowStart: now });
        return;
      }
      bucket.count += 1;
    },
    clear(key) {
      buckets.delete(key);
    },
  };
}

/**
 * Brief section 9's remaining named priorities. All keyed by the acting
 * user's id (every call site below is already behind `requireSession`/
 * `requirePermission`) — generous enough for real admin/CMS work in one
 * sitting, tight enough to blunt a scripted loop or a compromised session
 * hammering the same endpoint. Each `record()` call counts the attempt
 * itself, not just failures — unlike login, there's no "don't penalize a
 * correct password" case here, every call is the sensitive operation.
 */
export const uploadRateLimiter = createRateLimiter(10 * 60 * 1000, 30); // media/video upload init
export const sensitiveAdminActionRateLimiter = createRateLimiter(5 * 60 * 1000, 30); // user create/changeRole/setStatus/resetPassword
export const externalIntegrationRateLimiter = createRateLimiter(5 * 60 * 1000, 10); // source sync, YouTube OAuth callback
