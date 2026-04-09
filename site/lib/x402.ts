/**
 * x402 payment configuration for KolQuest API routes.
 *
 * Agents and programmatic consumers pay $0.01 USDC per request (Base mainnet).
 * Authenticated web-app users (session cookie present) bypass payment.
 *
 * To change the payment address set X402_PAYMENT_ADDRESS in the environment.
 * To disable x402 entirely set X402_ENABLED=false.
 */

export const X402_ENABLED = process.env.X402_ENABLED !== "false";

/** USDC recipient on Base mainnet. Falls back to hardcoded default. */
export const X402_PAYMENT_ADDRESS =
  (process.env.X402_PAYMENT_ADDRESS as `0x${string}`) ||
  "0x40252CFDF8B20Ed757D61ff157719F33Ec332402";

/** Per-route pricing — $0.01 USDC on Base mainnet for every data endpoint. */
export const X402_ROUTES = {
  "/api/wallets": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/leaderboard": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/trades": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/smart-money": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/x-tracker": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/portfolio": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/scanner": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/x-profiles": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/trending": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/search": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/token": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/proxy/solana": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/proxy/evm": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/proxy/market": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/proxy/analytics": { price: "$0.01" as const, network: "base-mainnet" as const },
  "/api/proxy/unified": { price: "$0.01" as const, network: "base-mainnet" as const },
} as const;

/** Route prefixes that are subject to x402 gating. */
export const X402_GATED_PREFIXES = Object.keys(X402_ROUTES);

/** Returns true if the given pathname should be gated by x402. */
export function isX402GatedRoute(pathname: string): boolean {
  if (!X402_ENABLED) return false;
  return X402_GATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
