import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NotFoundState } from "@/components/ui/NotFoundState";

export default function UnitNotFound() {
  return (
    <>
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Đơn vị" }, { label: "Không tìm thấy" }]} />
      <NotFoundState
        title="Không tìm thấy đơn vị"
        description="Đơn vị này không có trong dữ liệu hiện có, hoặc đường dẫn không đúng."
        actionLabel="Về trang chủ"
        actionHref="/"
      />
    </>
  );
}
