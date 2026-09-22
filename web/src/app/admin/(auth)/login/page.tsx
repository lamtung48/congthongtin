import { redirect } from "next/navigation";
import { EDITORIAL_LOGIN_PATH } from "@/server/auth/session";

/**
 * Sign-in now lives on one shared page with two tabs — "Tài khoản cá nhân"
 * and "Ban biên tập" (docs/AUTHENTICATION.md, "Hai luồng đăng nhập"). This
 * old address stays valid (bookmarks, links in e-mails) and lands on the
 * editorial tab, which still posts to `loginAction` next to this file and
 * sends an already-signed-in editor straight to the dashboard.
 */
export default function AdminLoginPage() {
  redirect(EDITORIAL_LOGIN_PATH);
}
