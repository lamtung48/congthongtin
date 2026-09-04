import type { Topic } from "./taxonomy";
import type { Author } from "./people";
import type { MediaAsset } from "./media";

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

/** A search-corpus entry as shown in the search overlay and `/tim-kiem`.
 *  `url` is precomputed (same convention as `ArticleSummary.url`) so callers
 *  never build the route themselves. */
export interface SearchSuggestion {
  slug: string;
  url: string;
  title: string;
  category: string;
  publishedAt: string;
}

export interface SearchConfiguration {
  corpus: SearchSuggestion[];
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
