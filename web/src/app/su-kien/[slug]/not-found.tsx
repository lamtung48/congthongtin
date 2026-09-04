import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NotFoundState } from "@/components/ui/NotFoundState";

export default function EventNotFound() {
  return (
    <>
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Sự kiện" }, { label: "Không tìm thấy" }]} />
      <NotFoundState
        title="Không tìm thấy sự kiện"
        description="Sự kiện này không tồn tại, đã kết thúc và bị gỡ khỏi hệ thống, hoặc đường dẫn không đúng."
        actionLabel="Về trang chủ"
        actionHref="/"
      />
    </>
  );
}
