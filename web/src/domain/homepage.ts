import type { Topic } from "./taxonomy";
import type { Author } from "./people";
import type { MediaAsset } from "./media";
import type { SearchResultItem } from "./search";

export interface NavItem {
  label: string;
  href: string;
  soon?: boolean;
}

export interface HeroContent {
  eyebrow: string;
  headline: string;
  headlineAccent?: string;
  lead: string;
  author: Author;
  readingTimeMinutes: number;
  topicLabel: string;
  publishedAt: string;
  articleUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  media: MediaAsset;
}

export interface FooterLink {
  label: string;
  href?: string;
}

export interface FooterColumn {
  title: string;
  items: FooterLink[];
}

export interface FooterConfiguration {
  columns: FooterColumn[];
  socials: string[];
  policies: FooterLink[];
  orgName: string;
  orgDescription: string;
  address: string;
  contactNote: string;
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
  hero: HeroContent;
  trendingTopics: Topic[];
  footer: FooterConfiguration;
  search: SearchConfiguration;
}
