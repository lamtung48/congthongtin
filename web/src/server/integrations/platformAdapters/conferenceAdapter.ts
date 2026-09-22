import "server-only";
import { z } from "zod";
import { fetchJsonWithTimeout } from "./httpJson";
import type { PlatformAdapter, PlatformActivityResult } from "./types";

/**
 * Reads the Hội nghị platform's own public conference list —
 * `GET {apiBaseUrl}/public/conferences`, the same endpoint its homepage uses
 * to list conferences to delegates before they sign in (hoinghi
 * `apps/api/src/modules/conference/conference.routes.ts`). Public and
 * unauthenticated, already hides pending-approval / locked / archived
 * conferences, and reachable through the platform's public domain, so the
 * refresher does not depend on sharing a docker network with hoinghi's api
 * container. Production `apiBaseUrl`: `https://hoinghi.hoisinhvien.com.vn/api`.
 *
 * Only `status` is read. The card's figure is "Tham gia ngay N hội nghị",
 * N = conferences not yet started + in progress (ended ones are still listed
 * by that endpoint, but are not something a visitor can join). Any
 * in-progress conference makes the platform LIVE ("Đang diễn ra" pill).
 */
const PublicConferencesSchema = z.object({
  conferences: z.array(z.object({ status: z.string() }).passthrough()),
});

const JOINABLE_STATUSES = new Set(["NOT_STARTED", "ONGOING"]);

export function describeConferences(statuses: string[]): { currentActivity: string; live: boolean } {
  const joinable = statuses.filter((s) => JOINABLE_STATUSES.has(s)).length;
  return {
    currentActivity: joinable > 0 ? `Tham gia ngay ${joinable} hội nghị` : "Chưa có hội nghị sắp diễn ra",
    live: statuses.includes("ONGOING"),
  };
}

export const conferenceAdapter: PlatformAdapter = {
  category: "CONFERENCE",

  async fetchActivity({ apiBaseUrl }): Promise<PlatformActivityResult> {
    if (!apiBaseUrl) {
      return { ok: false, reason: "not_configured", message: "Chưa cấu hình apiBaseUrl cho nền tảng Hội nghị." };
    }
    const result = await fetchJsonWithTimeout(`${apiBaseUrl.replace(/\/$/, "")}/public/conferences`);
    if (!result.ok) return result;

    const parsed = PublicConferencesSchema.safeParse(result.data);
    if (!parsed.success) {
      return { ok: false, reason: "invalid_response", message: "Phản hồi từ API Hội nghị không đúng định dạng mong đợi." };
    }

    const { currentActivity, live } = describeConferences(parsed.data.conferences.map((c) => c.status));
    return { ok: true, status: live ? "LIVE" : "ACTIVE", currentActivity };
  },
};
