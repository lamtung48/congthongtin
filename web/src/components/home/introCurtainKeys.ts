/** Shared by the server part (inline pre-paint check) and the client part of IntroCurtain — a plain module, so both get real values. */
/** sessionStorage key for the load COUNTER (see IntroCurtain.tsx's inline script) — plays on load 1, 4, 7, … (every 3rd). */
export const INTRO_COUNT_KEY = "hsv-intro-count";
/** html class the inline script adds when THIS load should stay silent — the one thing IntroCurtainStage trusts to decide `gone`. */
export const INTRO_SEEN_CLASS = "hsv-intro-seen";
