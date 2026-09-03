"use client";

import { useReveal } from "@/lib/hooks/useReveal";
import type { ComponentPropsWithoutRef, ElementType } from "react";

type RevealProps<T extends ElementType> = {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

/**
 * Thin client wrapper so a mostly-static section can stay a server
 * component while individual elements still get the fail-safe scroll
 * reveal (content is visible by default; JS only ever adds the class that
 * fades it in from an armed state).
 */
export function Reveal<T extends ElementType = "div">({ as, ...props }: RevealProps<T>) {
  const Comp = (as ?? "div") as ElementType;
  const ref = useReveal<HTMLElement>();
  return <Comp data-reveal ref={ref} {...props} />;
}
