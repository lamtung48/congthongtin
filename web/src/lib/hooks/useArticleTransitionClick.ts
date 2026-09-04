"use client";

import { useRouter } from "next/navigation";
import { startTransition, type MouseEvent } from "react";

/**
 * Click handler for a card linking to an article: where
 * `document.startViewTransition` exists, navigates through it so the
 * shared `view-transition-name` cover image (see
 * `src/lib/viewTransition.ts`) morphs into place instead of cutting;
 * everywhere else (unsupported browsers, modified clicks — middle-click,
 * ctrl/cmd/shift/alt-click) it does nothing and lets the `<Link>` navigate
 * normally, so the feature is purely additive.
 *
 * Known caveat: the "new" snapshot is taken as soon as `router.push`
 * schedules the update inside `startTransition`, not once the destination
 * route has actually finished rendering — for a statically-exported,
 * already-prefetched route (every `/tin-tuc/[slug]` here) that gap is a
 * frame or two, not a visible stall, but it's not a guarantee the API gives.
 * See `docs/ARTICLE_DETAIL.md`.
 */
export function useArticleTransitionClick(href: string) {
  const router = useRouter();
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (typeof document.startViewTransition !== "function") return;
    e.preventDefault();
    document.startViewTransition(() => {
      return new Promise<void>((resolve) => {
        startTransition(() => {
          router.push(href);
          resolve();
        });
      });
    });
  };
}
