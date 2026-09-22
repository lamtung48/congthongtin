import type { Topic } from "./taxonomy";
import type { Author } from "./people";
import type { MediaAsset } from "./media";
import type { SearchResultItem } from "./search";

export interface NavItem {
  label: string;
  href: string;
  soon?: boolean;
  /** Points to another site (e.g. the Hội nghị / Đào tạo platforms) —
   *  render as a plain `<a target="_blank">`, not a client-side `<Link>`. */
  external?: boolean;
}

/** 0–100, a percentage of the image's own width/height — mapped straight
 *  to CSS `object-position: <x>% <y>%` so the visual subject stays in frame
 *  at every crop. Never a single hard-coded value for all images. */
export interface HeroFocalPoint {
  x: number;
  y: number;
}

/** How heavily the directional gradient darkens the text side. `"medium"`
 *  is the default; the Hero bumps it toward `"strong"` on its own when a
 *  runtime contrast check finds the text-safe area too bright. */
export type HeroOverlayStrength = "soft" | "medium" | "strong";

/** Which end of the palette the copy is drawn in. `"dark"` = light text on
 *  a navy→transparent gradient (the default, editorial-newsroom look);
 *  `"light"` = dark text on a light scrim, for images that are mostly dark. */
export type HeroTheme = "light" | "dark";

/**
 * One slide of the homepage "Editorial Image Canvas" Hero. The image is a
 * full-bleed canvas; the copy lives inside its negative space. Up to four
 * of these render as a manually-advanced carousel (never auto-rotating).
 */
export interface HeroSlide {
  id: string;
  category: string;
  title: string;
  /** One phrase inside the title rendered in the accent colour — at most
   *  one per title. */
  titleAccent?: string;
  summary: string;
  ctaLabel: string;
  articleUrl: string;
  /** Desktop / full-bleed image. */
  media: MediaAsset;
  /** Optional portrait-friendly crop for the mobile stacked layout. When
   *  absent the desktop image is reused with `focalMobile`. */
  mobileMedia?: MediaAsset;
  alt: string;
  focalDesktop: HeroFocalPoint;
  focalMobile: HeroFocalPoint;
  overlay: HeroOverlayStrength;
  /** Which side the dark end of the horizontal gradient sits on (`"left"`
   *  by default). */
  overlaySide: "left" | "right";
  theme: HeroTheme;
  /** Desktop text-block placement — `x`/`w` are % of the container inner
   *  width, `y` is % of the Hero height (block top); `scale` multiplies the
   *  title size (also on mobile). Always resolved (editor override or the
   *  default `{ 0, 52, 47, 1 }`). */
  text: { x: number; y: number; w: number; scale: number };
  caption?: string;
  publishedAt: string;
  author?: string;
  readingTimeMinutes?: number;
}

export interface FooterLink {
  label: string;
  href?: string;
  /** External site — render as `<a target="_blank">` rather than `<Link>`. */
  external?: boolean;
}

export interface FooterColumn {
  title: string;
  items: FooterLink[];
}

/** An official account with a real address behind it. Was a bare `string[]`
 *  of platform names back when the accounts were still being confirmed and
 *  the footer rendered them as inert text. */
export interface SocialLink {
  name: string;
  url: string;
}

export interface FooterConfiguration {
  columns: FooterColumn[];
  socials: SocialLink[];
  orgName: string;
  orgDescription: string;
  address: string;
  /** Contact email, shown as a `mailto:` link. */
  contactEmail: string;
  copyrightLine: string;
  governingBodyLine: string;
}

/** A small, editorially-curated set of quick suggestions shown in the
 *  search overlay's idle state (before the visitor types anything) — not
 *  the search index itself. Real search queries go through
 *  `searchContent()` (`docs/SEARCH_ARCHITECTURE.md`), which covers every
 *  `SearchResultType`, not just this handful of highlighted articles. */
export interface SearchConfiguration {
  corpus: SearchResultItem[];
}

/** CMS-managed structural content for the homepage — everything that isn't
 *  an article/video/event/platform listing (those have their own service
 *  functions). */
export interface HomepageConfiguration {
  nav: NavItem[];
  /** 1–4 Editorial Image Canvas slides. Never empty (the resolver throws
   *  rather than return an empty Hero). */
  hero: HeroSlide[];
  trendingTopics: Topic[];
  footer: FooterConfiguration;
  search: SearchConfiguration;
}
