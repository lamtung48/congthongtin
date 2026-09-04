"use client";

import { useEffect, useState } from "react";

export type NavMode = "full" | "compact" | "drawer";

export interface ViewportState {
  navMode: NavMode;
  narrow: boolean; // drawer nav
  mobile: boolean; // < 768px — map bottom-sheet, single-column layouts
}

function compute(): ViewportState {
  if (typeof window === "undefined") return { navMode: "full", narrow: false, mobile: false };
  const w = window.innerWidth;
  // full >=1400 · compact 1120-1399 (4 items + "More") · drawer <1120
  const navMode: NavMode = w >= 1400 ? "full" : w >= 1120 ? "compact" : "drawer";
  return { navMode, narrow: navMode === "drawer", mobile: w < 768 };
}

const SERVER_STATE: ViewportState = { navMode: "full", narrow: false, mobile: false };

export function useViewport(): ViewportState {
  // Initial state must match the server-rendered markup exactly (no window
  // access here) — the real size is measured post-mount in the effect below,
  // same as the prototype's own componentDidMount-time resize handler.
  const [state, setState] = useState<ViewportState>(SERVER_STATE);
  useEffect(() => {
    const measure = () => setState(compute());
    measure();
    // compute() returns a new object every call, so an unthrottled listener
    // would re-render every consumer (Header, ActivityMapSection, ...) on
    // every tick of a window drag-resize — debounce like the rest of the
    // codebase's resize handling (see StoryRail, VietnamMapSvg).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setState(compute()), 120);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, []);
  return state;
}
