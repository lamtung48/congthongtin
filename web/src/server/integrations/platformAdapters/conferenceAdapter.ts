import "server-only";
import { z } from "zod";
import { fetchJsonWithTimeout } from "./httpJson";
import type { PlatformAdapter, PlatformActivityResult } from "./types";

/**
 * Contract this adapter expects at `{apiBaseUrl}/status` — no real Hội nghị
 * platform exists to reference yet, so this shape is this task's own
 * documented proposal; whoever wires up the real system should either match
 * it or update this parser, never the call site
 * (`platformService.refreshActivity`), which only ever sees
 * `PlatformActivityResult`.
 */
const ConferenceStatusSchema = z.object({
  /** The title of whichever session/vote is currently open, or `null` when
   *  nothing is live right now. */
  liveSessionTitle: z.string().nullable(),
  delegateCount: z.number().int().nonnegative().optional(),
});

export const conferenceAdapter: PlatformAdapter = {
  category: "CONFERENCE",

  async fetchActivity({ apiBaseUrl }): Promise<PlatformActivityResult> {
    if (!apiBaseUrl) {
      return { ok: false, reason: "not_configured", message: "Chưa cấu hình apiBaseUrl cho nền tảng Hội nghị." };
    }
    const result = await fetchJsonWithTimeout(`${apiBaseUrl.replace(/\/$/, "")}/status`);
    if (!result.ok) return result;

    const parsed = ConferenceStatusSchema.safeParse(result.data);
    if (!parsed.success) {
      return { ok: false, reason: "invalid_response", message: "Phản hồi từ API Hội nghị không đúng định dạng mong đợi." };
    }

    const { liveSessionTitle, delegateCount } = parsed.data;
    if (liveSessionTitle) {
      return {
        ok: true,
        status: "LIVE",
        currentActivity: `Đang diễn ra: ${liveSessionTitle}${delegateCount !== undefined ? ` — ${delegateCount} đại biểu đã điểm danh` : ""}`,
      };
    }
    return { ok: true, status: "ACTIVE", currentActivity: "Không có phiên nào đang diễn ra." };
  },
};
