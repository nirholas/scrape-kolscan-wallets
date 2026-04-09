import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/drizzle/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: { status: "ok" | "error"; latencyMs?: number; error?: string };
    upstash?: { status: "ok" | "error" | "not_configured"; error?: string };
  };
}

export async function GET() {
  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
    checks: {
      database: { status: "ok" },
    },
  };

  // Check database
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    health.checks.database.latencyMs = Date.now() - dbStart;
  } catch (err) {
    health.checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
    health.status = "unhealthy";
  }

  // Check Upstash Redis (if configured)
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const res = await fetch(`${upstashUrl}/ping`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      if (res.ok) {
        health.checks.upstash = { status: "ok" };
      } else {
        health.checks.upstash = { status: "error", error: `HTTP ${res.status}` };
        health.status = "degraded";
      }
    } catch (err) {
      health.checks.upstash = {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      };
      health.status = "degraded";
    }
  } else {
    health.checks.upstash = { status: "not_configured" };
  }

  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
