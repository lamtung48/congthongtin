# syntax=docker/dockerfile:1

# Cong thong tin so HSV — Next.js 16 (App Router) + Prisma 7 + PostgreSQL.
#
# `next build` for this app queries the real database during static
# generation (NODE_ENV=production forces DatabaseProvider — see
# src/data-access/index.ts and docs/DEPLOYMENT.md section 8), so the build
# cannot run inside this Dockerfile where no database is reachable. Instead
# the image ships the full source + all dependencies, and
# docker-entrypoint.sh runs `prisma migrate deploy` then `next build` on
# container start (rebuilding only when the source actually changed — the
# .next directory is a named volume, so ordinary restarts are fast).
FROM node:22-bookworm-slim

# openssl: required by the Prisma query engine. tini: correct PID 1 signal
# handling so `docker stop` shuts Next.js down cleanly. git + openssh-client
# + GitHub's host key: `npm ci` fetches the private git dependency
# @hsv/membership-card (Thẻ Hội viên, shared with Hoạt động / Đào tạo) over
# SSH — see the `--mount=type=ssh` below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl tini ca-certificates git openssh-client \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p -m 0700 /root/.ssh \
    && ssh-keyscan github.com >> /root/.ssh/known_hosts

ENV NODE_ENV=production
WORKDIR /app/web

# Dependencies first (better layer caching). --ignore-scripts because the
# `postinstall` (`prisma generate`) needs prisma/schema.prisma, which isn't
# copied yet; it's run explicitly below once the source is present.
# The read-only deploy key of lamtung48/hsv-membership-card is forwarded by
# BuildKit for this one step only (`build.ssh` in docker-compose.yml) — it is
# never written into any image layer. Same setup as /opt/daotaohsv.
COPY web/package.json web/package-lock.json ./
RUN --mount=type=ssh npm ci --include=dev --ignore-scripts

# Application source.
COPY web/ ./

# Generate the Prisma client into node_modules now that the schema exists.
RUN npx prisma generate

RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
CMD ["npm", "start"]
