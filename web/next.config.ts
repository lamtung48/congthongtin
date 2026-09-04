import type { NextConfig } from "next";

/**
 * GitHub Pages serves this app from `https://<user>.github.io/<repo>/`, not
 * from the domain root — so every asset/route needs a `/<repo>` prefix. Only
 * `next/link`, `next/image`, and the router apply `basePath` automatically;
 * anything that builds a path by hand (see `src/lib/basePath.ts`) has to add
 * it explicitly. `GITHUB_REPOSITORY` is set automatically by GitHub Actions
 * (`owner/repo`) — this only activates the prefix in CI, so local
 * `npm run dev`/`npm run build` are unaffected.
 */
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const [repoOwner, repoName] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
const basePath = isGithubActions && repoName ? `/${repoName}` : "";
/**
 * The site's real public URL, computed once here (see `src/lib/siteConfig.ts`
 * for why every canonical/OG/sitemap URL goes through this instead of a
 * hand-built string). `NEXT_PUBLIC_SITE_URL` set in the environment always
 * wins — the escape hatch for a future custom domain (a GitHub Pages CNAME),
 * where the derived `github.io/<repo>` URL would be wrong. Otherwise it's
 * derived from `GITHUB_REPOSITORY` in CI, the same source `basePath` already
 * uses; outside CI (local dev) it's `localhost`, which has no path segment.
 */
const inferredSiteUrl = isGithubActions && repoOwner && repoName ? `https://${repoOwner}.github.io/${repoName}` : undefined;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? inferredSiteUrl ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  // Static export: GitHub Pages only serves static files, no Node.js server —
  // see docs/DEPLOYMENT.md for what this trades away (per-request rendering,
  // the section-specific not-found pages, live data).
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: {
    // The Image Optimization API needs a server; static export has none.
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
};

export default nextConfig;
