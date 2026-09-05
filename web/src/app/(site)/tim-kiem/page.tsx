import { Suspense } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { searchHref } from "@/lib/routes";
import { SearchPageClient } from "./SearchPageClient";

// Static export can't read `searchParams` server-side (see
// `docs/DEPLOYMENT.md`), so this metadata is no longer query-aware — the
// `<title>` is always "Tìm kiếm" even when `?q=` is present.
export const metadata: Metadata = pageMetadata({
  title: "Tìm kiếm",
  description: "Tìm kiếm tin tức trên Cổng thông tin số Hội Sinh viên Việt Nam.",
  path: searchHref(),
  noIndex: true,
});

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageClient />
    </Suspense>
  );
}
