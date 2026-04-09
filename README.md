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

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Project Structure

```
kol-quest/
├── scrape.js                  # KolScan leaderboard scraper
├── scrape-axiom.js            # GMGN API data ingestion
├── scrape-x-profiles.js       # X/Twitter profile scraper
├── scrape-gmgn-x-tracker.js   # GMGN X tracker accounts
├── solwallets.json            # GMGN Solana wallet data
├── bscwallets.json            # GMGN BSC wallet data
├── api/                       # Bun API server
├── mcp/                       # MCP server
└── site/                      # Next.js application
    ├── app/
    │   ├── leaderboard/       # KolScan rankings
    │   ├── gmgn-sol/          # GMGN Solana wallets
    │   ├── bsc/               # GMGN BSC wallets
    │   ├── all-solana/        # Unified Solana leaderboard
    │   ├── track/             # Live token tracker
    │   ├── monitor/           # Real-time wallet monitor
    │   ├── tracker/           # Personal wallet tracker
    │   ├── feed/              # Trade activity feed
    │   ├── community/         # Community-submitted wallets
    │   ├── submit/            # Wallet submission form
    │   ├── admin/             # Admin panel
    │   └── api/               # API routes
    ├── drizzle/               # DB schema & migrations
    ├── lib/                   # Auth, data loading, types
    └── scripts/               # Trade ingestion scripts
```

<br/>

<img src="assets/divider.svg" width="100%" />

<br/>

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Chromium (for scrapers)

### Install

```bash
# Root dependencies (scrapers)
npm install

# Site dependencies (Next.js app)
cd site && npm install

# Playwright for scraping
npx playwright install chromium
sudo npx playwright install-deps chromium   # Linux only
```

### Configure

```bash
cp site/.env.example site/.env
```

```env
DATABASE_URL=postgres://user:password@host:5432/dbname
AUTH_SECRET=your-random-secret
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
ADMIN_USERNAME=yourusername
```

### Database

```bash
cd site
npm run db:push        # Push schema to database
npm run db:generate    # Generate migrations
npm run db:migrate     # Run migrations
```

### Run

```bash
# Development
npm run dev

# Production
cd site && npm run build && npm start
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
| `cd site && npm run ingest` | Bulk import trades from JSON |
| `cd site && npm run ingest:poll` | Poll GMGN API for live trades |
| `cd site && npm run db:push` | Push schema to database |

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

<div align="center">

MIT License

Built with data from [KolScan](https://kolscan.io) and [GMGN](https://gmgn.ai)

</div>
