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
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const basePath = isGithubActions && repoName ? `/${repoName}` : "";

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
  },
};

export default nextConfig;
