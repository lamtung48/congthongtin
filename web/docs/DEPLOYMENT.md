# Deployment — VPS production topology

Production readiness task. Target: **one existing shared VPS (~200GB)**
that already runs a training platform (nền tảng tập huấn/đào tạo) — this
app is a new tenant on that box, not a fresh dedicated server. Everything
here is written with that constraint in mind: isolate this app's own
processes/ports/logs/database from the existing platform, and keep this
app's own disk footprint small and mostly bounded (media is ~0GB
persistent — see section 5).

## 1. Topology

```
Internet
   │  HTTPS (443)
   ▼
Reverse proxy (nginx, already on the VPS for the training platform —
add one more server block, don't run a second nginx)
   │  proxy_pass, plain HTTP, localhost only
   ▼
Next.js app (this repo) — one Node.js process, `next start`,
listening on 127.0.0.1:<PORT>, managed by PM2 or systemd
   │
   ├──▶ PostgreSQL (own database, can share the VPS's existing Postgres
   │     server instance if the training platform already runs one — see
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
`/srv/hsv-portal/web` and runs as its own unprivileged Linux user
(`hsv-portal`, not root, and not the training platform's own service
user — keeps file permissions and crash blast radius separate).

### PM2

```js
// /srv/hsv-portal/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "hsv-portal",
      cwd: "/srv/hsv-portal/web",
      script: "npm",
      args: "start",
      instances: 1, // see "Single process, not a cluster" above — never change this
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3001", // pick a port that doesn't collide with the training platform
      },
      max_memory_restart: "768M", // video upload buffers the whole file in RAM (up to 200MB) — see docs/OPERATIONS.md, "Memory"
      out_file: "/var/log/hsv-portal/out.log",
      error_file: "/var/log/hsv-portal/error.log",
      time: true,
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js
pm2 save            # persist across reboots
pm2 startup         # one-time: installs the systemd unit that restarts PM2 itself on boot
```

### systemd (alternative to PM2)

```ini
# /etc/systemd/system/hsv-portal.service
[Unit]
Description=HSV Portal (Next.js)
After=network.target postgresql.service

[Service]
Type=simple
User=hsv-portal
WorkingDirectory=/srv/hsv-portal/web
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=/srv/hsv-portal/web/.env
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
systemctl enable --now hsv-portal
```

## 3. Reverse proxy (nginx)

Add a new `server` block to the VPS's existing nginx config — do not run
a second nginx instance. Brief section 8's security headers are set by
this app itself (`next.config.ts`'s `headers()` — see docs/SECURITY.md),
so nginx's job here is TLS termination, forwarding the real client IP
(the login rate limiter and audit log both read
`x-forwarded-for` — `src/server/auth/session.ts`), and raising the body
size limit for video uploads (`docs/YOUTUBE_INTEGRATION.md` caps a
video at 200MB in the app itself; nginx's own default 1MB limit would
reject the request before it ever reaches Next.js).

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.vn;

    ssl_certificate     /etc/letsencrypt/live/your-domain.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.vn/privkey.pem;

    client_max_body_size 210m; # 200MB video cap + headroom for multipart overhead

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name your-domain.vn;
    return 301 https://$host$request_uri;
}
```

TLS certificates: `certbot --nginx -d your-domain.vn` (Let's Encrypt),
with its own systemd timer for auto-renewal — standard, not specific to
this app.

## 4. Database

A dedicated PostgreSQL **database**, not necessarily a dedicated
PostgreSQL **server** — if the VPS's training platform already runs
Postgres, reuse that server process and just create a new database +
role for this app (`CREATE DATABASE hsv_portal; CREATE ROLE hsv_portal
LOGIN PASSWORD '...'; GRANT ALL ON DATABASE hsv_portal TO hsv_portal;`).
Running a second `postgresql` service would waste both memory and the
disk budget in section 6 for no isolation benefit Postgres' own
role/database separation doesn't already give.

**Not exposed to the public Internet** (brief section 5): Postgres should
bind to `127.0.0.1` (or a private/VPC interface if the app and DB are ever
split across hosts) — `listen_addresses = 'localhost'` in
`postgresql.conf`, and `pg_hba.conf` should not have a `host ... 0.0.0.0/0`
line for this role. The app connects over `DATABASE_URL` on localhost;
nothing about this app needs the database reachable from outside the VPS
at all.

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

## 6. Disk budget (200GB shared VPS)

This app's own footprint, sized to stay small and mostly flat over time
(media isn't counted — section 5). Numbers are a starting **budget**, not
a guarantee — check real usage with `du -sh` after the first few weeks
and adjust `BACKUP_RETENTION_DAYS`/log rotation if any line grows faster
than expected.

| Item | Budget | Notes |
|---|---|---|
| App repo (`node_modules` + `.next` build output) | 2–3 GB | `npm ci --omit=dev` in production if disk-constrained; keep only the current + one previous release directory if using a release-per-deploy layout |
| PostgreSQL data (this app's database only) | 5–10 GB | Text/metadata only — no media rows ever store bytes, so this stays small even at tens of thousands of articles |
| Application logs (PM2/systemd + this app's own) | ~1 GB | Capped by log rotation — see docs/OPERATIONS.md |
| Database backups (`scripts/backupDatabase.sh` output) | ~1–2 GB | `BACKUP_RETENTION_DAYS` (default 14) × average dump size; dumps are small since the DB itself is small |
| `.next/cache` (ISR/build cache) | 1–2 GB | Next.js's own incremental cache; safe to delete and let it rebuild if it ever needs reclaiming |
| Temporary upload buffers | **0 GB** | In-memory only — see section 5 |
| **This app's total** | **~10–18 GB** | |
| Reserved headroom (never let real usage exceed ~80% of the disk) | 40+ GB | Standard operational floor — Postgres and PM2 both behave badly on a full disk |
| Existing training platform + OS + everything else on the VPS | remainder (~140–150 GB) | Out of this app's control — this budget is deliberately small precisely so it doesn't compete with that |

## 7. First deploy

1. Provision the app directory, Linux user, PM2/systemd unit (sections 2–3).
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
cd /srv/hsv-portal/web
git pull
npm ci
npx prisma migrate deploy   # no-op if there's nothing new to apply
npm run build
pm2 restart hsv-portal      # or: systemctl restart hsv-portal
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
