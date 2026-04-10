/**
 * x402 payment configuration for KolQuest API routes.
 *
 * ALL /api/* routes are gated by default — $0.01 USDC per request on Base mainnet.
 * Any new route added under /api/ is automatically gated without further changes.
 * Authenticated web-app users (session cookie present) bypass payment.
 *
 * Exceptions (always free, no x402 required) — see X402_FREE_PREFIXES below:
 *  - /api/auth          — Better-Auth endpoints (auth itself cannot require payment)
 *  - /api/health        — Infra health-check probe
 *  - /api/openapi.json  — OpenAPI spec for agent discoverability
 *  - /api/admin         — Admin management (session + role protected at handler level)
 *  - /api/cron          — Vercel cron jobs (protected by CRON_SECRET header)
 *  - /api/cache         — Internal cache management (admin-only at handler level)
 *  - /api/trades/ingest — Internal trade ingestion (protected by INGEST_SECRET)
 *
 * ADDING NEW API ROUTES:
 *  - Public data routes are gated automatically — no changes needed here.
 *  - If a new route must be exempt, add its prefix to X402_FREE_PREFIXES.
 *
 * To change the payment address set X402_PAYMENT_ADDRESS in the environment.
 * To disable x402 entirely set X402_ENABLED=false.
 */

export const X402_ENABLED = process.env.X402_ENABLED !== "false";

/** USDC recipient on Base mainnet. Falls back to hardcoded default. */
export const X402_PAYMENT_ADDRESS =
  (process.env.X402_PAYMENT_ADDRESS as `0x${string}`) ||
  "0x40252CFDF8B20Ed757D61ff157719F33Ec332402";

/**
 * Single wildcard route that covers every /api/* path.
 * New routes are gated automatically — no changes needed here.
 */
export const X402_ROUTES = {
  "/api/*": { price: "$0.01" as const, network: "base" as const },
} as const;

/**
 * Route prefixes that are explicitly exempt from x402 gating.
 * These are infrastructure, auth, or internal endpoints that must remain free.
 *
 * DO NOT add feature/data routes here — they should be gated.
 * Session-authenticated users already bypass x402 automatically.
 */
export const X402_FREE_PREFIXES: string[] = [
  "/api/auth",
  "/api/health",
  "/api/openapi.json",
  "/api/admin",
  "/api/cron",
  "/api/cache",
  "/api/trades/ingest",
];

/** Returns true if the given pathname should be gated by x402. */
export function isX402GatedRoute(pathname: string): boolean {
  if (!X402_ENABLED) return false;
  if (!pathname.startsWith("/api/")) return false;
  return !X402_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
