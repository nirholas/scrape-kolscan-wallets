import { NextResponse } from "next/server";

const LLMS_TXT = `# KolQuest

> Smart wallet intelligence — track the most profitable crypto wallets across KolScan and GMGN on Solana & BSC.

## Docs

- [API & MCP Docs](https://kol.quest/docs): REST API reference, MCP server integration, and technical writeup.
- [llms-full.txt](https://kol.quest/llms-full.txt): Full machine-readable documentation for LLMs.

## API

Base URL: \`http://localhost:3002\` (self-hosted via \`bun api/index.ts\`)

### KolScan Endpoints
- GET /health — Health check with data counts
- GET /api/leaderboard — Paginated KOL leaderboard (params: timeframe, sort, order, page, limit, search)
- GET /api/wallets — List unique wallet addresses
- GET /api/wallet/:address — Detailed stats for a wallet
- GET /api/top — Top KOLs by timeframe (params: timeframe, sort, limit)
- GET /api/stats — Aggregate statistics
- GET /api/export/gmgn — Wallets formatted for GMGN import

### GMGN Endpoints
- GET /api/gmgn/sol — Solana smart money wallets (params: sort, order, page, limit, category, search)
- GET /api/gmgn/bsc — BSC smart money wallets (same params)
- GET /api/gmgn/wallet/:address — Detailed GMGN wallet data
- GET /api/gmgn/categories — Category breakdown (params: chain)
- GET /api/gmgn/stats — GMGN aggregate stats

## MCP Server

JSON-RPC over stdio. Run: \`bun mcp/index.ts\`

### Tools
- kolscan_leaderboard — KOL leaderboard by profit, win rate, etc.
- kolscan_wallet — Detailed data for a specific KolScan wallet
- gmgn_wallets — GMGN smart money wallets (Solana or BSC)
- gmgn_wallet_detail — Detailed GMGN wallet data
- wallet_stats — Aggregate stats across all sources
- search_wallets — Cross-source search by name, address, or twitter

## Optional

- [Leaderboard](https://kol.quest/leaderboard)
- [Solana Wallets](https://kol.quest/gmgn-sol)
- [BSC Wallets](https://kol.quest/bsc)
- [Community](https://kol.quest/community)
- [GitHub](https://github.com/nirholas/kol-quest)
`;

export async function GET() {
  return new NextResponse(LLMS_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
