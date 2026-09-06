#!/usr/bin/env bash
# Production readiness task, brief sections 5 & 15: "PostgreSQL... Backup
# hằng ngày" / "Database backup." Meant to run from cron once a day (see
# docs/BACKUP_RESTORE.md for the crontab line) — plain shell + `pg_dump`,
# no Node/npm dependency, so it still runs even if the app itself is down.
#
# Brief section 15's other half — "Không backup Google Drive media ngược
# về VPS" — is satisfied by construction: this script only ever touches
# PostgreSQL. Media lives in Google Drive/YouTube (docs/DEPLOYMENT.md,
# "Media storage"), which already has its own durability guarantees outside
# this app's control; pulling it onto the VPS "for backup" would be the
# exact persistent-media footprint brief section 6/14 says to avoid.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-"$SCRIPT_DIR/../.env"}"

# Load DATABASE_URL (and anything else) from .env if it's not already an
# exported environment variable — `set -a` marks every variable sourced
# from the file for export, matching how `dotenv/config` behaves elsewhere
# in this app, and correctly handles the quoted values `.env.example` uses
# (e.g. `DATABASE_URL="postgresql://..."`) unlike `export $(grep ...)`.
if [ -z "${DATABASE_URL:-}" ] && [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (checked the environment and $ENV_FILE) — aborting backup." >&2
  exit 1
fi

# Defaults assume the `/opt/congthongtin` layout docs/DEPLOYMENT.md
# suggests — override both if a different app name/directory was chosen
# on the actual VPS (which already runs `hoinghi`/`daotaohsv` as siblings,
# so this prefix also keeps dump filenames unambiguous if backups from
# multiple apps ever land in the same place).
BACKUP_DIR="${BACKUP_DIR:-/var/backups/congthongtin}"
BACKUP_PREFIX="${BACKUP_PREFIX:-congthongtin}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/${BACKUP_PREFIX}-${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# `DATABASE_URL`'s `?schema=...` query param is a Prisma-only convention —
# libpq (what `pg_dump`/`psql` link against) rejects it outright ("invalid
# URI query parameter: schema"). Strip just that one param, not the whole
# query string, so a real libpq param someone adds later (`sslmode=...`)
# still reaches `pg_dump` untouched.
PG_URL="$(echo "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"

# `--no-owner --no-privileges`: a restore onto a different Postgres role
# (a fresh VPS, a different DB user) must not fail on `ALTER ... OWNER TO`/
# `GRANT` statements for a role that doesn't exist there. Write to a
# `.partial` name first and `mv` into place atomically, so a crash or a
# killed cron job mid-dump never leaves a truncated file with the real
# `.sql.gz` name that a later restore might pick up by mistake.
pg_dump --no-owner --no-privileges --format=plain "$PG_URL" | gzip -9 > "${OUT_FILE}.partial"
mv "${OUT_FILE}.partial" "$OUT_FILE"

echo "Backup written to $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Rotate: brief section 14's disk budget for "backups" is finite — keep
# only the last $RETENTION_DAYS days' worth, matching docs/BACKUP_RESTORE.md.
find "$BACKUP_DIR" -maxdepth 1 -name "${BACKUP_PREFIX}-*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete
