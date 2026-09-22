"use client";

import { useState } from "react";
import { IconLogout } from "@/components/icons";

/** Ends the shared SSO session (every platform) and returns to the homepage. */
export function LogoutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // ignore — a stale cookie fails the next auth check anyway
    }
    window.location.assign("/");
  }
  return (
    <button type="button" onClick={logout} disabled={pending} className={className}>
      <IconLogout size={16} />
      {pending ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
  );
}
