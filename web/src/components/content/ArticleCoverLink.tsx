"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { useArticleTransitionClick } from "@/lib/hooks/useArticleTransitionClick";

/**
 * The one piece of a card's cover link that actually needs to run in the
 * browser: `useArticleTransitionClick`'s View Transition click handler.
 * Isolated into its own tiny Client Component so the section around it
 * (card layout, secondary list, date formatting — everything that's just
 * markup) can stay a Server Component instead of the whole file paying the
 * client-bundle/hydration cost for one `onClick`. See `docs/PERFORMANCE.md`
 * ("Server Component khi có thể").
 */
type Props = Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "onClick"> & { href: string };

export function ArticleCoverLink({ href, ...rest }: Props) {
  const onClick = useArticleTransitionClick(href);
  return <Link href={href} onClick={onClick} {...rest} />;
}
