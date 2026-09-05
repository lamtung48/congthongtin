import { NextResponse } from "next/server";
import { getActivityMap } from "@/services/homepageService";

/**
 * Public, unauthenticated — the Activity Map dataset is public content,
 * same as everything else `/` renders. Exists solely because
 * `useActivityMapData.ts` (the map's data hook) is a Client Component:
 * before this task, `getActivityMap()` ran client-side against
 * `FixtureProvider`, which is safe there because it only ever does a
 * relative `fetch()` of a static JSON file. `DatabaseProvider.getActivityMap()`
 * calls Prisma, which cannot run in a browser at all — so the hook now
 * fetches this Route Handler instead of calling the service function
 * directly, and this handler is the one place server-side code (Prisma
 * included) actually runs. See docs/PRODUCTION_DATA.md.
 */
export const revalidate = 300;

export async function GET() {
  const data = await getActivityMap();
  return NextResponse.json(data);
}
