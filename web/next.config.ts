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
};

export default nextConfig;
