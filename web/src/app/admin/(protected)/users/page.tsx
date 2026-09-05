import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { userService } from "@/server/services/userService";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/server/auth/permissions";
import { changeRoleAction, setStatusAction } from "./actions";
import { CreateUserForm } from "./CreateUserForm";
import { ResetPasswordButton } from "./ResetPasswordButton";
import type { AdminRole, UserStatus } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Người dùng" };

/**
 * Brief section 7 — `/admin/users`, Admin-only. `requirePermission` here is
 * what actually blocks a Manager/Contributor from reaching this page at
 * all (server-side, before any query below runs) — the sidebar simply not
 * showing this link to them (`(protected)/layout.tsx`) is the UI
 * convenience on top, not the real guard. See docs/AUTHORIZATION.md,
 * "Route guard".
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  await requirePermission("user.manage");
  const params = await searchParams;
  const role = ASSIGNABLE_ROLES.includes(params.role as AdminRole) ? (params.role as AdminRole) : undefined;
  const status = params.status === "ACTIVE" || params.status === "DISABLED" ? (params.status as UserStatus) : undefined;

  const users = await userService.list({ search: params.q, role, status, take: 100 });

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Người dùng</h1>
          <p className="adminPageSubtitle">Quản lý tài khoản, vai trò và trạng thái hoạt động.</p>
        </div>
      </div>

      <CreateUserForm />

      <form className="adminToolbar" method="get">
        <input type="text" name="q" placeholder="Tìm theo tên, email, tên đăng nhập…" defaultValue={params.q ?? ""} className="adminInput" style={{ minWidth: 220 }} />
        <select name="role" defaultValue={params.role ?? ""} className="adminSelect">
          <option value="">Mọi vai trò</option>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ""} className="adminSelect">
          <option value="">Mọi trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="DISABLED">Đã khoá</option>
        </select>
        <button type="submit" className="adminButton">Lọc</button>
      </form>

      <div className="adminCard">
        {users.length === 0 ? (
          <div className="adminEmptyState">Không có tài khoản nào khớp bộ lọc.</div>
        ) : (
          <table className="adminTable">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email / Tên đăng nhập</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Đăng nhập gần nhất</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>
                    <div>{u.email}</div>
                    {u.username && <div className="adminHint">@{u.username}</div>}
                  </td>
                  <td>
                    <form action={changeRoleAction} style={{ display: "flex", gap: 6 }}>
                      <input type="hidden" name="userId" value={u.id} />
                      <select name="role" defaultValue={u.role} className="adminSelect" style={{ padding: "4px 8px", fontSize: 12.5 }}>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="adminButton adminButtonSmall">Lưu</button>
                    </form>
                  </td>
                  <td>
                    <span className={u.status === "ACTIVE" ? "adminBadge adminBadgeSuccess" : "adminBadge adminBadgeDanger"}>
                      {u.status === "ACTIVE" ? "Đang hoạt động" : "Đã khoá"}
                    </span>
                  </td>
                  <td className="adminHint">{u.lastLoginAt ? u.lastLoginAt.toLocaleString("vi-VN") : "Chưa đăng nhập"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <form action={setStatusAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="status" value={u.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} />
                        <button type="submit" className={u.status === "ACTIVE" ? "adminButton adminButtonSmall adminButtonDanger" : "adminButton adminButtonSmall"}>
                          {u.status === "ACTIVE" ? "Khoá" : "Mở khoá"}
                        </button>
                      </form>
                      <ResetPasswordButton userId={u.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
