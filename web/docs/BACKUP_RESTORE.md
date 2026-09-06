# Backup & Restore

Production readiness task, brief sections 5 & 15: "PostgreSQL... Backup
hằng ngày. Restore documentation" / "Database backup. Không backup Google
Drive media ngược về VPS."

## What is, and isn't, backed up

- **PostgreSQL is backed up.** It holds every piece of content this app
  is the source of truth for: articles, users, sessions, audit logs,
  homepage configuration, Source/Social Inbox rows, everything.
- **Google Drive/YouTube media is deliberately NOT pulled onto this VPS
  for backup.** Every uploaded image lives in Google Drive; every video
  lives on YouTube (docs/DEPLOYMENT.md, section 5). Those platforms
  already have their own durability guarantees, outside this app's
  control — copying that media onto the VPS "just in case" would
  reintroduce exactly the persistent-media footprint brief sections 6/14
  say to avoid, for content this app doesn't own the source-of-truth copy
  of anyway. If Drive/YouTube access is ever lost, that's a Google-account
  recovery problem, not something a VPS-side backup could have prevented.
  What Postgres backs up instead is the *reference* to that media
  (`MediaAsset.providerFileId` etc.) — enough to know which Drive
  file/YouTube video an article's image/video block points at, which is
  the only part this app is responsible for.

## Daily backup

`scripts/backupDatabase.sh` — plain shell (`pg_dump` + `gzip`), no
Node/npm dependency, so it still runs even if the app process itself is
down. Reads `DATABASE_URL` from the real environment or from `.env` next
to it, dumps with `--no-owner --no-privileges` (so a restore onto a
different Postgres role never fails on `ALTER ... OWNER TO`), writes
atomically (`.partial` → `mv`), and rotates anything older than
`BACKUP_RETENTION_DAYS` (default 14).

**Set up the daily cron** (as the `congthongtin` user, not root — see
docs/DEPLOYMENT.md for why this app runs as its own user, distinct from
the VPS's existing `hoinghi`/`daotaohsv` apps):

```bash
sudo crontab -u congthongtin -e
# Run every day at 02:15 server time, log output for troubleshooting.
15 2 * * * /opt/congthongtin/web/scripts/backupDatabase.sh >> /var/log/congthongtin/backup.log 2>&1
```

Environment variables `backupDatabase.sh` respects:

| Variable | Default | Meaning |
|---|---|---|
| `BACKUP_DIR` | `/var/backups/congthongtin` | Where dumps are written |
| `BACKUP_PREFIX` | `congthongtin` | Filename prefix — keeps dumps unambiguous if backups from `hoinghi`/`daotaohsv` ever land in a shared location |
| `BACKUP_RETENTION_DAYS` | `14` | Older dumps are deleted after each run |
| `ENV_FILE` | `<script dir>/../.env` | Where to read `DATABASE_URL` from if it's not already exported |

Verified this task: ran end-to-end against the real dev database,
produced a valid `.sql.gz`, and the rotation `find ... -delete` correctly
targets only files matching this script's own naming pattern.

**Run it manually any time**: `npm run db:backup` (from `web/`), or
`./scripts/backupDatabase.sh` directly.

## Restore

`scripts/restoreDatabase.sh` — the executable half of this document.
Destructive by nature (overwrites existing data in the target database),
so it refuses to run without an explicit `--yes-i-am-sure` flag:

```bash
./scripts/restoreDatabase.sh --yes-i-am-sure /var/backups/congthongtin/congthongtin-20260101T021500Z.sql.gz
```

What it does: `gunzip -c <file> | psql "$DATABASE_URL"` (with the same
Prisma-only `?schema=` query-param strip `backupDatabase.sh` needs, since
libpq rejects that param outright). Afterward, run
`npx prisma migrate status` to confirm the restored schema matches the
migrations this app's current code expects — a backup taken before a
schema migration will be missing tables/columns a newer app version
expects, and that command tells you exactly that.

Verified this task: restored a real dump into a fresh throwaway database
and confirmed row counts matched the source exactly (31 `Article` rows on
both sides).

### Full disaster-recovery sequence (fresh VPS / fresh database)

1. Provision the new database (docs/DEPLOYMENT.md, section 4).
2. `npx prisma migrate deploy` — brings the empty database up to the
   current schema.
3. Restore the latest backup: `./scripts/restoreDatabase.sh
   --yes-i-am-sure <latest-backup>.sql.gz`.
4. `npx prisma migrate status` — confirm clean.
5. Point `DATABASE_URL` at the restored database, start the app
   (docs/DEPLOYMENT.md, section 2).
6. Spot-check `/admin/dashboard` renders and a known article/user exists.

### What restoring does NOT bring back

Media itself — Google Drive/YouTube content is untouched by any of this
(it was never copied to the VPS to begin with). A restored database will
correctly reference the same Drive files/YouTube videos it did before,
as long as those accounts/credentials are still valid; if a Google Drive
service account or YouTube OAuth connection needs to be re-authorized
after a long outage, that's a separate step covered in
docs/GOOGLE_DRIVE_MEDIA.md/docs/YOUTUBE_INTEGRATION.md, not part of a
database restore.
