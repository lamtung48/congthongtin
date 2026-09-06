import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

/**
 * Production readiness task, brief section 10: "application health" — one
 * cheap, unauthenticated endpoint the reverse proxy (health-check probe)
 * and an uptime monitor can both poll. No session/permission check on
 * purpose: a load balancer/monitoring agent has no admin session, and this
 * endpoint reveals nothing sensitive — no stack traces, no config, no
 * counts, just "can this process reach its database right now."
 *
 * `SELECT 1` rather than any real table query: the cheapest possible round
 * trip that still proves the connection pool and the database server are
 * both actually up, not just that the Node process is running (which
 * `GET /` would already tell you, uselessly, if Postgres were down).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
