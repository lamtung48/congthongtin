import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/server/auth/session";
import { youtubeService } from "@/server/services/youtubeService";
import { YoutubeNotConfiguredError, YoutubeOperationError } from "@/server/integrations/youtube";

/**
 * Step 2 of the OAuth consent flow — Google redirects the Admin's browser
 * here with `code`/`state` (or `error`) after the consent screen. A plain
 * navigation (not a `fetch`/XHR), so errors are communicated back via a
 * redirect with a query param the video library page reads and renders as
 * a banner, not a JSON error body.
 *
 * `state` must match the nonce `startYoutubeConnectAction` stored in the
 * `yt_oauth_state` cookie before redirecting to Google — without this
 * check, a third party could send an Admin's browser a link that completes
 * a connection using the *attacker's* authorization code, silently
 * replacing the app's YouTube connection with the attacker's channel (a
 * standard OAuth CSRF mitigation, the same reason `state` exists in the
 * spec at all).
 */

const OAUTH_STATE_COOKIE = "yt_oauth_state"; // must match src/app/admin/(protected)/media/videos/actions.ts

function redirectWithStatus(status: "connected" | "error", message?: string) {
  const url = new URL("/admin/media/videos", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  url.searchParams.set("youtubeOAuth", status);
  if (message) url.searchParams.set("youtubeOAuthMessage", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const actor = await requireSession();
  const { searchParams } = new URL(request.url);

  const oauthError = searchParams.get("error");
  if (oauthError) {
    return redirectWithStatus("error", "Đã huỷ kết nối hoặc Google từ chối yêu cầu cấp quyền.");
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus("error", "Yêu cầu kết nối không hợp lệ hoặc đã hết hạn — vui lòng thử lại.");
  }

  try {
    await youtubeService.completeConnect(actor, code);
    return redirectWithStatus("connected");
  } catch (err) {
    if (err instanceof YoutubeNotConfiguredError || err instanceof YoutubeOperationError) {
      return redirectWithStatus("error", err.message);
    }
    if (err instanceof Error) {
      return redirectWithStatus("error", err.message);
    }
    throw err;
  }
}
