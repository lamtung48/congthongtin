import "server-only";
import { z } from "zod";
import { fetchJsonWithTimeout } from "./httpJson";
import type { PlatformAdapter, PlatformActivityResult } from "./types";

/**
 * Contract this adapter expects at `{apiBaseUrl}/status` — see
 * `conferenceAdapter.ts`'s header comment for why this shape is this
 * task's own proposal, not a real spec.
 */
const Student5GoodStatusSchema = z.object({
  certifiedThisTerm: z.number().int().nonnegative(),
});

export const student5GoodAdapter: PlatformAdapter = {
  category: "SV5TOT",

  async fetchActivity({ apiBaseUrl }): Promise<PlatformActivityResult> {
    if (!apiBaseUrl) {
      return { ok: false, reason: "not_configured", message: "Chưa cấu hình apiBaseUrl cho nền tảng Sinh viên 5 tốt." };
    }
    const result = await fetchJsonWithTimeout(`${apiBaseUrl.replace(/\/$/, "")}/status`);
    if (!result.ok) return result;

    const parsed = Student5GoodStatusSchema.safeParse(result.data);
    if (!parsed.success) {
      return { ok: false, reason: "invalid_response", message: "Phản hồi từ API Sinh viên 5 tốt không đúng định dạng mong đợi." };
    }

    return {
      ok: true,
      status: "ACTIVE",
      currentActivity: `${parsed.data.certifiedThisTerm} sinh viên đạt danh hiệu trong đợt này`,
    };
  },
};
