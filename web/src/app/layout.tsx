import type { Metadata } from "next";
import { Be_Vietnam_Pro, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/home/Header";
import { Footer } from "@/components/home/Footer";
import { getHomepage } from "@/services/homepageService";
import { SITE_NAME } from "@/lib/seo";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Cổng thông tin số — Hội Sinh viên Việt Nam",
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Tin tức, phong trào, Sinh viên 5 tốt, hoạt động sinh viên toàn quốc và hệ sinh thái nền tảng số của Hội Sinh viên Việt Nam.",
};

/**
 * Header and Footer render here — once — so every route under `app/` gets
 * the same chrome without each page duplicating it (see `docs/ROUTES.md`,
 * "Không duplicate layout"). `page.tsx` (the homepage) renders only its own
 * 13 sections; every other route renders only its own content as `children`.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const homepage = await getHomepage();

  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <div style={{ background: "var(--surface-page)", minHeight: "100vh", overflowX: "hidden" }}>
          <Header nav={homepage.nav} searchTopics={homepage.trendingTopics} searchCorpus={homepage.search.corpus} />
          <main>{children}</main>
          <Footer footer={homepage.footer} />
        </div>
      </body>
    </html>
  );
}
