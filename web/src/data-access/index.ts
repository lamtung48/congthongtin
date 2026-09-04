import type { ContentProvider } from "./provider";
import { FixtureProvider } from "./providers/fixtureProvider";

export type { ContentProvider } from "./provider";
export * from "./types";

let instance: ContentProvider | null = null;

/**
 * The single swap point for the whole app. Every other module reaches the
 * data layer through this function — never by importing `FixtureProvider`
 * (or a future `ApiProvider`/`DatabaseProvider`/`CmsProvider`) directly.
 * Migrating off fixtures later is a one-line change here; see
 * `docs/DATA_ACCESS.md`.
 */
export function getContentProvider(): ContentProvider {
  if (!instance) instance = new FixtureProvider();
  return instance;
}
