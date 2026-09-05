// Prisma 7 CLI configuration — connection URLs and the seed command live
// here, not in schema.prisma (see docs/ENVIRONMENT.md).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `directUrl` isn't part of this Prisma version's `datasource` config
  // shape (confirmed against the installed `prisma/config` types, not
  // assumed) — only `url` and `shadowDatabaseUrl` are supported here today.
  // See docs/ENVIRONMENT.md for what `DIRECT_DATABASE_URL` in `.env.example`
  // is reserved for once a connection pooler makes it necessary.
  datasource: {
    url: process.env["DATABASE_URL"],
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
