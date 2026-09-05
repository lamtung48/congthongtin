import { NextResponse } from "next/server";
import { searchContent } from "@/services/contentService";

/**
 * Public, unauthenticated — search results are drawn entirely from public
 * content (`DatabaseProvider.searchContent()`'s own index already excludes
 * anything non-public). Exists for the same reason `/api/activity-map`
 * does: `SearchOverlay.tsx`/`SearchPageClient.tsx` are Client Components
 * that used to call `searchContent()` directly, safe only because
 * `FixtureProvider` never touches Prisma. See docs/PRODUCTION_DATA.md.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  const results = await searchContent(query, limit);
  return NextResponse.json(results);
}
