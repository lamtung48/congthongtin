import type { SearchResultType } from "@/domain/search";

/** Shared between `SearchResultRow`, the search overlay, and `/tim-kiem` —
 *  one label per `SearchResultType`, not duplicated per surface. */
export const SEARCH_RESULT_TYPE_LABEL: Record<SearchResultType, string> = {
  article: "Bài viết",
  category: "Chuyên mục",
  topic: "Chủ đề",
  organization: "Đơn vị",
  province: "Địa phương",
  event: "Sự kiện",
};
