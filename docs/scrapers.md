# Scrapers

KolQuest uses Playwright-based scrapers to collect data from three external sources. All scrapers live in the project root.

## Prerequisites

```bash
npm install
npx playwright install chromium
sudo npx playwright install-deps chromium   # Linux only
```

---

## KolScan Leaderboard (`scrape.js`)

Scrapes KOL wallet data from [kolscan.io/leaderboard](https://kolscan.io/leaderboard).

```bash
npm run scrape
```

### How It Works

1. Opens the KolScan leaderboard page in a headless Chromium browser
2. Intercepts POST requests to `/api/leaderboard` (the page uses a POST API, not GET)
3. Scrolls the `#mainScroll` container to trigger infinite scroll loading
4. Clicks through Daily / Weekly / Monthly tabs to capture all timeframes
5. Scrolls up to 30 times per timeframe with 1500ms delays
6. Deduplicates by wallet address

### Output

| File | Content |
|:-----|:--------|
| `output/kolscan-leaderboard.json` | Full dataset (all timeframes) |
| `output/wallets.txt` | Sorted list of unique wallet addresses |

### Data Schema

```json
{
  "wallet_address": "CyaE1Vxv...",
  "name": "Cented",
  "twitter": "https://x.com/Cented7",
  "telegram": null,
  "profit": 116.70,
  "wins": 99,
  "losses": 135,
  "timeframe": 1
}
```

Timeframe values: `1` = Daily, `7` = Weekly, `30` = Monthly.

### Typical Results

~1,304 entries across ~472 unique wallets, ~434 per timeframe.

---

## GMGN Smart Wallets (`scrape-axiom.js`)

Scrapes smart money wallet data from GMGN/Axiom sources.

```bash
npm run scrape:axiom
```

### How It Works

1. Opens the Axiom.trade pulse page
2. Intercepts all JSON API responses
3. Extracts wallets from API responses, page DOM, and data attributes
4. Validates addresses against Solana base58 pattern (32–44 chars)
5. Tries multiple tabs (Smart Wallets, Top Traders, Leaderboard)
6. Scrolls up to 50 times with 2000ms delays, stops after 5 stale scrolls
7. Falls back to alternative URLs if primary yields few wallets

### Output

| File | Content |
|:-----|:--------|
| `output/axiom-smart-wallets.json` | Full wallet data + API response samples |
| `output/axiom-wallets.txt` | Sorted unique wallet addresses |
| `output/axiom-debug.png` | Debug screenshot |

### Notes

The main GMGN wallet data files (`solwallets.json`, `bscwallets.json`) are typically pulled from the GMGN API directly and include much richer data (profit breakdowns, PnL distribution, sparklines, etc.) than what's available from Axiom scraping.

---

## X/Twitter Profiles (`scrape-x-profiles.js`)

Scrapes public X profile data for all KOL Twitter handles found across data sources.

```bash
npm run scrape:x
```

### How It Works

1. Collects all Twitter usernames from:
   - `site/data/kolscan-leaderboard.json` (and `output/` fallback)
   - `solwallets.json` / `bscwallets.json` (both `site/data/` and root)
   - Parses `twitter` URLs and `twitter_username` fields
2. Runs 8 concurrent Playwright browser workers
3. For each username, loads the X profile page
4. Intercepts GraphQL `UserByScreenName` and `UserResultByScreenName` API responses
5. Extracts profile data from the GraphQL response
6. Blocks image/media loading to speed up scraping

### Resumption

- Results are cached to `site/data/x-profiles.json` as they're scraped
- Profiles scraped less than 7 days ago are skipped on re-run
- Ctrl+C saves progress — re-run to continue from where it left off

### Rate Limiting

If X returns a rate limit response, the scraper pauses for 60 seconds then retries.

### Output

`site/data/x-profiles.json` — keyed by lowercase username:

```json
{
  "cented7": {
    "id": "123456789",
    "username": "Cented7",
    "name": "Cented",
    "bio": "Trading on Solana...",
    "location": null,
    "website": "https://...",
    "avatar": "https://pbs.twimg.com/...",
    "header": "https://pbs.twimg.com/...",
    "followers": 45200,
    "following": 312,
    "tweets": 8500,
    "likes": 12000,
    "media": 450,
    "verified": false,
    "protected": false,
    "joinDate": "2021-03-15T00:00:00.000Z",
    "pinnedTweetId": "...",
    "scrapedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

### Error States

Profiles that can't be scraped get an `error` field:
- `UNAVAILABLE:@username` — Account unavailable
- `NOT_FOUND:@username` — Account doesn't exist
- `SUSPENDED:@username` — Account suspended
- `RATE_LIMIT` — Rate limited (will retry on next run)

---

## GMGN X Tracker (`scrape-gmgn-x-tracker.js`)

Scrapes GMGN's X tracker accounts (KOL accounts that GMGN monitors).

```bash
npm run scrape:x-tracker
```

### Output

`site/data/gmgn-x-tracker.json`:

```json
{
  "meta": {
    "scrapedAt": "2025-01-15T...",
    "source": "gmgn.ai",
    "totalAccounts": 150
  },
  "accounts": [
    {
      "handle": "CryptoWhale",
      "name": "Crypto Whale",
      "avatar": "https://...",
      "subscribers": 1200,
      "followers": 85000,
      "tag": "kol",
      "verified": true,
      "bio": "..."
    }
  ]
}
```

---

## Copying Data to the App

After scraping, copy the data files to where the Next.js app expects them:

```bash
cp output/kolscan-leaderboard.json site/data/
cp solwallets.json site/data/
cp bscwallets.json site/data/
```

If local files are missing, the app falls back to GitHub raw URLs pointing at the last committed data.
