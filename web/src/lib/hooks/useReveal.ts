"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-reveal: content is visible in the DOM by default (no JS required to
 * read it). Once mounted, elements still below the fold are "armed" (faded +
 * offset) and revealed via a single shared IntersectionObserver. A failed or
 * slow script never hides content — it only ever adds a class that reveals it.
 */
let sharedObserver: IntersectionObserver | null = null;

function getObserver() {
  if (sharedObserver) return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const siblings = Array.from(el.parentElement?.children ?? []).filter((c) =>
          c.hasAttribute("data-reveal")
        );
        const idx = siblings.indexOf(el);
        el.style.transitionDelay = `${Math.min(Math.max(idx, 0), 4) * 60}ms`;
        el.classList.add("is-in");
        sharedObserver?.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.06 }
  );
  return sharedObserver;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    el.classList.add("is-armed");
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) {
      el.classList.add("is-in");
      return;
    }
    const obs = getObserver();
    obs.observe(el);
    return () => obs.unobserve(el);
  }, []);

  return ref;
}
