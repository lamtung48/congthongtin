/**
 * The one place that knows the site's real, public URL — every canonical
 * link, Open Graph URL, sitemap entry, and JSON-LD `url`/`image` field goes
 * through `absoluteUrl()` here instead of a hand-built string. See
 * `docs/SEO.md`.
 *
 * `NEXT_PUBLIC_SITE_URL` is computed once, in `next.config.ts`, the same
 * place `NEXT_PUBLIC_BASE_PATH` already is — GitHub Pages serves this app
 * from `https://<owner>.github.io/<repo>`, not a domain root (see
 * `docs/DEPLOYMENT.md`), so the site's "origin" already includes the repo
 * path segment. That's why `absoluteUrl()` does plain string concatenation
 * rather than `new URL(path, SITE_URL)`: a path starting with "/" resolved
 * against a base URL that itself has a path (`.../repo`) replaces that path
 * entirely per the URL spec, silently dropping the repo segment. Local dev
 * (`npm run dev`/`npm run build` outside CI) falls back to
 * `http://localhost:3000`, which has no path segment either way.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_NAME = "Cổng thông tin số Hội Sinh viên Việt Nam";

export const SITE_LOCALE = "vi_VN";

export const SITE_DEFAULT_DESCRIPTION =
  "Tin tức, phong trào, Sinh viên 5 tốt, hoạt động sinh viên toàn quốc và hệ sinh thái nền tảng số của Hội Sinh viên Việt Nam.";

/** `path` must start with "/" (or be exactly "/" for the homepage) — every
 *  route helper in `lib/routes.ts` already returns paths in that shape. */
export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

/** Media URLs come from two places: a resolved `MediaAsset` (already an
 *  absolute CDN/Drive/YouTube URL once real resolution is wired — see
 *  `docs/MEDIA_ARCHITECTURE.md`) or a `public/` asset referenced by a
 *  site-relative path (the logo). Passing an already-absolute URL through
 *  unchanged means this is safe to use for both without a caller having to
 *  know which kind it has. */
export function absoluteAssetUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : absoluteUrl(url);
}

/**
 * The only real, public social-share image today — see `docs/SEO.md` for
 * why (no CMS-provided article images resolve yet, `resolveImageUrl()`
 * intentionally always returns `undefined`, `docs/MEDIA_ARCHITECTURE.md`).
 * Real square logo, not a designed 1200×630 OG banner: honest about what
 * exists rather than fabricating one. `pageMetadata()` falls back to this
 * only when a page has no image of its own.
 */
export const DEFAULT_OG_IMAGE = {
  url: absoluteUrl("/images/hsv-logo.png"),
  width: 1000,
  height: 1000,
  alt: SITE_NAME,
};
