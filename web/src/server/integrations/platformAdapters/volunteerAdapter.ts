import "server-only";
import { z } from "zod";
import { fetchJsonWithTimeout } from "./httpJson";
import type { PlatformAdapter, PlatformActivityResult } from "./types";

/**
 * Contract this adapter expects at `{apiBaseUrl}/status` — see
 * `conferenceAdapter.ts`'s header comment for why this shape is this
 * task's own proposal, not a real spec.
 */
const VolunteerStatusSchema = z.object({
  openCampaignCount: z.number().int().nonnegative(),
});

export const volunteerAdapter: PlatformAdapter = {
  category: "VOLUNTEER",

  async fetchActivity({ apiBaseUrl }): Promise<PlatformActivityResult> {
    if (!apiBaseUrl) {
      return { ok: false, reason: "not_configured", message: "Chưa cấu hình apiBaseUrl cho nền tảng Tình nguyện." };
    }
    const result = await fetchJsonWithTimeout(`${apiBaseUrl.replace(/\/$/, "")}/status`);
    if (!result.ok) return result;

    const parsed = VolunteerStatusSchema.safeParse(result.data);
    if (!parsed.success) {
      return { ok: false, reason: "invalid_response", message: "Phản hồi từ API Tình nguyện không đúng định dạng mong đợi." };
    }

    const { openCampaignCount } = parsed.data;
    return {
      ok: true,
      status: openCampaignCount > 0 ? "OPEN" : "UNAVAILABLE",
      currentActivity: openCampaignCount > 0 ? `${openCampaignCount} chiến dịch đang mở đăng ký` : "Không có chiến dịch nào đang mở.",
    };
  },
};
