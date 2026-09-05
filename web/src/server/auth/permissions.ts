import type { AdminRole } from "@/generated/prisma/client";

/**
 * Role -> Permission set -> server authorization (brief section 3). The UI
 * only ever shows/collects one of three role names, but every actual
 * authorization decision in this codebase goes through `hasPermission()`
 * against this list, not a raw `role === "ADMIN"` check scattered across
 * services and pages. Adding a fourth role later, or splitting one
 * permission into two more specific ones, means editing this one file —
 * not rewriting every call site that currently checks a role directly. See
 * docs/AUTHORIZATION.md, "Extensibility".
 */
export const PERMISSIONS = [
  "article.create",
  "article.edit.own",
  "article.edit.any",
  "article.delete",
  "article.submit",
  "article.approve",
  "article.return",
  "article.publish",
  "article.schedule",
  "article.unpublish",
  "taxonomy.manage",
  "organization.manage",
  "event.manage",
  "media.manage.own",
  "media.manage.any",
  "gallery.manage",
  "video.manage",
  "homepage.manage",
  "platform.manage",
  "platform.manage.display",
  "user.manage",
  "user.changeRole",
  "system.configure",
  "auditlog.view.full",
  "auditlog.view.content",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Ecosystem integration task, brief section 1: `platform.manage` ("toàn
 * quyền" — category/integrationType/apiBaseUrl, create/delete) is ADMIN-
 * only by omission from `ROLE_PERMISSIONS.MANAGER` below; `platform.manage.display`
 * ("quản lý nội dung/hiển thị") is the subset MANAGER also gets —
 * name/description/icon/url/ctaLabel/order/isEnabled/status/currentActivity,
 * and triggering an adapter refresh. CONTRIBUTOR holds neither (brief
 * section 1: "không quản lý platform configuration").
 */

/**
 * ADMIN gets every permission by construction (see `hasPermission`) rather
 * than a hand-maintained list that has to be kept in sync with `PERMISSIONS`
 * every time one is added — "Admin có toàn quyền hệ thống" (brief section
 * 2) is a structural guarantee, not a list that can silently drift.
 */
const ROLE_PERMISSIONS: Record<Exclude<AdminRole, "ADMIN">, ReadonlySet<Permission>> = {
  MANAGER: new Set<Permission>([
    "article.create",
    "article.edit.own",
    "article.edit.any",
    "article.delete",
    "article.submit",
    "article.approve",
    "article.return",
    "article.publish",
    "article.schedule",
    "article.unpublish",
    "taxonomy.manage",
    "organization.manage",
    "event.manage",
    "media.manage.own",
    "media.manage.any",
    "gallery.manage",
    "video.manage",
    "homepage.manage",
    "platform.manage.display",
    "auditlog.view.content",
  ]),
  CONTRIBUTOR: new Set<Permission>([
    "article.create",
    "article.edit.own",
    "article.submit",
    "media.manage.own",
  ]),
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  if (role === "ADMIN") return true;
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Display names — brief sections 1 & 14 require these exact three labels
 *  wherever a role is shown in the UI (user menu, role dropdown, user list). */
export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Quản trị viên",
  CONTRIBUTOR: "Cộng tác viên",
};

/** UI role dropdown option order — brief section 7: "Không tạo role thứ tư." */
export const ASSIGNABLE_ROLES: AdminRole[] = ["ADMIN", "MANAGER", "CONTRIBUTOR"];
