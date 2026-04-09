# Features

Every page and feature in KolQuest, what it does, and how it works.

---

## Public Pages

### Homepage (`/`)

Landing page with a 3D animated hero section and overview stats.

**Shows:**
- Stats bar: KolScan KOL count, GMGN Solana/BSC wallet counts, total unique Solana wallets
- Top 5 wallets from each source (KolScan daily, GMGN Solana 7d, GMGN BSC 7d)
- Source cards linking to the main leaderboard pages

---

### KolScan Leaderboard (`/leaderboard`)

Sortable, searchable table of all KolScan KOL wallets.

**Data per row:** Rank, name, profit (SOL), wins, losses, win rate  
**Timeframes:** Daily, Weekly, Monthly (tab switcher)  
**Sorting:** Click any column header — profit, wins, losses, win rate, name  
**Search:** Filter by wallet name or address  
**Export:** CSV/JSON download of the filtered view

**Variants:**
| Route | Behavior |
|:------|:---------|
| `/leaderboard` | Default sort by profit |
| `/top-performers` | Pre-sorted by win rate |
| `/most-profitable` | Pre-sorted by profit |

Click any wallet name to go to its detail page (`/wallet/[address]`).

---

### GMGN Solana (`/gmgn-sol`)

Smart money wallets from GMGN, Solana chain.

**Data per row:** Name, avatar, category badge, tags, profit 7D/30D, buys, sells, win rate, Twitter link + followers  
**Categories:** smart_degen, kol, snipe_bot, launchpad_smart, fresh_wallet, etc.  
**Sorting:** Profit (1d/7d/30d), buys, sells, win rate  
**Search:** Name, address, or Twitter handle

Click any wallet to go to `/gmgn-wallet/[address]?chain=sol`.

---

### GMGN BSC (`/bsc`)

Same layout and features as GMGN Solana, but for Binance Smart Chain wallets.

---

### All Solana (`/all-solana`)

Unified leaderboard merging KolScan + GMGN Solana data.

- Deduplicates by wallet address (GMGN data preferred when both exist)
- Shows a "source" indicator (KolScan vs GMGN)
- ~1,300+ unique wallets
- Same sorting/filtering/search as other leaderboards

---

### KolScan Wallet Detail (`/wallet/[address]`)

Deep dive into a single KolScan wallet. Pages are statically generated for all known wallets.

**Sections:**
1. **Header** — Avatar (from X if available), name, Twitter/Telegram links, follower count
2. **Quick Actions** — External links to Solscan, GMGN, KolScan, Padre, Birdeye
3. **Stats Panel** — Win rate, total trades, wins/losses, total profit, best timeframe
4. **Leaderboard Rankings** — Daily/Weekly/Monthly rank out of total wallets, with visual percentile bar
5. **X/Twitter Profile** — Header image, followers, following, tweets, likes, media, location, join date
6. **PnL by Timeframe** — Three cards showing profit, wins, losses, win rate, edge for each timeframe
7. **PnL Calendar** — Interactive heatmap of daily profit/loss
8. **Top KOLs Today** — Grid of 6 similar top performers

---

### GMGN Wallet Detail (`/gmgn-wallet/[address]`)

Deep dive into a GMGN smart money wallet. Chain is passed as a query param (`?chain=sol` or `?chain=bsc`).

**Sections:**
1. **Header** — Avatar, name, chain badge, category badges, tags
2. **Stats Grid** — X followers, category, balance (SOL/BNB), last active
3. **X/Twitter Profile** — Same as KolScan detail
4. **PnL by Timeframe** — 1D/7D/30D cards with realized profit, buys, sells, transactions, win rate
5. **Trading Stats** — Volume 7D/30D, avg cost, avg hold time, ROI, win rate 1D, net inflow
6. **PnL Distribution (7D)** — Bucketed trade outcomes: <-50%, -50%–0, 0–2x, 2–5x, >5x
7. **Daily Profit Sparkline** — Bar chart of 7-day daily PnL with weekday labels

---

### Community (`/community`)

Displays all approved community-submitted wallets.

**Data per row:** Label, wallet address, chain (Solana/BSC), Twitter link, Telegram link  
**Limit:** 500 most recent approved submissions  

Links to `/submit` for adding new wallets.

---

### Calendar (`/calendar`)

PnL calendar heatmap across all tracked wallets.

- Select month/year
- Cell color = profit (green) or loss (red), intensity = magnitude
- Click cells for breakdown

---

### Docs (`/docs`)

Documentation page with four sections: API Playground, REST API reference, MCP Server setup, and Technical Writeup on reverse-engineering KolScan.

---

## Authenticated Pages

These require a signed-in user. Unauthenticated visitors are redirected to `/auth`.

### Track (`/track`)

Real-time token discovery tool showing new tokens being traded by smart wallets.

**Filters:** Time window (5m, 1h, 6h, 24h), wallet group (all, default, axiom)  
**Data per token:** Name, market cap, buy/sell counts, wallet count, net inflow, token age  
**Search:** Filter by token name or address

---

### Monitor (`/monitor`)

Live activity feed from smart money wallets (GMGN-style).

**Data per trade:** Wallet address + label, category badge, BUY/SELL, token, amount USD, realized profit, time ago  
**Filters:** Chain (Sol/BSC), category, wallet search  
**Interactions:** Click wallet to go to detail page

---

### Tracker (`/tracker`)

Personal watchlist of saved wallets.

**Features:**
- Add wallets to your watchlist
- Organize into custom groups
- Sort by label, balance, profit, win rate, tracked time, last active
- Search your watchlisted wallets

**Data stored:** Per-user in the `watchlist` database table.

---

### Feed (`/feed`)

Real-time trade stream from tracked wallets.

**Data per trade:** Token symbol/name/logo, wallet address + label, BUY/SELL, amount USD, price, time ago  
**Filters:** Chain (sol/bsc/all), type (buy/sell/all)  
**Pagination:** Cursor-based infinite scroll, loads 50 per page  
**Auto-refresh:** Polls every 15 seconds (toggleable)

---

### Submit Wallet (`/submit`)

Form for submitting a wallet to the community list.

**Fields:**
| Field | Required | Validation |
|:------|:---------|:-----------|
| Wallet address | Yes | 24–80 characters |
| Chain | Yes | Solana or BSC |
| Label | Yes | 2–80 characters |
| Notes | No | Max 800 characters |
| Twitter URL | No | Must be https |
| Telegram URL | No | Must be https |

**Rate limit:** 12 submissions per hour per user  
**Admin shortcut:** Admin submissions are auto-approved

---

### Admin Panel (`/admin/submissions`)

Admin-only page for moderating pending wallet submissions.

**Actions:** Approve (moves to community list) or Reject (removes from queue)  
**Access:** Requires `role = "admin"` — returns 403 otherwise
