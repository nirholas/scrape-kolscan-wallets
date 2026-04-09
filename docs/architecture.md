# Architecture

## System Overview

KolQuest is a multi-layer system that scrapes crypto wallet data from external sources, stores it locally, and serves it through a Next.js web app with real-time tracking features.

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

## Data Flow

### Static Data (JSON files)

1. **Scrapers** run on-demand, writing JSON files to disk
2. The Next.js app reads these files at request time via `lib/data.ts`
3. If local files are missing, it falls back to GitHub raw URLs
4. Data is parsed, normalized, and merged (KolScan + GMGN deduplication)

### Dynamic Data (PostgreSQL)

1. **Trade ingestion** (`scripts/ingest-trades.ts`) writes trade records to the database
2. The `/api/trades` endpoint serves trades with cursor-based pagination
3. User data (accounts, sessions, watchlists, submissions) lives entirely in PostgreSQL
4. Drizzle ORM handles all queries and schema management

### Merge Strategy

The All Solana view merges KolScan and GMGN data:
- Both sources are converted to a `UnifiedWallet` format
- Deduplicated by wallet address — GMGN data takes priority (richer fields)
- Wallets found in both sources get a `kolscan` tag appended
- X profile avatars fill in missing avatars

## Project Structure

```
kol-quest/
├── api/
│   └── index.ts              # Bun REST API server (port 3002)
├── mcp/
│   └── index.ts              # MCP server for AI assistants
├── site/                     # Next.js application
│   ├── app/
│   │   ├── layout.tsx        # Root layout, nav, footer
│   │   ├── page.tsx          # Homepage
│   │   ├── leaderboard/      # KolScan rankings
│   │   ├── top-performers/   # Win rate sorted view
│   │   ├── most-profitable/  # Profit sorted view
│   │   ├── gmgn-sol/         # GMGN Solana wallets
│   │   ├── bsc/              # GMGN BSC wallets
│   │   ├── all-solana/       # Unified Solana leaderboard
│   │   ├── wallet/           # KolScan wallet detail [address]
│   │   ├── gmgn-wallet/      # GMGN wallet detail [address]
│   │   ├── track/            # Live token tracker
│   │   ├── monitor/          # Real-time wallet monitor
│   │   ├── tracker/          # Personal wallet watchlist
│   │   ├── feed/             # Trade activity feed
│   │   ├── community/        # Approved community wallets
│   │   ├── submit/           # Wallet submission form
│   │   ├── admin/            # Admin moderation panel
│   │   ├── auth/             # Sign in / sign up
│   │   ├── calendar/         # PnL calendar heatmap
│   │   ├── docs/             # Documentation page
│   │   ├── api/              # Next.js API routes
│   │   │   ├── auth/         # Better-Auth catch-all
│   │   │   ├── submissions/  # CRUD + moderation
│   │   │   ├── trades/       # Trade queries + ingestion
│   │   │   ├── watchlist/    # User watchlist CRUD
│   │   │   └── admin/        # Admin bootstrap
│   │   └── components/       # Shared UI components
│   ├── drizzle/
│   │   └── db/
│   │       ├── schema.ts     # Database table definitions
│   │       └── index.ts      # DB connection
│   ├── lib/
│   │   ├── auth.ts           # Better-Auth configuration
│   │   ├── auth-client.ts    # Client-side auth hooks
│   │   ├── data.ts           # Data loading (JSON + GitHub fallback)
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── solana-auth-plugin.ts  # Custom Solana wallet auth
│   │   └── rate-limit.ts     # In-memory rate limiter
│   ├── scripts/
│   │   └── ingest-trades.ts  # Trade data import/poll
│   └── data/                 # Local data files (JSON)
├── output/                   # Scraper output directory
├── scrape.js                 # KolScan leaderboard scraper
├── scrape-axiom.js           # GMGN/Axiom smart wallet scraper
├── scrape-x-profiles.js      # X/Twitter profile scraper
├── scrape-gmgn-x-tracker.js  # GMGN X tracker accounts scraper
├── solwallets.json           # GMGN Solana wallet data
└── bscwallets.json           # GMGN BSC wallet data
```

## Key Design Decisions

### JSON-first data loading
Leaderboard and wallet data are served from JSON files rather than the database. This keeps the data pipeline simple — scrapers write files, the app reads files. The database is reserved for user-generated data (submissions, watchlists, trades).

### Fallback to GitHub
If local JSON files are missing, `lib/data.ts` fetches from GitHub raw URLs. This means the app works even without running scrapers locally — it just uses the last committed data.

### Unified wallet type
KolScan and GMGN have different schemas. The `UnifiedWallet` type normalizes both into a common shape for the All Solana leaderboard, enabling sorting and filtering across sources.

### In-memory caching
X profile data and GMGN data are cached in memory after first load. The Bun API server and MCP server also hold data in memory for fast responses.

### Better-Auth with custom plugins
Authentication uses Better-Auth with three custom plugins stacked together:
- `username()` — username/password auth
- `siwe()` — Ethereum wallet signing (EIP-191)
- `solanaWallet()` — custom plugin for Solana ed25519 signing

All three create the same session/user records, so the rest of the app doesn't care how the user authenticated.
