import type { NextConfig } from "next";

/**
 * `output: "export"` was removed in the authentication/authorization task
 * (see docs/BACKEND_ARCHITECTURE.md, "What this task does not wire up" for
 * why this was flagged as a deferred decision, and docs/AUTHENTICATION.md
 * for the actual trigger). Next.js's own static-export docs
 * (`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`,
 * "Unsupported Features") list Cookies and Server Actions as incompatible
 * with `output: "export"` — not just at build time, but even under
 * `next dev` — and `/admin/login` needs both. A Next.js build cannot mix
 * static export for some routes with a real server for others; the whole
 * app needs one mode or the other. GitHub Pages (a static-file host) can no
 * longer serve this app as of this change — see docs/DEPLOYMENT.md for what
 * that means for hosting going forward.
 *
 * `basePath`/`NEXT_PUBLIC_SITE_URL` remain env-driven rather than
 * GitHub-Actions-derived, in case the eventual host still serves this app
 * from a non-root path — set `NEXT_PUBLIC_BASE_PATH`/`NEXT_PUBLIC_SITE_URL`
 * explicitly if so. Local `npm run dev`/`npm run build` are unaffected
 * either way (both default to no base path, `http://localhost:3000`).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Production readiness task, brief section 8: security headers on every
 * response. Set here via `headers()` rather than a `proxy.ts` (this Next.js
 * version's renamed `middleware.ts` — see `node_modules/next/dist/docs/
 * 01-app/03-api-reference/03-file-conventions/proxy.md`) deliberately: a
 * nonce-based CSP requires *every* page to opt into dynamic rendering
 * (Next's own CSP guide, "Dynamic Rendering Requirement"), which would
 * break every statically-generated/ISR public route this app already
 * relies on (`generateStaticParams`, `revalidate: 60`). `headers()` applies
 * to static and dynamic responses alike with no such tradeoff, and the
 * proxy file-convention doc itself recommends avoiding Proxy "unless no
 * other options exist" — this app has one: no page renders an inline
 * `<script>` (checked: no `next/script` usage, and the only
 * `dangerouslySetInnerHTML` sites are `type="application/ld+json"` tags,
 * which CSP's `script-src` doesn't gate since they never execute), so a
 * static, non-nonce CSP is both sufficient and simpler.
 *
 * `style-src` keeps `'unsafe-inline'` because the codebase uses React's
 * `style={{...}}` prop widely (60+ sites) — rewriting all of them to CSS
 * Modules solely to drop this one keyword is out of this task's scope and
 * a real regression risk for no proportional security gain (inline
 * *styles* can't execute script; the attacks CSP's `style-src` mainly
 * guards against — CSS-based data exfiltration via attribute selectors —
 * don't apply to a same-origin admin CMS with no user-controlled CSS
 * input). `script-src`/`object-src`/`base-uri` stay strict with no
 * exceptions since nothing in the app needs them relaxed.
 *
 * `img-src` allows `img.youtube.com` (video thumbnails, `resolveMedia.ts`)
 * — every *uploaded* image is proxied through this app's own
 * `/api/media/[mediaId]` route (`docs/GOOGLE_DRIVE_MEDIA.md`), so Google
 * Drive's own domains never need to appear in the browser at all, and
 * `next/font/google` self-hosts font files at build time (no runtime
 * request to `fonts.gstatic.com`), so `font-src 'self'` is enough too.
 * `frame-src` allows only `www.youtube-nocookie.com` (the one iframe
 * source in the app, `resolveMedia.ts`'s embed URL); `frame-ancestors
 * 'none'` + `X-Frame-Options: DENY` below cover brief section 8's "frame
 * policy phù hợp" — this site is never meant to be embedded in anyone
 * else's page.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://img.youtube.com",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // 2 years + preload — this domain is admin-cookie-bearing (see
  // `docs/AUTHENTICATION.md`), so once HTTPS is live it should never be
  // reachable over plain HTTP again, in this browser or any other that has
  // ever loaded it. Harmless if the browser received it over plain HTTP
  // during local dev — HSTS is only ever honored over a real TLS
  // connection in the first place.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  experimental: {
    // Enables `forbidden()`/`unauthorized()` from `next/navigation` — the
    // documented, purpose-built way to render a real 403/401 from a Server
    // Component/Server Action (`docs/AUTHORIZATION.md`, "Route guard").
    // Still marked experimental by Next.js itself; scoped narrowly to just
    // this flag rather than a broader experimental opt-in.
    authInterrupts: true,
  },
  images: {
    // No image loader/CDN has been chosen for the new (not-yet-decided)
    // host — see docs/DEPLOYMENT.md. Unoptimized `next/image` still works
    // correctly on a real server, just without on-the-fly resizing;
    // revisiting this is independent of the auth work in this task.
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
