# KolQuest

Smart wallet intelligence and KOL analytics for Solana and BSC. Track the best crypto traders, monitor smart money moves in real time, and discover new tokens before they run.

**Live:** [kolquest.com](https://kolquest.com)

## Features

### Leaderboards
- **KolScan** — KOL profit rankings with daily/weekly/monthly timeframes, win rates, and social links
- **GMGN Solana** — Smart money wallets ranked by realized profit, PnL, and win rate
- **GMGN BSC** — Binance Smart Chain smart money wallets
- **All Solana** — Unified leaderboard combining all Solana data sources
- **Most Profitable / Top Win Rate** — Filtered views for different strategies

### Real-Time Tracking
- **Track** — Spot new tokens being traded by smart wallets as they happen
- **Monitor** — Live activity feed from smart money wallets (GMGN-style)
- **Feed** — Buy/sell trade stream with profit/loss, token details, and wallet labels

### Wallet Tracker
- Save favorite wallets to a personal watchlist
- Organize wallets into custom groups
- Monitor individual wallet performance over time

### Community
- Submit wallets you've found for community review
- Vouch/upvote submissions from other users
- Admin moderation workflow (pending -> approved/rejected)

### X/Twitter Integration
- Scraped profile data for KOLs (followers, bio, verified status)
- Social links on leaderboard entries

### Authentication
- Email/password signup
- **Solana wallet login** (message signing with ed25519)
- **Ethereum wallet login** (EIP-191 / SIWE)
- Role-based access (user, admin)

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, custom design system |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better-Auth (email, Solana, Ethereum) |
| Scraping | Playwright, xactions (X/Twitter) |
| Crypto | TweetNaCl, bs58, ethers.js |
| Data | KolScan API, GMGN API |

## Project Structure

```
kol-quest/
  scrape.js              # KolScan leaderboard scraper
  scrape-axiom.js        # GMGN API data ingestion
  scrape-x-profiles.js   # X/Twitter profile scraper
  scrape-gmgn-x-tracker.js
  solwallets.json         # GMGN Solana wallet data
  bscwallets.json         # GMGN BSC wallet data
  api/                    # Bun API server
  mcp/                    # MCP server
  site/                   # Next.js application
    app/
      leaderboard/        # KolScan rankings
      gmgn-sol/           # GMGN Solana wallets
      bsc/                # GMGN BSC wallets
      all-solana/         # Unified Solana leaderboard
      track/              # Live token tracker
      monitor/            # Real-time wallet monitor
      tracker/            # Personal wallet tracker
      feed/               # Trade activity feed
      community/          # Community-submitted wallets
      submit/             # Wallet submission form
      admin/              # Admin panel
      api/                # API routes
    drizzle/              # DB schema & migrations
    lib/                  # Auth, data loading, types
    scripts/              # Trade ingestion scripts
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL
- Chromium (for scrapers)

### Setup

```bash
# Install dependencies
npm install
cd site && npm install

# Install Playwright for scraping
npx playwright install chromium
sudo npx playwright install-deps chromium   # Linux only

# Configure environment
cp site/.env.example site/.env
# Edit site/.env with your database URL and auth secret
```

### Environment Variables

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
npm run db:push       # Push schema to database
npm run db:generate   # Generate migrations
npm run db:migrate    # Run migrations
```

### Run

```bash
# Development
npm run dev

# Production
cd site && npm run build && npm start
```

### Scrape Data

```bash
npm run scrape          # KolScan leaderboard
npm run scrape:axiom    # GMGN smart money wallets
npm run scrape:x        # X/Twitter profiles
npm run scrape:x-tracker # GMGN X tracker accounts
```

### Ingest Trades

```bash
cd site
npm run ingest        # Bulk import from JSON files
npm run ingest:poll   # Poll GMGN API for live trades
```

## Data Sources

- **[KolScan](https://kolscan.io)** — KOL wallet rankings, profit/loss, win rates
- **[GMGN](https://gmgn.ai)** — Smart money wallet discovery, trade data, PnL analytics
- **X/Twitter** — KOL social profiles and metadata

## License

MIT
