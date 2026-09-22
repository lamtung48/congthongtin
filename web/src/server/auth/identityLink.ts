import "server-only";
import { userRepository } from "@/server/repositories/userRepository";
import type { HsvSsoUser } from "@/server/integrations/hsvId";

/**
 * Maps a validated `hsv-id` identity to this CMS's local `User` row (which
 * owns the ROLE, status and authorship — `hsv-id` owns who the person is).
 *
 * Linking by e-mail is NOT free: `hsv-id` does not verify e-mails, and any
 * HSV platform lets anyone register with any address. Silently attaching an
 * unlinked local account (say, an ADMIN) to whichever hsv-id account happens
 * to share its e-mail would hand that role to a stranger. So an unlinked
 * local row is only ever linked with PROOF the person owns it (its local
 * password verifies — `authService.login`); a bare session cookie never
 * links anything.
 */

export type LocalUserRow = NonNullable<Awaited<ReturnType<typeof userRepository.findByIdentityUserId>>>;

export type IdentityMatch =
  | { kind: "linked"; user: LocalUserRow }
  /** A local row with the same e-mail exists but is not linked to any hsv-id account yet. */
  | { kind: "unlinked-email"; user: LocalUserRow }
  /** The e-mail belongs to a local row already linked to a DIFFERENT hsv-id account. */
  | { kind: "conflict" }
  | { kind: "none" };

export function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

export async function matchLocalUser(identity: HsvSsoUser): Promise<IdentityMatch> {
  const linked = await userRepository.findByIdentityUserId(identity.id);
  if (linked) return { kind: "linked", user: linked };

  const email = normalizeEmail(identity.email);
  if (!email) return { kind: "none" };
  const byEmail = await userRepository.findByEmailInsensitive(email);
  if (!byEmail) return { kind: "none" };
  return byEmail.identityUserId ? { kind: "conflict" } : { kind: "unlinked-email", user: byEmail };
}
