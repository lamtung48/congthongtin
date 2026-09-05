import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NotFoundState } from "@/components/ui/NotFoundState";

export default function TopicNotFound() {
  return (
    <>
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Chủ đề" }, { label: "Không tìm thấy" }]} />
      <NotFoundState
        title="Không tìm thấy chủ đề"
        description="Chủ đề này không tồn tại hoặc đường dẫn không đúng."
        actionLabel="Xem tất cả tin tức"
        actionHref="/tin-tuc"
      />
    </>
  );
}
