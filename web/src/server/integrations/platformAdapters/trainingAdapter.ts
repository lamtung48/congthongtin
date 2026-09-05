import "server-only";
import { z } from "zod";
import { fetchJsonWithTimeout } from "./httpJson";
import type { PlatformAdapter, PlatformActivityResult } from "./types";

/**
 * Contract this adapter expects at `{apiBaseUrl}/status` — see
 * `conferenceAdapter.ts`'s header comment for why this shape is this
 * task's own proposal, not a real spec.
 */
const TrainingStatusSchema = z.object({
  openCourseCount: z.number().int().nonnegative(),
});

export const trainingAdapter: PlatformAdapter = {
  category: "TRAINING",

  async fetchActivity({ apiBaseUrl }): Promise<PlatformActivityResult> {
    if (!apiBaseUrl) {
      return { ok: false, reason: "not_configured", message: "Chưa cấu hình apiBaseUrl cho nền tảng Đào tạo." };
    }
    const result = await fetchJsonWithTimeout(`${apiBaseUrl.replace(/\/$/, "")}/status`);
    if (!result.ok) return result;

    const parsed = TrainingStatusSchema.safeParse(result.data);
    if (!parsed.success) {
      return { ok: false, reason: "invalid_response", message: "Phản hồi từ API Đào tạo không đúng định dạng mong đợi." };
    }

    return {
      ok: true,
      status: parsed.data.openCourseCount > 0 ? "ACTIVE" : "MAINTENANCE",
      currentActivity: `${parsed.data.openCourseCount} khoá đang mở`,
    };
  },
};
