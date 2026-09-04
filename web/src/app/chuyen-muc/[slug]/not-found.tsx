import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NotFoundState } from "@/components/ui/NotFoundState";

export default function CategoryNotFound() {
  return (
    <>
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Tin tức", href: "/tin-tuc" }, { label: "Không tìm thấy" }]} />
      <NotFoundState
        title="Không tìm thấy chuyên mục"
        description="Chuyên mục này không tồn tại hoặc đường dẫn không đúng."
        actionLabel="Xem tất cả tin tức"
        actionHref="/tin-tuc"
      />
    </>
  );
}
