import type { Metadata } from "next";
import { Be_Vietnam_Pro, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/home/Header";
import { Footer } from "@/components/home/Footer";
import { getHomepage } from "@/services/homepageService";
import { organizationJsonLd } from "@/lib/structuredData";
import { SITE_DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/siteConfig";

// Weights/styles trimmed to exactly what the CSS uses — verified by
// grepping every `font-weight`/`font-style` declaration in the codebase
// (see docs/PERFORMANCE.md, "font loading"): only 400 (the unstyled
// default), 500 (--fw-medium), and 600 (--fw-semibold) ever appear;
// --fw-light/--fw-bold/--fw-extrabold (300/700/800) are declared as tokens
// but never applied anywhere. next/font/google fetches one font file per
// weight+style combination, so each unused one removed here is one real
// file this app no longer downloads. Newsreader keeps italic — the
// article pull-quote (`ArticleBody.module.css` `.quoteText`) is the one
// place `font-style: italic` is actually used, and it's on this family.
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  // Kept as a Next.js safety net (some internal resolution paths expect it),
  // but every page's own canonical/OpenGraph/image URL is built explicitly
  // via `absoluteUrl()` (`src/lib/siteConfig.ts`) rather than relying on
  // this to resolve a relative path — see that file for why.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cổng thông tin số — Hội Sinh viên Việt Nam",
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DEFAULT_DESCRIPTION,
};

/**
 * Header and Footer render here — once — so every route under `app/` gets
 * the same chrome without each page duplicating it (see `docs/ROUTES.md`,
 * "Không duplicate layout"). `page.tsx` (the homepage) renders only its own
 * 13 sections; every other route renders only its own content as `children`.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const homepage = await getHomepage();
  const orgJsonLd = organizationJsonLd(homepage.footer);

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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      </body>
    </html>
  );
}
