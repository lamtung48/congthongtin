import type { SearchResultItem } from "@/domain/search";
import { withBasePath } from "@/lib/basePath";

/**
 * The one client-side entry point for search — used by both `SearchOverlay`
 * and `SearchPageClient`. A `fetch` to `/api/search`, not
 * `getContentProvider().searchContent()` directly: `DatabaseProvider` calls
 * Prisma, which cannot run in a browser at all (see `/api/search/route.ts`'s
 * own header comment). `FixtureProvider`'s `searchContent()` could be called
 * client-side safely (pure in-memory array logic), but nothing here needs
 * to know or care which provider is actually active — that's the whole
 * point of going through an HTTP boundary instead.
 */
export async function fetchSearchResults(query: string, limit?: number): Promise<SearchResultItem[]> {
  const params = new URLSearchParams({ q: query });
  if (limit !== undefined) params.set("limit", String(limit));
  const res = await fetch(withBasePath(`/api/search?${params.toString()}`));
  if (!res.ok) throw new Error(`search fetch failed: ${res.status}`);
  return (await res.json()) as SearchResultItem[];
}
