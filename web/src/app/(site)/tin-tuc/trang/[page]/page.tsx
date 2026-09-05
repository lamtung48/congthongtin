import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TinTucPageView, getTinTucPageCount } from "../../TinTucPageView";
import { pageMetadata } from "@/lib/seo";
import { pagedHref } from "@/lib/routes";
import { ensureNonEmptyParams, staticPageParams } from "@/lib/pagination";

interface Props {
  params: Promise<{ page: string }>;
}

export async function generateStaticParams() {
  const params = staticPageParams(await getTinTucPageCount());
  // Always non-empty today (36+ articles, 9/page ⇒ several pages), but
  // `output: "export"` requires at least one path per dynamic route even
  // if the pool ever shrinks to fit on one page — see `ensureNonEmptyParams`.
  return ensureNonEmptyParams(params, { page: "2" });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params;
  const pageNum = Number(page);
  return pageMetadata({
    title: `Tin tức — Trang ${pageNum}`,
    description: "Toàn bộ tin tức, phong trào và hoạt động của Hội Sinh viên Việt Nam.",
    path: pagedHref("/tin-tuc", pageNum),
  });
}

export default async function TinTucPagedPage({ params }: Props) {
  const { page } = await params;
  const pageNum = Number(page);
  // Page 1 lives at `/tin-tuc` itself — `/tin-tuc/trang/1` is not a second
  // canonical URL for the same content.
  if (!Number.isInteger(pageNum) || pageNum <= 1) notFound();
  return <TinTucPageView page={pageNum} />;
}
