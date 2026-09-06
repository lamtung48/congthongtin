/**
 * Production readiness task, brief section 7: "Không log password, session
 * token, OAuth token, Google credential, YouTube credential." A raw
 * `gaxios`/`googleapis` error object can carry the outgoing request's own
 * config on `.config`/`.response.config` — including its `Authorization`
 * header (a Google service-account JWT, or a YouTube OAuth bearer token) —
 * so `console.error("...", err)` on one of those objects can print a live
 * credential straight into stdout/PM2/journald logs. `describeDriveError`/
 * `describeYoutubeError` (`googleDrive.ts`/`youtube.ts`) already never
 * *return* that detail to a caller; this is the matching guarantee for what
 * they log server-side.
 *
 * `summarizeErrorForLog` extracts only `message`/`stack`/an HTTP status if
 * present — never `.config`, `.response`, or any other property that might
 * hold headers/credentials — and additionally redacts any
 * Authorization-header-shaped or bare-token-shaped substring left in the
 * message/stack themselves, as defense in depth against a future error
 * whose *message* (not just its structured fields) happens to embed one.
 */

const REDACT_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /"?access_token"?\s*[:=]\s*"?[A-Za-z0-9._~+/-]{10,}=*"?/gi,
  /"?refresh_token"?\s*[:=]\s*"?[A-Za-z0-9._~+/-]{10,}=*"?/gi,
  /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g,
];

function redact(text: string): string {
  let result = text;
  for (const pattern of REDACT_PATTERNS) {
    result = result.replace(pattern, "[redacted]");
  }
  return result;
}

export interface SafeErrorSummary {
  message: string;
  status?: number | string;
  stack?: string;
}

/** Never pass the return value of this function anywhere except a
 *  server-side log line — it's for humans debugging via `journalctl`/PM2
 *  logs, not for a response body. */
export function summarizeErrorForLog(err: unknown): SafeErrorSummary {
  if (!(err instanceof Error)) {
    return { message: redact(String(err)) };
  }
  // `gaxios`'s `GaxiosError` puts the HTTP status on `.status` or
  // `.response.status` depending on version — read both defensively
  // without touching `.config`/`.response` themselves.
  const maybeStatus = (err as { status?: number | string; response?: { status?: number | string } }).status ?? (err as { response?: { status?: number | string } }).response?.status;
  return {
    message: redact(err.message),
    status: maybeStatus,
    stack: err.stack ? redact(err.stack) : undefined,
  };
}
