import { getContentProvider } from "@/data-access";
import type { Article, ArticleSummary } from "@/domain/article";
import type { Event } from "@/domain/event";
import type { Category, Topic } from "@/domain/taxonomy";
import type { Province, OverseasOrganization } from "@/domain/geo";
import type { SearchSuggestion } from "@/domain/homepage";
import type { LocalityProfile, UnitProfile } from "@/data-access/types";

/**
 * Data needed by the route pages under `src/app/` (as opposed to
 * `homepageService.ts`, which is the homepage sections' own service). Same
 * thin-pass-through pattern — see `docs/DATA_ACCESS.md`.
 */

export function getArticleBySlug(slug: string): Promise<Article | null> {
  return getContentProvider().getArticleBySlug(slug);
}

export function searchContent(query: string): Promise<SearchSuggestion[]> {
  return getContentProvider().searchContent(query);
}

export function getCategories(): Promise<Category[]> {
  return getContentProvider().getCategories();
}

export function getCategoryBySlug(slug: string): Promise<Category | null> {
  return getContentProvider().getCategoryBySlug(slug);
}

export function getArticlesByCategory(slug: string): Promise<ArticleSummary[]> {
  return getContentProvider().getArticlesByCategory(slug);
}

export function getTopics(): Promise<Topic[]> {
  return getContentProvider().getTopics();
}

export function getTopicBySlug(slug: string): Promise<Topic | null> {
  return getContentProvider().getTopicBySlug(slug);
}

export function getLocalityBySlug(slug: string): Promise<LocalityProfile | null> {
  return getContentProvider().getLocalityBySlug(slug);
}

export function getUnitBySlug(slug: string): Promise<UnitProfile | null> {
  return getContentProvider().getUnitBySlug(slug);
}

export function getProvinces(): Promise<Province[]> {
  return getContentProvider().getProvinces();
}

export function getOverseasOrganizations(): Promise<OverseasOrganization[]> {
  return getContentProvider().getOverseasOrganizations();
}

export function getEventBySlug(slug: string): Promise<Event | null> {
  return getContentProvider().getEventBySlug(slug);
}
