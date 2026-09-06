# Operations

Production readiness task, brief sections 10 & 13: monitoring, log
rotation, and the dev/staging/production environment split. Local
database setup is already covered in docs/ENVIRONMENT.md; this doc is
about running the deployed app day to day.

## 1. Monitoring (brief section 10)

Nothing here requires installing an APM agent into the app itself — every
check below is either a plain OS tool already on any Linux VPS, or the
one endpoint this task added for exactly this purpose.

| What | How |
|---|---|
| Application health | `GET /api/health` — checks the app can reach Postgres (`SELECT 1`), returns `{"status":"ok"}`/200 or `{"status":"error"}`/503. No auth required (a monitoring agent has no admin session) and reveals nothing sensitive. Point an uptime checker (UptimeRobot, a cron `curl` + alert, nginx's own `proxy_next_upstream` health check) at this through the reverse proxy. |
| HTTP 5xx | Reverse proxy access log (`nginx`'s default log format already includes status code) — `grep ' 5[0-9][0-9] ' /var/log/nginx/access.log` or point a log-shipping agent (Filebeat, Vector, whatever's already used for `hoinghi`/`daotaohsv`, if anything) at it. This app doesn't need its own separate 5xx counter — nginx sees every response regardless of what generated it. |
| CPU/RAM | `pm2 monit` (if using PM2 — live view) or `systemctl status congthongtin` + `top`/`htop` (if using systemd). `pm2 status` also shows per-process memory, useful for confirming the `max_memory_restart` cap (docs/DEPLOYMENT.md, section 2) isn't being hit repeatedly. |
| Disk | `df -h` for the whole VPS, `du -sh /opt/congthongtin /var/backups/congthongtin /var/log/congthongtin` for this app's own three growth points — see docs/DEPLOYMENT.md, section 6 for the budget each should stay under (and `du -sh /opt/hoinghi /opt/daotaohsv` to see what the other two apps already use). |
| Database | `psql -c "SELECT pg_size_pretty(pg_database_size('congthongtin'));"` for total size; `SELECT * FROM pg_stat_activity;` for connection count/long-running queries if something feels slow. |

### Memory

The video upload route buffers the entire file (up to 200MB) in Node
process memory before forwarding it to YouTube
(`src/app/api/admin/media/videos/upload/route.ts`) — this is a real,
if brief, memory spike per concurrent upload, and it's the reason
`max_memory_restart`/`MemoryMax` are set in docs/DEPLOYMENT.md's process
manager config rather than left at PM2/systemd's defaults: a crash-and-
restart on genuine memory pressure is preferable to an unbounded process
eating into memory `hoinghi`/`daotaohsv`'s own processes need.

### A simple daily check-in

If nothing more sophisticated is set up yet, a single cron line covers
CPU/RAM/disk/health in one email:

```bash
# /etc/cron.d/congthongtin-daily-check
0 8 * * * congthongtin /opt/congthongtin/scripts/dailyCheck.sh 2>&1 | mail -s "Cong Thong Tin daily check" ops@your-domain.vn
```

(No `dailyCheck.sh` is shipped in this repo — assemble one from the
commands in the table above if you want this specific cron line; it's
listed here as a suggested starting point, not a claim that the script
exists.)

## 2. Log rotation (brief section 7)

Two log sources, two rotation configs:

**PM2** (if using it): `pm2-logrotate` is the standard module —

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

**systemd** (if using it instead): systemd's own journal already rotates
by default (`/etc/systemd/journald.conf`'s `SystemMaxUse`); cap it
explicitly if disk is tight:

```ini
# /etc/systemd/journald.conf.d/congthongtin.conf
[Journal]
SystemMaxUse=500M
```

**nginx**: already rotated by the distro's own `/etc/logrotate.d/nginx` —
nothing app-specific needed here (this covers `hoinghi`/`daotaohsv`'s
access/error logs too, since they all share the one nginx instance).

**This app's own backup log** (`/var/log/congthongtin/backup.log`, if
following docs/BACKUP_RESTORE.md's cron example literally): add a
`logrotate` config so it doesn't grow forever —

```
# /etc/logrotate.d/congthongtin
/var/log/congthongtin/*.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
}
```

## 3. Environments (brief section 13)

Dev, staging, and production are each just a different `.env` file
pointed at a different `DATABASE_URL` — nothing in the app's code branches
on "which environment am I in" except two things already documented in
`src/data-access/index.ts`:

| | `NODE_ENV` | `CONTENT_PROVIDER` | What serves content |
|---|---|---|---|
| Local dev | `development` (Next's default under `next dev`) | unset, or `fixture` | `FixtureProvider` (static in-repo data) unless `CONTENT_PROVIDER` is unset and a real `DATABASE_URL` is configured — see that file for the exact precedence |
| Staging | `production` (real `next build && next start`, on its own VPS/subdomain, own `DATABASE_URL`) | unset | `DatabaseProvider`, same code path as production, different database — the point of a staging environment is running the *same* build against *different* data, not different code |
| Production | `production` | unset (must not be `fixture` — refused with a loud console warning if it is, `src/data-access/index.ts`) | `DatabaseProvider` |
| Tests (`npm test`) | `test` | n/a | Always `FixtureProvider`, regardless of `CONTENT_PROVIDER` — the test suite never touches a fixture/database ambiguity |

A staging environment is optional (brief section 13 says "nếu có") — this
repo doesn't require one, but if set up, it should be a full second
deployment (own VPS or clearly separated port/subdomain, own Postgres
database, own `.env`) running the exact same CI-gated build production
does, never a shortcut that skips the CI gate (docs/DEPLOYMENT.md,
"Subsequent deploys").

**Secrets never committed** — enforced by `.gitignore`'s `.env*` (except
`.env.example`) rule, same in every environment; see docs/SECURITY.md,
section 8.

## 4. Final security test checklist — manual, HTTP-level (brief section 17)

The automated suite (`npm test`) covers permission logic at the service
layer (docs/SECURITY.md, section 9). This checklist is the other half —
hitting real endpoints through a running server with a real session
cookie per role, confirming the actual HTTP status code, not just that a
menu item is hidden. Run this once against staging (or a local `npm run
build && npm start`) before a first production launch, and again after
any change to `src/server/auth/`, `src/server/security/`, or any
`requirePermission`/`requireAnyPermission` call site.

For each of ADMIN / MANAGER / CONTRIBUTOR, logged in with a real session
cookie:

| Endpoint | Expected for CONTRIBUTOR | Expected for MANAGER | Expected for ADMIN |
|---|---|---|---|
| `GET /admin/sources` | 403 | 200 (read-only, no Sync/New buttons) | 200 (full) |
| `GET /admin/users` | 403 | 403 | 200 |
| `POST /api/admin/media/upload` (valid image) | 201 (holds `media.manage.own`) | 201 | 201 |
| `POST` a `changeRoleAction` targeting another user to `ADMIN` | rejected (thrown error surfaces as a failed action) | rejected | succeeds |
| `GET /admin/social-inbox` | 200, scoped to own assignments only | 200, full inbox | 200, full inbox |
| 6 rapid-fire failed `/admin/login` attempts, same account | 7th attempt returns the rate-limit message, not "wrong password" | (role doesn't apply pre-login) | (role doesn't apply pre-login) |
| Response headers on any page | `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` all present | same | same |

Record the actual run's results (date, who ran it, pass/fail per row) in
your own deploy log — this repo's own verification of this checklist for
this task is summarized in the task's final report, not duplicated here.
