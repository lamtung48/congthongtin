import { Be_Vietnam_Pro, Newsreader, JetBrains_Mono } from "next/font/google";
import "@/app/(site)/globals.css";

/**
 * A second, standalone root layout — same "multiple root layouts" pattern
 * `docs/DEPLOYMENT.md`/`docs/AUTHORIZATION.md` already use to give `/admin`
 * its own `<html>` separate from the public site's. This one exists for
 * exactly one reason: `ArticleDetailView` (the CMS preview's renderer,
 * shared with the real `/tin-tuc/[slug]` page — see
 * `(preview)/preview/articles/[id]/page.tsx`) needs the public site's CSS
 * custom properties and font variables to render correctly, and `/admin`'s
 * own root layout (`admin/layout.tsx`) deliberately does NOT load those —
 * it has its own separate stylesheet with no shared vocabulary (brief:
 * "không dùng cinematic motion của public website"). Reusing `(site)`'s
 * `globals.css` here — rather than copying its ~100 custom properties into
 * a second file that would silently drift out of sync — is the one global
 * stylesheet import outside `(site)/layout.tsx` in this codebase, and it's
 * safe specifically because this is a distinct root layout: importing it
 * inside `/admin`'s existing layout instead would leak its rules onto
 * every admin page sharing that `<html>`.
 */
const beVietnamPro = Be_Vietnam_Pro({ variable: "--font-be-vietnam-pro", subsets: ["latin", "vietnamese"], weight: ["400", "500", "600"], display: "swap" });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin", "vietnamese"], weight: ["400", "500", "600"], style: ["normal", "italic"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin", "vietnamese"], weight: ["400", "500", "600"], display: "swap" });

export default function PreviewRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}>
      <body style={{ background: "var(--surface-page)" }}>{children}</body>
    </html>
  );
}
