# Getting Started

## Prerequisites

- **Node.js 18+**
- **PostgreSQL** (local or hosted)
- **Chromium** (for scrapers — installed via Playwright)
- **Bun** (optional, for the standalone API and MCP servers)

## Installation

```bash
# Clone the repo
git clone https://github.com/nirholas/kol-quest.git
cd kol-quest

# Install root dependencies (scrapers)
npm install

# Install site dependencies (Next.js app)
cd site && npm install && cd ..

# Install Playwright for scraping
npx playwright install chromium
sudo npx playwright install-deps chromium   # Linux only — system libs
```

Or use the setup script:

```bash
npm run setup
```

## Environment Variables

Copy the example and fill in your values:

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
| `GMGN_TOKEN` | Optional | Bearer token for GMGN API (used by trade polling script) |

## Database Setup

Push the schema to your database:

```bash
cd site
npm run db:push
```

This creates all tables: `user`, `session`, `account`, `verification`, `wallet_submission`, `wallet_vouch`, `wallet_address`, `trade`, `watchlist`.

For migration-based workflows:

```bash
npm run db:generate   # Generate migration files from schema changes
npm run db:migrate    # Apply pending migrations
```

## Scrape Data

Before the app has anything to display, scrape the data sources:

```bash
# KolScan KOL leaderboard (~472 wallets)
npm run scrape

# GMGN smart money wallets (Solana + BSC)
npm run scrape:axiom

# X/Twitter profiles for KOL social data
npm run scrape:x
```

Data files land in `output/` (KolScan) and root (`solwallets.json`, `bscwallets.json`). Copy them to `site/data/` for the Next.js app to use:

```bash
cp output/kolscan-leaderboard.json site/data/
cp solwallets.json site/data/
cp bscwallets.json site/data/
```

## Run the App

```bash
# Development (from root)
npm run dev

# Or from site directory
cd site && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional: Standalone API Server

The Bun-powered REST API runs independently at port 3002:

```bash
bun api/index.ts
# or
npm run api
```

## Optional: MCP Server

For AI assistant integration:

```bash
bun mcp/index.ts
# or
npm run mcp
```

## First Admin User

1. Sign up with the username matching `ADMIN_USERNAME` in your `.env`
2. The bootstrap endpoint auto-promotes that user to admin
3. Admin can approve/reject community wallet submissions at `/admin/submissions`
