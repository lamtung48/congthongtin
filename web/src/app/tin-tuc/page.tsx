import type { Metadata } from "next";
import { TinTucPageView } from "./TinTucPageView";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Tin tức",
  description: "Toàn bộ tin tức, phong trào và hoạt động của Hội Sinh viên Việt Nam.",
  path: "/tin-tuc",
});

export default async function TinTucPage() {
  return <TinTucPageView page={1} />;
}
