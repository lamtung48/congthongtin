import { NotFoundState } from "@/components/ui/NotFoundState";

/** Catch-all for any URL that doesn't match a route at all (as opposed to a
 *  valid route whose `[slug]` lookup failed — those render their own
 *  section-specific `not-found.tsx`, see `docs/ROUTES.md`). No breadcrumb
 *  here since there's no known section to place it under. */
export default function GlobalNotFound() {
  return (
    <NotFoundState
      title="Không tìm thấy trang"
      description="Trang bạn tìm không tồn tại, đã bị gỡ, hoặc đường dẫn không đúng."
    />
  );
}
