#!/usr/bin/env bash
# Production readiness task, brief section 5: "Restore documentation" —
# this is the executable half of that; docs/BACKUP_RESTORE.md is the
# narrative half (read that first if this is your first restore).
#
# Destructive by nature (drops and recreates every table in the target
# database), so it refuses to run without an explicit `--yes-i-am-sure`
# flag — no interactive prompt, since this is meant to be runnable
# unattended too, but a human must have deliberately typed the flag.
set -euo pipefail

usage() {
  echo "Usage: $0 --yes-i-am-sure <path-to-backup.sql.gz>" >&2
  echo "Restores a backup produced by scripts/backupDatabase.sh into DATABASE_URL." >&2
  exit 1
}

CONFIRMED=false
BACKUP_FILE=""
for arg in "$@"; do
  case "$arg" in
    --yes-i-am-sure) CONFIRMED=true ;;
    *) BACKUP_FILE="$arg" ;;
  esac
done

if [ "$CONFIRMED" != "true" ] || [ -z "$BACKUP_FILE" ]; then
  usage
fi
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-"$SCRIPT_DIR/../.env"}"
if [ -z "${DATABASE_URL:-}" ] && [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (checked the environment and $ENV_FILE) — aborting restore." >&2
  exit 1
fi

# Same `schema` query-param strip as backupDatabase.sh — libpq rejects it.
PG_URL="$(echo "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"

echo "Restoring $BACKUP_FILE into the database at DATABASE_URL. This OVERWRITES existing data."
gunzip -c "$BACKUP_FILE" | psql "$PG_URL"

echo "Restore complete. Run 'npx prisma migrate status' next to confirm the schema matches this app's current migrations."
