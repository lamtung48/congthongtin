# Deployment — VPS production topology

Production readiness task. Target: **one existing shared VPS (~200GB)**
that already runs two other apps — `/opt/hoinghi` (hội nghị) and
`/opt/daotaohsv` (đào tạo HSV, the "nền tảng tập huấn/đào tạo" this
project's own brief refers to). This app is a **third** tenant on that
box, not a fresh dedicated server. Everything here is written with that
constraint in mind: isolate this app's own directory/user/port/logs/
database/nginx-block from those two, and keep this app's own disk
footprint small and mostly bounded (media is ~0GB persistent — see
section 6).

## 0. Before touching anything — check what's already there

Run these on the actual VPS before picking any name/port below (this repo
has no access to that server, so nothing past this point is guaranteed
conflict-free until you confirm it against the real machine):

```bash
# What ports are already bound (hoinghi/daotaohsv are almost certainly on
# 3000/3001 or similar — this app needs a genuinely free one).
sudo ss -tlnp | grep -E ':(3000|3001|3002|3003)\b'

# What nginx already serves (domains, ports, upstream targets).
ls /etc/nginx/sites-enabled/
grep -r "server_name\|proxy_pass" /etc/nginx/sites-enabled/

# What Postgres databases/roles already exist (reuse the server, not the
# database — see section 4).
sudo -u postgres psql -c '\l'
sudo -u postgres psql -c '\du'

# What process managers/users the other two apps run under.
pm2 list 2>/dev/null
systemctl list-units --type=service | grep -iE 'hoinghi|daotao'
ls /home /opt
```

This doc uses `congthongtin` as the suggested name for every
app-specific identifier below (directory, Linux user, PM2/systemd
process, Postgres database/role, log/backup directories) — matching this
repo's own name and the lowercase-no-separator style `hoinghi`/
`daotaohsv` already use on this VPS. Rename everything consistently if a
different name is preferred; the important part is that it's **one**
name, distinct from the other two apps', reused everywhere below.

## 1. Topology

```
Internet
   │  HTTPS (443)
   ▼
Reverse proxy (nginx, already on the VPS for hoinghi/daotaohsv —
add one more server block, don't run a second nginx)
   │  proxy_pass, plain HTTP, localhost only
   ▼
Next.js app (this repo) — one Node.js process, `next start`,
listening on 127.0.0.1:<PORT>, managed by PM2 or systemd
   │
   ├──▶ PostgreSQL (own database — reuse the VPS's existing Postgres
   │     server instance if hoinghi/daotaohsv already run one, see
   │     section 4)
   │
   ├──▶ Google Drive API — image storage (docs/GOOGLE_DRIVE_MEDIA.md)
   │
   └──▶ YouTube Data API — video storage/playback (docs/YOUTUBE_INTEGRATION.md)

Redis: not used. Nothing in this app needs a shared cache or a
distributed lock — sessions are DB-backed rows (docs/AUTHENTICATION.md),
rate limiting is in-memory per-process (docs/SECURITY.md, "Rate
limiting") and correct precisely because this topology is **one** Next.js
process. Add Redis only if a future change actually needs one (e.g.
horizontally scaling to more than one app instance) — brief's own
instruction: "Redis chỉ nếu thực sự cần."
```

**Single process, not a cluster.** Do not run this app under PM2 cluster
mode or with more than one Node process/instance. The login rate limiter
(`src/server/auth/rateLimit.ts`) and the other rate limiters
(`src/server/security/rateLimit.ts`) are in-memory `Map`s scoped to one
process — splitting traffic across multiple instances would silently
fragment those buckets (an attacker could get N× the attempts by hitting
N different processes) without ever failing loud. If this app ever needs
to scale horizontally, that's the point at which rate limiting needs to
move to a shared store (Redis or a DB table) — see docs/SECURITY.md.

## 2. Process management

Either PM2 or a systemd unit works; both examples assume the app lives at
`/opt/congthongtin/web` and runs as its own unprivileged Linux user
(`congthongtin`, not root, and not the `hoinghi`/`daotaohsv` service
users — keeps file permissions and crash blast radius separate from both).

```bash
sudo useradd --system --home-dir /opt/congthongtin --shell /usr/sbin/nologin congthongtin
sudo mkdir -p /opt/congthongtin /var/log/congthongtin /var/backups/congthongtin
sudo chown -R congthongtin:congthongtin /opt/congthongtin /var/log/congthongtin /var/backups/congthongtin
```

### PM2

```js
// /opt/congthongtin/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "congthongtin",
      cwd: "/opt/congthongtin/web",
      script: "npm",
      args: "start",
      instances: 1, // see "Single process, not a cluster" above — never change this
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3002", // confirmed free in section 0 — adjust if hoinghi/daotaohsv already use it
      },
      max_memory_restart: "768M", // video upload buffers the whole file in RAM (up to 200MB) — see docs/OPERATIONS.md, "Memory"
      out_file: "/var/log/congthongtin/out.log",
      error_file: "/var/log/congthongtin/error.log",
      time: true,
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js
pm2 save            # persist across reboots
pm2 startup         # one-time: installs the systemd unit that restarts PM2 itself on boot (skip if hoinghi/daotaohsv already did this — pm2 startup only needs running once per machine)
```

### systemd (alternative to PM2)

```ini
# /etc/systemd/system/congthongtin.service
[Unit]
Description=Cong Thong Tin So HSV (Next.js)
After=network.target postgresql.service

[Service]
Type=simple
User=congthongtin
WorkingDirectory=/opt/congthongtin/web
Environment=NODE_ENV=production
Environment=PORT=3002
EnvironmentFile=/opt/congthongtin/web/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
# Same reasoning as PM2's max_memory_restart above.
MemoryMax=768M

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now congthongtin
```

## 3. Reverse proxy (nginx)

Add a new `server` block to the VPS's existing nginx config, in its own
file — do not edit `hoinghi`/`daotaohsv`'s existing server blocks, and do
not run a second nginx instance:

```bash
sudo nano /etc/nginx/sites-available/congthongtin
sudo ln -s /etc/nginx/sites-available/congthongtin /etc/nginx/sites-enabled/
sudo nginx -t   # always validate before reloading
sudo systemctl reload nginx
```

Brief section 8's security headers are set by this app itself
(`next.config.ts`'s `headers()` — see docs/SECURITY.md), so nginx's job
here is TLS termination, forwarding the real client IP (the login rate
limiter and audit log both read `x-forwarded-for` —
`src/server/auth/session.ts`), and raising the body size limit for video
uploads (`docs/YOUTUBE_INTEGRATION.md` caps a video at 200MB in the app
itself; nginx's own default 1MB limit would reject the request before it
ever reaches Next.js).

```nginx
server {
    listen 443 ssl http2;
    server_name congthongtin.your-domain.vn; # a domain/subdomain distinct from hoinghi's and daotaohsv's

    ssl_certificate     /etc/letsencrypt/live/congthongtin.your-domain.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/congthongtin.your-domain.vn/privkey.pem;

    client_max_body_size 210m; # 200MB video cap + headroom for multipart overhead

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name congthongtin.your-domain.vn;
    return 301 https://$host$request_uri;
}
```

TLS certificates: `certbot --nginx -d congthongtin.your-domain.vn`
(Let's Encrypt) — reuses the same certbot install `hoinghi`/`daotaohsv`
likely already set up; it just adds one more certificate/renewal entry,
no need to install certbot again.

### TLS and HSTS

This app sends `Strict-Transport-Security: max-age=31536000` on every
response (`next.config.ts`) — deliberately **without**
`includeSubDomains` or `preload`. Do not add either without thinking
through the actual domain layout first:

- If `congthongtin`, `hoinghi`, and `daotaohsv` end up on three
  **separate** domains (or three subdomains where none is a parent of
  another), `includeSubDomains` on this app's own header has no effect on
  the other two at all — safe to add if you specifically want it.
- If this app is ever served from a **parent** domain (e.g.
  `your-domain.vn` directly) with `hoinghi`/`daotaohsv` as its
  **subdomains** (`hoinghi.your-domain.vn`, etc.), adding
  `includeSubDomains` here would force every browser that visits this app
  to require HTTPS on those subdomains too, immediately — breaking them
  if their own HTTPS isn't confirmed solid, with no quick way to undo it
  once a browser has cached the header.
- `preload` is a public, browser-vendor-maintained list and is slow/hard
  to reverse once submitted — only add it as a deliberate decision made
  with the full domain layout in view, never by default.

## 4. Database

A dedicated PostgreSQL **database**, not necessarily a dedicated
PostgreSQL **server** — if `hoinghi`/`daotaohsv` already run Postgres on
this VPS, reuse that server process and just create a new database + role
for this app:

```sql
CREATE DATABASE congthongtin;
CREATE ROLE congthongtin LOGIN PASSWORD '...'; -- generate with `openssl rand -hex 24`
GRANT ALL ON DATABASE congthongtin TO congthongtin;
```

Running a second `postgresql` service would waste both memory and the
disk budget in section 6 for no isolation benefit Postgres' own
role/database separation doesn't already give.

**Not exposed to the public Internet** (brief section 5): Postgres should
bind to `127.0.0.1` (or a private/VPC interface if the app and DB are ever
split across hosts) — `listen_addresses = 'localhost'` in
`postgresql.conf`, and `pg_hba.conf` should not have a `host ... 0.0.0.0/0`
line for this role. The app connects over `DATABASE_URL` on localhost;
nothing about this app needs the database reachable from outside the VPS
at all. This is unrelated to whether `hoinghi`/`daotaohsv` already reach
Postgres the same way — check `pg_hba.conf`'s existing lines while you're
in there, but this app's own role doesn't need anything wider than they
already have.

See docs/BACKUP_RESTORE.md for the backup/restore procedure.

## 5. Media storage — the ~0GB-persistent guarantee

Brief section 6/14: no uploaded image, video, or temp media file should
end up persistent on this VPS. This is true today by construction, not by
convention — verified during this task:

- **Images**: `POST /api/admin/media/upload` reads the multipart body into
  one in-memory `Buffer`, validates it, uploads it straight to Google
  Drive, and stores only the returned Drive file id in Postgres
  (`src/app/api/admin/media/upload/route.ts`). No `fs.writeFile` anywhere
  in that path — grep confirms it (`googleDrive.ts`'s own header comment:
  "Nothing here ever writes the buffer to disk").
- **Videos**: same pattern, buffered in RAM up to 200MB, uploaded straight
  to YouTube via the Data API v3 (`src/app/api/admin/media/videos/upload/route.ts`).
  This is a **RAM** cost per concurrent upload, not a disk cost — see
  docs/OPERATIONS.md, "Memory" for why `max_memory_restart`/`MemoryMax`
  above matter more here than disk headroom does.
- **Serving media back out**: `GET /api/media/[mediaId]` streams bytes
  from Google Drive straight through to the response
  (`Readable.toWeb(...)`) — never buffered to a temp file first.
- **No local disk fallback exists** for either provider — if Drive/YouTube
  credentials are missing or the API call fails, the operation fails with
  a clear error (brief section 10); it never silently falls back to
  writing the file locally instead.

Nothing to clean up, because nothing temporary is ever written in the
first place.

## 6. Disk budget (200GB VPS, shared with hoinghi + daotaohsv)

This app's own footprint, sized to stay small and mostly flat over time
(media isn't counted — section 5). Numbers are a starting **budget**, not
a guarantee — check real usage with `du -sh` after the first few weeks
and adjust `BACKUP_RETENTION_DAYS`/log rotation if any line grows faster
than expected. Also run `df -h` and `du -sh /opt/hoinghi /opt/daotaohsv`
once (section 0) to see how much of the 200GB the other two apps already
use before assuming the remainder below is actually free.

Ordered to match brief section 14's own list exactly (OS, Docker, Next
build, PostgreSQL, logs, cache, temporary files, existing training
platform), so every named category has an explicit answer — including
the two that are "not applicable to this app" rather than silently
omitted:

| Item (brief's own category) | Budget | Notes |
|---|---|---|
| **OS** | ~2–4 GB, VPS-wide | Not this app's to budget — already there before this app arrives, shared with `hoinghi`/`daotaohsv`. Run `df -h` / `du -sh /` on the real VPS (section 0) for the actual number. |
| **Docker** | **0 GB for this app** | This app does not use Docker — deployed directly via PM2/systemd (section 2), no container needed for one Node process on one VPS. If `hoinghi`/`daotaohsv` run Docker, their image/layer cache is their own cost, not this app's — run `docker system df` on the VPS if it's installed to see that separately. |
| **Next build** (`.next` build output + `node_modules`) | 2–3 GB | `npm ci --omit=dev` in production if disk-constrained; keep only the current + one previous release directory if using a release-per-deploy layout. |
| **PostgreSQL** (this app's database only) | 5–10 GB | Text/metadata only — no media rows ever store bytes, so this stays small even at tens of thousands of articles. |
| **Logs** (PM2/systemd + this app's own, e.g. the backup cron's log) | ~1 GB | Capped by log rotation — see docs/OPERATIONS.md. |
| **Cache** (`.next/cache` — ISR/build cache) | 1–2 GB | Next.js's own incremental cache; safe to delete and let it rebuild if it ever needs reclaiming. |
| **Temporary files** | **0 GB** | Upload buffers are in-memory only, never written to disk — see section 5. Nothing to clean up because nothing temporary is ever created. |
| **Existing training platform** (`/opt/daotaohsv`) + `/opt/hoinghi` | out of this app's control, **verify with section 0** | This budget is deliberately small precisely so it doesn't compete with either. |
| Database backups (`scripts/backupDatabase.sh` output — not one of the 8 named categories, but a real line item) | ~1–2 GB | `BACKUP_RETENTION_DAYS` (default 14) × average dump size; dumps are small since the DB itself is small. |
| **This app's own total** (Next build + PostgreSQL + logs + cache + backups; OS/Docker/existing platform excluded — not this app's footprint) | **~10–18 GB** | |
| Reserved headroom (never let real usage exceed ~80% of the disk) | 40+ GB | Standard operational floor — Postgres and PM2 both behave badly on a full disk. |

## 7. First deploy

1. Run section 0's checks; provision the app directory, Linux user,
   PM2/systemd unit (sections 2–3).
2. Copy `.env.example` to `.env`, fill in real values — `DATABASE_URL`
   (section 4), Google Drive/YouTube credentials (docs/GOOGLE_DRIVE_MEDIA.md,
   docs/YOUTUBE_INTEGRATION.md), `SOURCE_CREDENTIAL_ENCRYPTION_KEY`/
   `YOUTUBE_TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32` each — two
   *different* random values, never reused between them, see
   docs/SECURITY.md). **Never commit this file** — `.gitignore` already
   blocks `.env*` except `.env.example`.
3. `npm ci`
4. `npx prisma migrate deploy` — applies every migration in
   `prisma/migrations/` in order. **Never run `prisma migrate dev` or
   `prisma db seed` against production** — the dev seed hardcodes three
   publicly-known passwords on purpose for local development
   (`prisma/seed.ts`'s own header comment); running it against a real
   database would create those same accounts there.
5. Create the first Admin account via the bootstrap script — **not** the
   dev seed:
   ```bash
   ADMIN_EMAIL="admin@your-domain.vn" npm run db:bootstrap-admin
   ```
   This prints a randomly-generated password exactly once (or set
   `ADMIN_PASSWORD` yourself if you'd rather choose it). See
   docs/SECURITY.md, "Admin account bootstrap" for the full guarantees
   this script makes (no hardcoded password, refuses to run twice by
   default).
6. `npm run build`
7. Start the process (PM2 `pm2 start` / systemd `systemctl start`, section 2).
8. Confirm `GET /api/health` returns `{"status":"ok"}` through the reverse
   proxy, then log in as the bootstrapped Admin and change the password
   immediately (`/admin/profile`).
9. Set up the daily backup cron and audit log retention cron — see
   docs/BACKUP_RESTORE.md and docs/OPERATIONS.md.

## 8. Subsequent deploys

Every deploy must pass the CI gate first (`.github/workflows/ci.yml` —
type check, lint, migration-apply check against a fresh database, test
suite, build — brief section 12: "Không deploy nếu build fail, type fail,
lint fail, migration fail"). Once CI is green on `main`:

```bash
cd /opt/congthongtin/web
git pull
npm ci
npx prisma migrate deploy   # no-op if there's nothing new to apply
npm run build
pm2 restart congthongtin    # or: systemctl restart congthongtin
```

`prisma migrate deploy` before `npm run build` matters: `next build`'s
static generation queries the real database (`NODE_ENV=production`
forces `DatabaseProvider`, `src/data-access/index.ts`) — building against
a schema the running migrations haven't caught up to yet would generate
pages against stale/missing columns.

## 9. Environments

See docs/ENVIRONMENT.md for the full variable reference and
docs/OPERATIONS.md, "Environments" for how dev/staging/production differ
in practice (each is just a different `.env` file / `DATABASE_URL` —
nothing about the app's code branches on which environment it's in,
except `NODE_ENV`/`CONTENT_PROVIDER` already documented in
`src/data-access/index.ts`).
