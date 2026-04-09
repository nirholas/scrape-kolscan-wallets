import { NextResponse } from "next/server";

const LLMS_FULL_TXT = `# KolQuest — Full Documentation

> Smart wallet intelligence platform. Track the most profitable crypto wallets across KolScan KOLs and GMGN smart money on Solana and BSC chains.

Website: https://kol.quest
GitHub: https://github.com/nirholas/kol-quest

---

## REST API Reference

Self-hosted Bun server. All endpoints return JSON with CORS enabled.

### Setup

\`\`\`bash
bun api/index.ts          # default port 3002
API_PORT=8080 bun api/index.ts  # custom port
\`\`\`

---

### GET /health

Health check. Returns counts for each data source.

Response:
\`\`\`json
{
  "status": "ok",
  "kolscan": { "entries": 1304, "wallets": 472 },
  "gmgn_sol": { "wallets": 500 },
  "gmgn_bsc": { "wallets": 200 }
}
\`\`\`

---

### GET /api/leaderboard

Paginated KolScan KOL leaderboard with search, sorting, and timeframe filtering.

Parameters:
- timeframe (number): 1 = daily, 7 = weekly, 30 = monthly. Omit for all.
- sort (string): profit | wins | losses | winrate | name. Default: profit
- order (string): asc | desc. Default: desc
- page (number): Page number, 1-indexed. Default: 1
- limit (number): Results per page, max 500. Default: 50
- search (string): Filter by name or wallet address.

Response:
\`\`\`json
{
  "data": [
    {
      "wallet_address": "CyaE...",
      "name": "Cented",
      "twitter": "https://twitter.com/...",
      "telegram": null,
      "profit": 142.5,
      "wins": 89,
      "losses": 34,
      "timeframe": 1
    }
  ],
  "total": 434,
  "page": 1,
  "totalPages": 9
}
\`\`\`

---

### GET /api/wallets

List all unique KolScan wallet addresses.

Response:
\`\`\`json
{ "wallets": ["CyaE...", "Bi4r..."], "total": 472 }
\`\`\`

---

### GET /api/wallet/:address

Detailed stats for a specific KolScan wallet — profit, rankings, per-timeframe data.

Response:
\`\`\`json
{
  "wallet_address": "CyaE...",
  "name": "Cented",
  "twitter": "https://twitter.com/...",
  "telegram": null,
  "stats": {
    "total_profit": 350.2,
    "total_wins": 245,
    "total_losses": 89,
    "total_trades": 334,
    "win_rate": 73.4
  },
  "rankings": [
    { "timeframe": 1, "rank": 3, "total": 434, "profit": 142.5, "wins": 89, "losses": 34 }
  ],
  "timeframes": [...]
}
\`\`\`

---

### GET /api/top

Top KOLs for a given timeframe.

Parameters:
- timeframe (number): 1 | 7 | 30. Default: 1
- sort (string): Sort field. Default: profit
- limit (number): Max results, 1-100. Default: 10

---

### GET /api/stats

Aggregate KolScan statistics.

Response:
\`\`\`json
{
  "total_entries": 1304,
  "total_wallets": 472,
  "timeframes": [1, 7, 30],
  "daily_entries": 434,
  "top_daily": { "name": "Cented", "wallet": "CyaE...", "profit": 142.5 }
}
\`\`\`

---

### GET /api/export/gmgn

All wallets formatted for GMGN bulk import.

Response:
\`\`\`json
[
  { "address": "CyaE...", "label": "Cented" },
  { "address": "Bi4r...", "label": "theo" }
]
\`\`\`

---

### GET /api/gmgn/sol

Solana GMGN smart money wallets.

Parameters:
- sort (string): realized_profit_7d | realized_profit_1d | realized_profit_30d | winrate_7d | buy_7d. Default: realized_profit_7d
- order (string): asc | desc. Default: desc
- page (number): Page number. Default: 1
- limit (number): Results per page, max 500. Default: 50
- category (string): smart_degen | kol | snipe_bot | launchpad_smart | fresh_wallet | live | top_followed | top_renamed
- search (string): Search by name, address, or twitter.

Response:
\`\`\`json
{
  "data": [
    {
      "wallet_address": "...",
      "name": "whale_01",
      "twitter_username": "whale01",
      "category": "smart_degen",
      "chain": "sol",
      "realized_profit_1d": 12.5,
      "realized_profit_7d": 85.2,
      "realized_profit_30d": 340.1,
      "buy_7d": 45,
      "sell_7d": 38,
      "winrate_7d": 0.72,
      "tags": ["smart_money"],
      "balance": 150.5,
      "follow_count": 1200
    }
  ],
  "total": 500,
  "page": 1,
  "totalPages": 10
}
\`\`\`

---

### GET /api/gmgn/bsc

BSC GMGN smart money wallets. Same parameters and response format as /api/gmgn/sol.

---

### GET /api/gmgn/wallet/:address

Detailed GMGN data for a specific wallet. Returns full profit, trades, win rates, tags, category across all chains.

---

### GET /api/gmgn/categories

List wallet categories and counts for a chain.

Parameters:
- chain (string): sol | bsc. Default: sol

Response:
\`\`\`json
{
  "chain": "sol",
  "categories": {
    "smart_degen": 120,
    "kol": 85,
    "snipe_bot": 45,
    "fresh_wallet": 30
  }
}
\`\`\`

---

### GET /api/gmgn/stats

GMGN aggregate stats with top 3 performers per chain.

---

## MCP Server Reference

Model Context Protocol server for AI assistants. Communicates over JSON-RPC via stdio.

### Setup

\`\`\`bash
# Run directly
bun mcp/index.ts

# Claude Desktop configuration (~/.config/claude/claude_desktop_config.json)
{
  "mcpServers": {
    "kolquest": {
      "command": "bun",
      "args": ["mcp/index.ts"],
      "cwd": "/path/to/kol-quest"
    }
  }
}
\`\`\`

---

### Tool: kolscan_leaderboard

Get KolScan KOL leaderboard. Returns wallets ranked by profit, win rate, or other metrics for a given timeframe.

Input:
- timeframe (number): 1 (daily), 7 (weekly), 30 (monthly). Default: 1
- sort (string): profit | wins | losses | winrate | name. Default: profit
- order (string): asc | desc. Default: desc
- limit (number): Max results, 1-100. Default: 20
- search (string): Search by name or wallet address.

Output: Array of wallets with rank, name, wallet address, profit, wins, losses, winrate, twitter.

---

### Tool: kolscan_wallet

Get detailed KolScan data for a specific wallet address.

Input:
- address (string, required): Wallet address to look up.

Output: Name, wallet, twitter, total profit, total wins/losses, win rate, per-timeframe breakdowns, links to kolscan/gmgn/solscan.

---

### Tool: gmgn_wallets

Get GMGN smart money wallets for Solana or BSC.

Input:
- chain (string): sol | bsc. Default: sol
- category (string): smart_degen | kol | snipe_bot | launchpad_smart | fresh_wallet | live | top_followed | top_renamed
- sort (string): Sort field. Default: realized_profit_7d
- order (string): asc | desc. Default: desc
- limit (number): Max results, 1-100. Default: 20
- search (string): Search by name, address, or twitter.

Output: Array of wallets with rank, name, wallet, category, tags, profit (1d/7d/30d), buys/sells, winrate, twitter link.

---

### Tool: gmgn_wallet_detail

Get detailed GMGN data for a specific wallet address.

Input:
- address (string, required): Wallet address to look up.

Output: Full wallet profile — name, chain, category, tags, twitter, balance, follow count, profit by timeframe, trade counts, win rates, explorer links.

---

### Tool: wallet_stats

Get aggregate statistics across all data sources.

Input: None.

Output: KolScan unique wallets + entries, GMGN Solana/BSC wallet counts with category breakdowns, combined totals.

---

### Tool: search_wallets

Search across all data sources (KolScan + GMGN Solana + GMGN BSC).

Input:
- query (string, required): Search query (name, address, or twitter handle).
- limit (number): Max results. Default: 20

Output: Array of matches with source, chain, name, wallet, profit, twitter.

---

## Data Schema

### KolScan Entry

| Field | Type | Description |
|-------|------|-------------|
| wallet_address | string | Solana wallet address |
| name | string | KOL display name |
| twitter | string\\|null | Twitter/X profile URL |
| telegram | string\\|null | Telegram channel URL |
| profit | number | Profit in SOL |
| wins | number | Winning trades |
| losses | number | Losing trades |
| timeframe | number | 1 = Daily, 7 = Weekly, 30 = Monthly |

### GMGN Wallet

| Field | Type | Description |
|-------|------|-------------|
| wallet_address | string | Wallet address |
| name | string | Display name |
| twitter_username | string\\|null | Twitter handle |
| category | string | Wallet category (smart_degen, kol, etc.) |
| chain | string | sol or bsc |
| realized_profit_1d | number | 1-day realized profit |
| realized_profit_7d | number | 7-day realized profit |
| realized_profit_30d | number | 30-day realized profit |
| buy_1d / buy_7d / buy_30d | number | Buy counts by timeframe |
| sell_1d / sell_7d / sell_30d | number | Sell counts by timeframe |
| winrate_7d | number | 7-day win rate (0-1) |
| winrate_30d | number | 30-day win rate (0-1) |
| tags | string[] | Wallet tags |
| balance | number | Current balance |
| follow_count | number | GMGN follow count |
`;

export async function GET() {
  return new NextResponse(LLMS_FULL_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
