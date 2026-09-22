import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import styles from "./login.module.css";
import { EditorialLoginForm, PersonalLoginForm } from "./LoginForms";
import { getPerson, safeNextPath } from "@/server/auth/person";
import { IconActivity, IconExternal, IconPen, IconShield, IconTraining, IconUser } from "@/components/icons";
import { HOAT_DONG_URL } from "@/lib/siteChrome";

export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * One sign-in page, two flows (docs/AUTHENTICATION.md, "Hai luồng đăng nhập"):
 *  - "Tài khoản cá nhân" (default): any HSV-ID account — the shared SSO
 *    session with Hoạt động / Đào tạo. Back to the page you came from.
 *  - "Ban biên tập" (`?luong=bien-tap`): Admin / editors / contributors of
 *    this CMS → `/admin/dashboard`. `/admin/login` redirects here.
 * The tabs are plain links, so each flow has its own URL and works without JS.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ luong?: string; next?: string }> }) {
  const params = await searchParams;
  const editorial = params.luong === "bien-tap";
  const next = safeNextPath(params.next, "/");
  const person = await getPerson();

  if (editorial && person?.editor) redirect("/admin/dashboard");
  if (!editorial && person) redirect(next === "/" ? "/tai-khoan" : next);

  const personalHref = next === "/" ? "/dang-nhap" : `/dang-nhap?next=${encodeURIComponent(next)}`;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.brandPanel}>
          <span aria-hidden className={styles.brandGlow} />
          <div className={styles.brandTop}>
            <Image src="/images/hsv-logo.png" alt="" width={52} height={52} />
            <span className={styles.brandName}>
              Hội Sinh viên Việt Nam
              <small>Cổng thông tin số</small>
            </span>
          </div>
          <div className={styles.brandCopy}>
            <p className={styles.brandEyebrow}>{editorial ? "Khu vực Ban biên tập" : "Tài khoản HSV-ID"}</p>
            <h1 className={styles.brandTitle}>{editorial ? "Biên tập và xuất bản nội dung của Cổng" : "Một tài khoản cho mọi nền tảng của Hội"}</h1>
            <p className={styles.brandLead}>
              {editorial
                ? "Soạn bài, duyệt bài, quản lý chuyên mục, trang chủ và thư viện media."
                : "Đăng nhập một lần — dùng ngay ở Hoạt động và Đào tạo, xem Thẻ Hội viên và cập nhật hồ sơ của bạn."}
            </p>
          </div>
          {editorial ? (
            <ul className={styles.brandList}>
              <li>
                <span className={styles.brandIcon} data-tone="portal">
                  <IconPen size={17} />
                </span>
                Soạn thảo, gửi duyệt và xuất bản bài viết
              </li>
              <li>
                <span className={styles.brandIcon} data-tone="training">
                  <IconShield size={18} />
                </span>
                Phân quyền theo vai trò: Admin · Quản trị viên · Cộng tác viên
              </li>
              <li>
                <span className={styles.brandIcon} data-tone="activity">
                  <IconActivity size={18} />
                </span>
                Trang chủ, chuyên mục, thư viện ảnh – video – tài liệu
              </li>
            </ul>
          ) : (
            <ul className={styles.brandList}>
              <li>
                <span className={styles.brandIcon} data-tone="activity">
                  <IconActivity size={18} />
                </span>
                Hoạt động — đăng ký, điểm danh QR, Thẻ Hội viên
              </li>
              <li>
                <span className={styles.brandIcon} data-tone="training">
                  <IconTraining size={18} />
                </span>
                Đào tạo — khoá học, chứng nhận điện tử
              </li>
              <li>
                <span className={styles.brandIcon} data-tone="portal">
                  <IconShield size={18} />
                </span>
                Hồ sơ dùng chung — sửa một nơi, cập nhật mọi nơi
              </li>
            </ul>
          )}
        </aside>

        <section className={styles.formPanel} aria-labelledby="login-title">
          <nav className={styles.tabs} aria-label="Chọn loại tài khoản">
            <Link href={personalHref} className={styles.tab} aria-current={!editorial ? "page" : undefined}>
              <IconUser size={16} />
              Tài khoản cá nhân
            </Link>
            <Link href="/dang-nhap?luong=bien-tap" className={styles.tab} aria-current={editorial ? "page" : undefined}>
              <IconPen size={15} />
              Ban biên tập
            </Link>
          </nav>

          <div className={styles.formHead}>
            <h2 id="login-title" className={styles.formTitle}>
              {editorial ? "Đăng nhập Ban biên tập" : "Đăng nhập tài khoản cá nhân"}
            </h2>
            <p className={styles.formSub}>
              {editorial
                ? "Dành cho Admin, quản trị viên và cộng tác viên của Cổng thông tin."
                : "Dùng tài khoản HSV-ID — cùng tài khoản với nền tảng Hoạt động và Đào tạo."}
            </p>
          </div>

          {editorial && person && !person.editor && (
            <p className={styles.notice} role="status">
              Bạn đang đăng nhập tài khoản cá nhân <strong>{person.fullName}</strong>. Tài khoản này chưa có quyền Ban biên tập — đăng nhập bằng tài khoản biên tập bên dưới.
            </p>
          )}

          {editorial ? <EditorialLoginForm /> : <PersonalLoginForm next={next} />}

          <div className={styles.formFoot}>
            {editorial ? (
              <p>
                Đăng nhập bằng tài khoản HSV-ID đã được Admin của Cổng cấp quyền. Chưa được cấp quyền: liên hệ Admin, hoặc dùng tab “Tài khoản cá nhân”.
              </p>
            ) : (
              <p>
                Chưa có tài khoản?{" "}
                <a href={`${HOAT_DONG_URL}/dang-ky`} target="_blank" rel="noopener noreferrer">
                  Đăng ký tại nền tảng Hoạt động <IconExternal size={12} />
                </a>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
