<div align="center">

<img src="assets/hero-banner.svg" alt="KolQuest — Smart Wallet Intelligence" width="100%"/>

<br/>
<br/>

Track the best crypto traders. Monitor smart money moves in real time. Discover new tokens before they run.

<br/>

[![Live](https://img.shields.io/badge/Live-kol.quest-1D9BF0?style=for-the-badge&logo=vercel&logoColor=white)](https://kol.quest)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js_14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)

</div>

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Features

<table>
<tr>
<td width="50%">

<img src="assets/features-leaderboard.svg" alt="Leaderboards" width="100%"/>

**Multi-source KOL rankings** across daily, weekly, and monthly timeframes. KolScan profit leaders, GMGN smart money wallets, win rate filters, and a unified All Solana view that merges every data source.

</td>
<td width="50%">

<img src="assets/features-realtime.svg" alt="Real-Time Tracking" width="100%"/>

**Live trade feeds** from smart money wallets as they happen. Token discovery, wallet monitoring, buy/sell streams with P&L — three real-time views for different tracking styles.

</td>
</tr>
<tr>
<td width="50%">

<img src="assets/features-community.svg" alt="Community" width="100%"/>

**Community-driven wallet discovery.** Submit wallets, vouch for others' finds, and browse approved submissions. Full moderation workflow with admin controls.

</td>
<td width="50%">

<img src="assets/features-auth.svg" alt="Multi-Chain Auth" width="100%"/>

**Sign in with your wallet.** Solana (ed25519), Ethereum (EIP-191/SIWE), or traditional email — all powered by Better-Auth with role-based access control.

</td>
</tr>
</table>

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Architecture

<div align="center">
<img src="assets/architecture.svg" alt="Architecture Diagram" width="100%"/>
</div>

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  DATA SOURCES   │     │    INGESTION     │     │    STORAGE      │     │   APPLICATION    │
│                 │     │                  │     │                 │     │                  │
│  KolScan.io     │────>│  scrape.js       │────>│  JSON files     │────>│  Next.js 14      │
│  GMGN API       │────>│  scrape-axiom.js │     │  (leaderboard,  │     │  (React 18, TS)  │
│  X / Twitter    │────>│  scrape-x.js     │     │   wallets, X)   │     │                  │
│                 │     │                  │     │                 │     │  Leaderboards    │
│                 │     │  ingest-trades   │────>│  PostgreSQL     │────>│  Tracking        │
│                 │     │  (batch + poll)  │     │  (trades,       │     │  Feed            │
│                 │     │                  │     │   submissions,  │     │  Community       │
│                 │     │                  │     │   watchlists,   │     │  Auth            │
│                 │     │                  │     │   users)        │     │                  │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────┘
                                                                               │
                                                                               │
                                                        ┌──────────────────────┴──────────┐
                                                        │                                 │
                                                  ┌─────┴──────┐                ┌─────────┴──────┐
                                                  │  Bun API   │                │  MCP Server    │
                                                  │  :3002     │                │  (stdio)       │
                                                  │  REST/JSON │                │  AI assistants │
                                                  └────────────┘                └────────────────┘
```

### Data Flow

**Static Data (JSON files)** — Scrapers run on-demand, writing JSON to disk. The Next.js app reads these files at request time. If local files are missing, it falls back to GitHub raw URLs so the app works without running scrapers.

**Dynamic Data (PostgreSQL)** — Trade ingestion writes trade records to the database. User data (accounts, sessions, watchlists, submissions) lives entirely in PostgreSQL via Drizzle ORM.

**Merge Strategy** — The All Solana view merges KolScan + GMGN data into a unified `UnifiedWallet` format, deduplicated by wallet address with GMGN data taking priority.

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Tech Stack

<div align="center">
<img src="assets/tech-stack.svg" alt="Tech Stack" width="820"/>
</div>

<br/>

| Layer | Technology |
|:------|:-----------|
| **Framework** | Next.js 14, React 18, TypeScript |
| **Styling** | Tailwind CSS, custom dark design system |
| **Database** | PostgreSQL + Drizzle ORM |
| **Auth** | Better-Auth — email, Solana, Ethereum |
| **Scraping** | Playwright, xactions (X/Twitter) |
| **Crypto** | TweetNaCl, bs58, ethers.js |
| **Data** | KolScan API, GMGN API, X/Twitter |
| **API** | Next.js API Routes + Bun REST API (port 3002) |
| **AI Integration** | MCP Server (Model Context Protocol) |

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Getting Started

### Prerequisites

- **Node.js 18+**
- **PostgreSQL** (local or hosted — Neon, Supabase, Railway all work)
- **Chromium** (for scrapers — installed via Playwright)
- **Bun** (optional, for the standalone API and MCP servers)

### Install

```bash
# Clone the repo
git clone https://github.com/nirholas/kol-quest.git
cd kol-quest

# Root dependencies (scrapers)
npm install

# Site dependencies (Next.js app)
cd site && npm install && cd ..

# Playwright for scraping
npx playwright install chromium
sudo npx playwright install-deps chromium   # Linux only
```

Or use the setup script:

```bash
npm run setup
```

### Configure

```bash
cp site/.env.example site/.env
```

| Variable | Required | Description |
|:---------|:---------|:------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string: `postgres://user:pass@host:5432/dbname` |
| `AUTH_SECRET` | Yes | Random secret for session signing. Generate with `openssl rand -hex 32` |
| `NEXT_PUBLIC_URL` | Recommended | Your app's public URL. Default: `http://localhost:3000` |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Recommended | Auth URL (usually same as above) |
| `ADMIN_USERNAME` | Optional | Username that auto-promotes to admin on first login |
| `GMGN_TOKEN` | Optional | Bearer token for GMGN API (used by trade polling) |

### Database Setup

```bash
cd site
npm run db:push        # Push schema directly (development)
npm run db:generate    # Generate migration SQL from schema changes
npm run db:migrate     # Apply pending migrations (production)
```

This creates all tables: `user`, `session`, `account`, `verification`, `wallet_submission`, `wallet_vouch`, `wallet_address`, `trade`, `watchlist`.

### Scrape Data

Before the app has anything to display, scrape the data sources:

```bash
npm run scrape          # KolScan KOL leaderboard (~472 wallets)
npm run scrape:axiom    # GMGN smart money wallets (Solana + BSC)
npm run scrape:x        # X/Twitter profiles for KOL social data
```

Copy fresh data to the Next.js app:

```bash
cp output/kolscan-leaderboard.json site/data/
cp solwallets.json site/data/
cp bscwallets.json site/data/
```

> **Note:** If local files are missing, the app falls back to GitHub raw URLs — so you can skip scraping entirely and use the last committed data.

### Run

```bash
# Development
npm run dev

# Production
cd site && npm run build && npm start
```

Open [http://localhost:3000](http://localhost:3000).

### First Admin User

1. Sign up with the username matching `ADMIN_USERNAME` in your `.env`
2. The bootstrap endpoint auto-promotes that user to admin
3. Admin can approve/reject community wallet submissions at `/admin/submissions`

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## API Reference

KolQuest exposes two API surfaces for programmatic access.

### Next.js API Routes

Base URL: your app URL (e.g. `http://localhost:3000`)

#### Trades — `GET /api/trades`

Query trade activity with cursor-based pagination. No auth required.

| Param | Type | Description | Default |
|:------|:-----|:------------|:--------|
| `chain` | string | `"sol"`, `"bsc"`, or omit for all | all |
| `wallet` | string | Filter by wallet address | — |
| `type` | string | `"buy"` or `"sell"` | all |
| `limit` | number | 1–200 | 50 |
| `cursor` | string | ISO timestamp for pagination | — |

```bash
# Recent trades
curl 'http://localhost:3000/api/trades?limit=10'

# Solana buys only
curl 'http://localhost:3000/api/trades?chain=sol&type=buy'

# Specific wallet with pagination
curl 'http://localhost:3000/api/trades?wallet=CyaE1Vxv...&cursor=2025-01-15T12:30:00.000Z'
```

<details>
<summary>Response example</summary>

```json
{
  "trades": [
    {
      "id": "...",
      "walletAddress": "...",
      "walletLabel": "DegenKing",
      "walletTags": "[\"kol\",\"smart_degen\"]",
      "chain": "sol",
      "type": "buy",
      "tokenAddress": "...",
      "tokenSymbol": "BONK",
      "tokenName": "Bonk",
      "tokenLogo": "https://...",
      "amountUsd": 12420.50,
      "amountToken": 50000000,
      "priceUsd": 0.000248,
      "realizedProfit": 3200.00,
      "realizedProfitPnl": 0.35,
      "txHash": "...",
      "source": "gmgn",
      "tradedAt": "2025-01-15T12:30:00.000Z"
    }
  ],
  "nextCursor": "2025-01-15T12:29:00.000Z"
}
```

</details>

#### Submissions — `GET /api/submissions`

List all approved community wallet submissions. No auth required.

#### Submissions — `POST /api/submissions`

Submit a new wallet for community review. Auth required, rate limited to 12/hour per user.

| Field | Required | Validation |
|:------|:---------|:-----------|
| `walletAddress` | Yes | Trimmed string |
| `chain` | Yes | `"solana"` or `"bsc"` |
| `label` | Yes | 2–80 characters |
| `notes` | No | Max 800 characters |
| `twitter` | No | HTTPS URL |
| `telegram` | No | HTTPS URL |

#### Watchlist — `GET /api/watchlist`

Get the authenticated user's watchlisted wallets. Auth required.

#### Watchlist — `POST /api/watchlist`

Add a wallet to the watchlist. Auth required.

#### Watchlist — `PATCH /api/watchlist`

Update label or group for a watchlisted wallet. Auth required.

#### Watchlist — `DELETE /api/watchlist`

Remove a wallet from the watchlist. Auth required.

#### Admin — `GET /api/submissions/pending`

List pending submissions. Admin only.

#### Admin — `POST /api/submissions/[id]/approve` | `POST /api/submissions/[id]/reject`

Approve or reject a pending submission. Admin only.

---

### Bun REST API (Standalone)

A lightweight read-only REST API server powered by Bun, running independently on port 3002. Ideal for integrations, bots, and external tools that need fast access to wallet data without the full Next.js app.

```bash
bun api/index.ts
# or
npm run api
```

#### `GET /health`

Health check returning data counts and server status.

#### `GET /kolscan/leaderboard`

KolScan KOL leaderboard with sorting, filtering, and search.

| Param | Type | Description | Default |
|:------|:-----|:------------|:--------|
| `timeframe` | number | `1` (daily), `7` (weekly), `30` (monthly) | `1` |
| `sort` | string | `profit`, `wins`, `losses`, `winrate`, `name` | `profit` |
| `order` | string | `asc` or `desc` | `desc` |
| `limit` | number | 1–100 | 20 |
| `search` | string | Search by name or address | — |

#### `GET /kolscan/wallet/:address`

Detailed data for a specific KolScan wallet across all timeframes.

#### `GET /gmgn/wallets`

GMGN smart money wallets for Solana or BSC with category filtering.

| Param | Type | Description | Default |
|:------|:-----|:------------|:--------|
| `chain` | string | `sol` or `bsc` | `sol` |
| `category` | string | `smart_degen`, `kol`, `snipe_bot`, `launchpad_smart`, `fresh_wallet` | — |
| `sort` | string | `realized_profit_7d`, `realized_profit_1d`, `realized_profit_30d`, `winrate_7d`, `buy_7d` | `realized_profit_7d` |
| `order` | string | `asc` or `desc` | `desc` |
| `limit` | number | 1–100 | 20 |
| `search` | string | Search by name, address, or Twitter | — |

#### `GET /gmgn/wallet/:address`

Complete GMGN data for a specific wallet including PnL breakdowns.

#### `GET /search`

Search across all data sources simultaneously (KolScan + GMGN SOL + GMGN BSC).

| Param | Type | Description | Default |
|:------|:-----|:------------|:--------|
| `q` | string | Search term (required) | — |
| `limit` | number | 1–100 | 20 |

#### `GET /stats`

Aggregate statistics across all data sources — wallet counts, category breakdowns, totals.

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## MCP Server (AI Integration)

KolQuest includes a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes wallet intelligence to AI assistants like **Claude**, **GitHub Copilot**, **Cursor**, and any MCP-compatible client.

```bash
bun mcp/index.ts
# or
npm run mcp
```

The server communicates over JSON-RPC via stdio (newline-delimited JSON on stdin/stdout).

### Claude Desktop Configuration

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

### Available Tools

| Tool | Description |
|:-----|:------------|
| `kolscan_leaderboard` | Get KolScan KOL leaderboard ranked by profit, win rate, or other metrics. Supports timeframe, sort, order, limit, and search params. |
| `kolscan_wallet` | Get detailed data for a specific KolScan wallet — total profit, wins, losses, win rate, per-timeframe breakdowns, external links. |
| `gmgn_wallets` | Get GMGN smart money wallets for Solana or BSC. Filter by category (`smart_degen`, `kol`, `snipe_bot`, etc.), sort by profit or win rate. |
| `gmgn_wallet_detail` | Get complete GMGN data for a specific wallet — chain, category, tags, balance, PnL by timeframe, buy/sell counts, win rates. |
| `wallet_stats` | Aggregate statistics across all data sources — total wallet counts, category breakdowns, combined totals. |
| `search_wallets` | Search across all data sources simultaneously (KolScan + GMGN SOL + GMGN BSC) by name, address, or Twitter handle. |

### Example Prompts

With the MCP server connected, you can ask an AI assistant things like:

- *"Who are the top 5 most profitable KOLs today?"*
- *"Look up wallet CyaE1Vxv... — what's their win rate?"*
- *"Show me GMGN smart degen wallets on Solana sorted by 7d profit"*
- *"Search for any wallets associated with @CryptoWhale on Twitter"*
- *"Give me overall stats across all data sources"*

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Authentication

KolQuest supports three sign-in methods via [Better-Auth](https://www.better-auth.com/):

| Method | Plugin | How It Works |
|:-------|:-------|:-------------|
| **Email / Password** | `username()` | Standard username (3–20 chars) + password (8+ chars) |
| **Solana Wallet** | Custom `solanaWallet()` | ed25519 signature verification via TweetNaCl. Nonce-based challenge-response with 5-minute expiry. |
| **Ethereum Wallet** | `siwe()` | EIP-191 / SIWE signature verification via ethers.js. MetaMask-compatible. |

All three methods create the same session/user records — the rest of the app doesn't care how the user authenticated.

**Roles:** `user` (default) and `admin`. The first user matching `ADMIN_USERNAME` is auto-promoted.

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Database Schema

PostgreSQL with Drizzle ORM. Schema defined in `site/drizzle/db/schema.ts`.

| Table | Purpose |
|:------|:--------|
| `user` | Core user accounts (id, name, email, role, username) |
| `session` | Active sessions with expiry, IP, user agent |
| `account` | Linked auth providers (credential, siwe, solana-wallet) |
| `verification` | Email verification tokens |
| `wallet_submission` | Community-submitted wallets with moderation status |
| `wallet_vouch` | Community votes on submissions (one per user per submission) |
| `wallet_address` | User-linked wallet addresses |
| `trade` | Trade activity records from smart wallets (buy/sell, PnL, token data) |
| `watchlist` | User-saved wallet watchlist with custom labels and groups |

All foreign keys cascade on delete — removing a user cleans up all their data.

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Scrapers

Playwright-based scrapers collect data from three external sources. All scrapers live in the project root.

| Scraper | Command | Source | Output |
|:--------|:--------|:-------|:-------|
| `scrape.js` | `npm run scrape` | KolScan leaderboard | `output/kolscan-leaderboard.json` (~472 wallets, 3 timeframes) |
| `scrape-axiom.js` | `npm run scrape:axiom` | GMGN / Axiom smart wallets | `output/axiom-smart-wallets.json` |
| `scrape-x-profiles.js` | `npm run scrape:x` | X/Twitter profiles | `site/data/x-profiles.json` (8 concurrent workers, 7-day cache, resumable) |
| `scrape-gmgn-x-tracker.js` | `npm run scrape:x-tracker` | GMGN X tracker accounts | `site/data/gmgn-x-tracker.json` |

### Trade Ingestion

Trade data is ingested into PostgreSQL via `site/scripts/ingest-trades.ts`:

```bash
cd site
npm run ingest          # Batch import from JSON wallet files
npm run ingest:poll     # Poll GMGN API for recent trade activity
```

**Batch import** reads `solwallets.json` / `bscwallets.json` and creates trade records from wallet holdings. **Live polling** hits the GMGN API for each wallet's recent activities (10 wallets in parallel, 2s delay between batches). Both modes use `onConflictDoNothing` for safe re-runs.

For continuous data, set up polling as a cron job:

```bash
*/15 * * * * cd /path/to/kol-quest/site && npx tsx scripts/ingest-trades.ts poll >> /var/log/kolquest-trades.log 2>&1
```

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Pages & Features

### Public

| Route | Description |
|:------|:------------|
| `/` | Landing page with stats overview and top wallets from each source |
| `/leaderboard` | KolScan KOL rankings — sortable, searchable, exportable (CSV/JSON). Daily/Weekly/Monthly tabs |
| `/top-performers` | KolScan leaderboard pre-sorted by win rate |
| `/most-profitable` | KolScan leaderboard pre-sorted by profit |
| `/gmgn-sol` | GMGN Solana smart money wallets with category badges and PnL breakdowns |
| `/bsc` | GMGN BSC wallets — same layout as Solana |
| `/all-solana` | Unified leaderboard merging KolScan + GMGN (~1,300+ unique wallets) |
| `/wallet/[address]` | KolScan wallet detail — stats, rankings, X profile, PnL calendar, sparklines |
| `/gmgn-wallet/[address]` | GMGN wallet detail — PnL by timeframe, trading stats, distribution chart |
| `/community` | Approved community-submitted wallets |
| `/calendar` | PnL calendar heatmap across all tracked wallets |
| `/docs` | API Playground, REST API reference, MCP setup guide |

### Authenticated

| Route | Description |
|:------|:------------|
| `/track` | Real-time token discovery — new tokens being traded by smart wallets |
| `/monitor` | Live activity feed from smart money wallets |
| `/tracker` | Personal wallet watchlist with custom groups |
| `/feed` | Real-time trade stream with auto-refresh (15s polling, cursor-based infinite scroll) |
| `/submit` | Wallet submission form (rate-limited to 12/hour) |
| `/admin/submissions` | Admin-only moderation panel for pending submissions |

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Project Structure

```
kol-quest/
├── api/
│   └── index.ts              # Bun REST API server (port 3002)
├── mcp/
│   └── index.ts              # MCP server for AI assistants
├── scrape.js                 # KolScan leaderboard scraper
├── scrape-axiom.js           # GMGN/Axiom smart wallet scraper
├── scrape-x-profiles.js      # X/Twitter profile scraper
├── scrape-gmgn-x-tracker.js  # GMGN X tracker accounts scraper
├── solwallets.json           # GMGN Solana wallet data
├── bscwallets.json           # GMGN BSC wallet data
├── output/                   # Scraper output directory
├── docs/                     # Extended documentation
│   ├── api-reference.md      # Full API reference
│   ├── architecture.md       # System design & data flow
│   ├── authentication.md     # Auth flows & session management
│   ├── database.md           # Schema, tables, indexes
│   ├── deployment.md         # Production hosting guide
│   ├── features.md           # Every page and feature
│   ├── mcp-server.md         # MCP server setup & tools
│   ├── scrapers.md           # Scraper details & output formats
│   └── trade-ingestion.md    # Batch import & live polling
└── site/                     # Next.js application
    ├── app/
    │   ├── layout.tsx        # Root layout, nav, footer
    │   ├── page.tsx          # Homepage
    │   ├── api/              # Next.js API routes
    │   │   ├── auth/         # Better-Auth catch-all
    │   │   ├── submissions/  # CRUD + moderation
    │   │   ├── trades/       # Trade queries + ingestion
    │   │   ├── watchlist/    # User watchlist CRUD
    │   │   └── admin/        # Admin bootstrap
    │   └── components/       # Shared UI components
    ├── drizzle/
    │   └── db/
    │       ├── schema.ts     # Database table definitions
    │       └── index.ts      # DB connection
    ├── lib/
    │   ├── auth.ts           # Better-Auth configuration
    │   ├── auth-client.ts    # Client-side auth hooks
    │   ├── data.ts           # Data loading (JSON + GitHub fallback)
    │   ├── types.ts          # TypeScript interfaces
    │   ├── solana-auth-plugin.ts  # Custom Solana wallet auth
    │   └── rate-limit.ts     # In-memory rate limiter
    ├── scripts/
    │   └── ingest-trades.ts  # Trade data import/poll
    └── data/                 # Local data files (JSON)
```

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Scripts

| Command | Description |
|:--------|:------------|
| `npm run scrape` | Scrape KolScan leaderboard |
| `npm run scrape:axiom` | Pull GMGN smart money data |
| `npm run scrape:x` | Scrape X/Twitter KOL profiles |
| `npm run scrape:x-tracker` | Scrape GMGN X tracker accounts |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run api` | Start standalone Bun REST API on port 3002 |
| `npm run mcp` | Start MCP server for AI assistants |
| `npm run setup` | Install all dependencies + Playwright |
| `cd site && npm run ingest` | Bulk import trades from JSON |
| `cd site && npm run ingest:poll` | Poll GMGN API for live trades |
| `cd site && npm run db:push` | Push schema to database |
| `cd site && npm run db:generate` | Generate migration SQL |
| `cd site && npm run db:migrate` | Apply pending migrations |

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Deployment

### Vercel

1. Connect the GitHub repo
2. Set the root directory to `site`
3. Set environment variables in the Vercel dashboard
4. Deploy

> The scrapers and Bun API/MCP servers run separately — they're not part of the Vercel deployment.

### Self-Hosted

```bash
cd site && npm run build && PORT=3000 npm start
```

Run behind a reverse proxy (nginx, Caddy) for production.

### Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY site/package*.json ./
RUN npm ci
COPY site/ ./
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Data Pipeline in Production

```bash
# Cron: scrape KolScan daily
0 6 * * * cd /path/to/kol-quest && node scrape.js

# Cron: scrape GMGN daily
0 7 * * * cd /path/to/kol-quest && node scrape-axiom.js

# Cron: scrape X profiles weekly
0 8 * * 0 cd /path/to/kol-quest && node scrape-x-profiles.js

# Cron: poll trades every 15 minutes
*/15 * * * * cd /path/to/kol-quest/site && npx tsx scripts/ingest-trades.ts poll
```

Alternatively, commit scraped JSON files to the repo and let the app fetch them from GitHub raw URLs.

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Data Sources

<table>
<tr>
<td align="center" width="33%">

**KolScan**

KOL wallet rankings, profit/loss tracking, win rates across timeframes

</td>
<td align="center" width="33%">

**GMGN**

Smart money wallet discovery, on-chain trade data, PnL analytics

</td>
<td align="center" width="33%">

**X / Twitter**

KOL social profiles, follower data, verification status

</td>
</tr>
</table>

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Documentation

For deeper dives, see the [docs/](docs/) folder:

| Doc | Description |
|:----|:------------|
| [API Reference](docs/api-reference.md) | Full Next.js API routes + Bun REST API with request/response examples |
| [Architecture](docs/architecture.md) | System design, data flow, project structure, key design decisions |
| [Authentication](docs/authentication.md) | Email, Solana (ed25519), Ethereum (SIWE) auth flows with sequence diagrams |
| [Database](docs/database.md) | Complete schema with all columns, types, indexes, and entity relationships |
| [Deployment](docs/deployment.md) | Production build, Vercel, self-hosted, Docker, cron pipeline |
| [Features](docs/features.md) | Every page and feature in the app |
| [MCP Server](docs/mcp-server.md) | Full MCP tool reference with parameters and example conversations |
| [Scrapers](docs/scrapers.md) | Scraper internals, output formats, resumption, rate limiting |
| [Trade Ingestion](docs/trade-ingestion.md) | Batch import, live polling, trade schema, deduplication |

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

<div align="center">

MIT License

Built with data from [KolScan](https://kolscan.io) and [GMGN](https://gmgn.ai)

</div>
