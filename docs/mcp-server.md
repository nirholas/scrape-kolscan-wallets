# MCP Server

KolQuest includes a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes wallet intelligence to AI assistants (Claude, Copilot, Cursor, etc.).

## Setup

```bash
bun mcp/index.ts
# or
npm run mcp
```

The server communicates over JSON-RPC via stdio (newline-delimited JSON on stdin/stdout).

## Claude Desktop Configuration

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kolquest": {
      "command": "bun",
      "args": ["mcp/index.ts"],
      "cwd": "/path/to/kol-quest"
    }
  }
}
```

## Available Tools

### `kolscan_leaderboard`

Get KolScan KOL leaderboard ranked by profit, win rate, or other metrics.

| Param | Type | Description | Default |
|:------|:-----|:------------|:--------|
| `timeframe` | number | 1 (daily), 7 (weekly), 30 (monthly) | 1 |
| `sort` | string | `profit`, `wins`, `losses`, `winrate`, `name` | `profit` |
| `order` | string | `asc` or `desc` | `desc` |
| `limit` | number | 1–100 | 20 |
| `search` | string | Search by name or wallet address | — |

**Returns:** Ranked entries with rank, name, wallet address, profit, wins, losses, win rate %, Twitter link.

### `kolscan_wallet`

Get detailed data for a specific KolScan wallet.

| Param | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `address` | string | Yes | Wallet address |

**Returns:** Total profit, wins, losses, win rate, per-timeframe breakdowns, links to KolScan/GMGN/Solscan.

### `gmgn_wallets`

Get GMGN smart money wallets for Solana or BSC.

| Param | Type | Description | Default |
|:------|:-----|:------------|:--------|
| `chain` | string | `sol` or `bsc` | `sol` |
| `category` | string | `smart_degen`, `kol`, `snipe_bot`, `launchpad_smart`, `fresh_wallet` | — |
| `sort` | string | `realized_profit_7d`, `realized_profit_1d`, `realized_profit_30d`, `winrate_7d`, `buy_7d` | `realized_profit_7d` |
| `order` | string | `asc` or `desc` | `desc` |
| `limit` | number | 1–100 | 20 |
| `search` | string | Search by name, address, or Twitter | — |

**Returns:** Ranked wallets with profit (1d/7d/30d), buys/sells, win rate, category, tags, Twitter link.

### `gmgn_wallet_detail`

Get complete GMGN data for a specific wallet.

| Param | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `address` | string | Yes | Wallet address |

**Returns:** Chain, category, tags, balance, follower count, profit by timeframe, buy/sell counts, win rates, external links.

### `wallet_stats`

Aggregate statistics across all data sources.

**No parameters.**

**Returns:** KolScan unique wallet count + entries, GMGN SOL/BSC wallet counts broken down by category, combined totals.

### `search_wallets`

Search across all data sources simultaneously (KolScan + GMGN SOL + GMGN BSC).

| Param | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `query` | string | Yes | Search term |
| `limit` | number | No | Max results (1–100, default 20) |

**Returns:** Combined results with source, chain, name, wallet address, profit, category, Twitter (fields vary by source).

## Data Sources

The MCP server loads the same data files as the web app:
- `output/kolscan-leaderboard.json` or `site/data/kolscan-leaderboard.json`
- `solwallets.json` or `site/data/solwallets.json`
- `bscwallets.json` or `site/data/bscwallets.json`

Falls back to GitHub raw URLs if local files are missing. Data is cached in memory after first load.

## Example Conversations

With the MCP server connected, you can ask an AI assistant things like:

- "Who are the top 5 most profitable KOLs today?"
- "Look up wallet CyaE1Vxv... — what's their win rate?"
- "Show me GMGN smart degen wallets on Solana sorted by 7d profit"
- "Search for any wallets associated with @CryptoWhale on Twitter"
- "Give me overall stats across all data sources"
