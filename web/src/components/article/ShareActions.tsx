"use client";

import { useState } from "react";
import styles from "./ShareActions.module.css";
import { IconCheck, IconLink } from "@/components/icons";

/** Builds each network's share-intent URL from the current page's *actual*
 *  address (`window.location.href`, read only inside the click handler —
 *  never during render, so this stays safe under static export's
 *  server-rendered-then-hydrated client components). Using the live
 *  location instead of reconstructing `origin + article.url` also means
 *  the GitHub Pages `basePath` is always correct without this component
 *  needing to know about it — see `docs/DEPLOYMENT.md`. */
function shareTo(network: "facebook" | "x", title: string) {
  const url = encodeURIComponent(window.location.href);
  const target =
    network === "facebook"
      ? `https://www.facebook.com/sharer/sharer.php?u=${url}`
      : `https://twitter.com/intent/tweet?url=${url}&text=${encodeURIComponent(title)}`;
  window.open(target, "_blank", "noopener,noreferrer,width=600,height=520");
}

/** Item 10 of the article detail layout. No backend involved — "share" is
 *  copy-link plus the two networks' public share-intent URLs, both of
 *  which just open a new tab; nothing here posts on the viewer's behalf. */
export function ShareActions({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable or permission denied — button just won't confirm.
    }
  }

  return (
    <div role="group" aria-label="Chia sẻ bài viết" className={styles.row}>
      <span className={styles.label}>Chia sẻ</span>
      <button type="button" onClick={copyLink} className={styles.btn}>
        {copied ? <IconCheck size={15} /> : <IconLink size={15} />}
        {copied ? "Đã sao chép" : "Sao chép liên kết"}
      </button>
      <button type="button" onClick={() => shareTo("facebook", title)} className={styles.btn}>
        Facebook
      </button>
      <button type="button" onClick={() => shareTo("x", title)} className={styles.btn}>
        X
      </button>
    </div>
  );
}
