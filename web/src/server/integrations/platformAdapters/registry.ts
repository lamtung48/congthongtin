import "server-only";
import type { PlatformCategory } from "@/generated/prisma/client";
import { conferenceAdapter } from "./conferenceAdapter";
import { trainingAdapter } from "./trainingAdapter";
import { student5GoodAdapter } from "./student5GoodAdapter";
import { volunteerAdapter } from "./volunteerAdapter";
import type { PlatformAdapter } from "./types";

/**
 * Ecosystem integration task, brief section 5's exact four adapters, keyed
 * by the category each one integrates. `DATA` has no adapter — it's a
 * static "Sắp ra mắt" reporting placeholder (`platformView.ts`'s `"data"`
 * branch), not a real external system to poll; a category without an
 * adapter here simply means `platformService.refreshActivity` refuses with
 * "not_configured" rather than crashing on a missing lookup.
 */
const PLATFORM_ADAPTERS: Partial<Record<PlatformCategory, PlatformAdapter>> = {
  CONFERENCE: conferenceAdapter,
  TRAINING: trainingAdapter,
  SV5TOT: student5GoodAdapter,
  VOLUNTEER: volunteerAdapter,
};

export function getAdapterForCategory(category: PlatformCategory): PlatformAdapter | undefined {
  return PLATFORM_ADAPTERS[category];
}
