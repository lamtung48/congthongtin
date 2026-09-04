import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NotFoundState } from "@/components/ui/NotFoundState";

export default function ArticleNotFound() {
  return (
    <>
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Tin tức", href: "/tin-tuc" }, { label: "Không tìm thấy" }]} />
      <NotFoundState
        title="Không tìm thấy bài viết"
        description="Bài viết này không tồn tại, đã bị gỡ, hoặc đường dẫn không đúng. Bạn có thể quay lại trang tin tức để xem các bài viết khác."
        actionLabel="Xem tất cả tin tức"
        actionHref="/tin-tuc"
      />
    </>
  );
}
