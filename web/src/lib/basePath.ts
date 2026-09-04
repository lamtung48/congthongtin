/**
 * `next/link`/`next/image`/the router apply `basePath` automatically; a raw
 * `fetch()` of a `public/` file does not. The two places that fetch a public
 * JSON file directly (the activity map's data and its world-geometry file)
 * use this instead of a bare absolute path — see `next.config.ts`.
 */
export function withBasePath(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}
