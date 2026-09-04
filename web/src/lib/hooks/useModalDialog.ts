"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * The WAI-ARIA APG modal-dialog trio — Tab-trap, Escape-to-close, focus
 * returned to whatever triggered the dialog — factored out once it was
 * needed by a third dialog (Gallery's lightbox already implements this
 * inline and is left as-is; VideoSection's player modal and
 * ActivityMapSection's mobile sheet were missing all three).
 */
export function useModalDialog(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>
) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const toFocus = initialFocusRef?.current ?? containerRef.current;
    const t = setTimeout(() => toFocus?.focus(), 40);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !containerRef.current) return;
      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      const el = returnFocusRef.current;
      if (el) setTimeout(() => { try { el.focus(); } catch {} }, 40);
    };
  }, [active, containerRef, initialFocusRef, onClose]);
}
