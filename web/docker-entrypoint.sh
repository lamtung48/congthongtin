#!/bin/sh
# Runs on every container start (see web/Dockerfile for why the build can't
# happen at image-build time).
set -e
cd /app/web

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
tries=0
until npx prisma migrate deploy; do
  tries=$((tries + 1))
  if [ "$tries" -ge 30 ]; then
    echo "[entrypoint] migrate deploy still failing after $tries attempts — giving up." >&2
    exit 1
  fi
  echo "[entrypoint] database not ready yet (attempt $tries) — retrying in 2s..."
  sleep 2
done

# Rebuild only when tracked source changed since the last successful build.
# .next is a named volume, so a plain `docker restart` skips straight to start.
SRC_HASH=$(find src prisma public next.config.ts prisma.config.ts package-lock.json postcss.config.mjs tsconfig.json -type f 2>/dev/null \
  | sort | xargs sha1sum | sha1sum | cut -c1-40)

if [ ! -f .next/BUILD_ID ] || [ "$(cat .next/.src-hash 2>/dev/null)" != "$SRC_HASH" ]; then
  echo "[entrypoint] Source changed (or no prior build) — running 'npm run build' (a few minutes)..."
  npm run build
  printf '%s' "$SRC_HASH" > .next/.src-hash
  echo "[entrypoint] Build complete."
else
  echo "[entrypoint] Existing .next build matches current source — skipping build."
fi

echo "[entrypoint] Starting app: $*"
exec "$@"
