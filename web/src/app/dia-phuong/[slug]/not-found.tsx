import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NotFoundState } from "@/components/ui/NotFoundState";

export default function LocalityNotFound() {
  return (
    <>
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Địa phương" }, { label: "Không tìm thấy" }]} />
      <NotFoundState
        title="Không tìm thấy địa phương"
        description="Địa phương này không có trong dữ liệu hiện có, hoặc đường dẫn không đúng."
        actionLabel="Về trang chủ"
        actionHref="/"
      />
    </>
  );
}
