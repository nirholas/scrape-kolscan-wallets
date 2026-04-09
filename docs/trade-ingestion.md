# Trade Ingestion

Trade data is ingested into PostgreSQL via the script at `site/scripts/ingest-trades.ts`. This powers the Feed (`/feed`) and trade-related features.

## Two Modes

### Batch Import

Import trades from scraped JSON wallet data files.

```bash
cd site
npm run ingest
# or: npx tsx scripts/ingest-trades.ts import
```

**How it works:**
1. Reads `solwallets.json` and `bscwallets.json` from `site/data/` or root directory
2. For each wallet, extracts per-token position data from `walletHoldings`
3. Creates `"buy"` and `"sell"` trade records from the holding history
4. Inserts in batches of 100 using `onConflictDoNothing` (safe to re-run)

**Use this for:** Initial data load, backfilling historical trades.

### Live Polling

Poll the GMGN API for recent trade activity.

```bash
cd site
npm run ingest:poll
# or: npx tsx scripts/ingest-trades.ts poll
```

**How it works:**
1. Loads wallet addresses from the scraped JSON files
2. For each wallet, hits `https://gmgn.ai/defi/quotation/v1/wallet/{chain}/{wallet}/activities`
3. Fetches up to 20 recent activities per wallet
4. Processes 10 wallets in parallel with 2000ms delays between batches
5. Inserts new trades into the database (conflict do-nothing for deduplication)

**Environment variable:** Set `GMGN_TOKEN` for authenticated GMGN API access (optional, but recommended to avoid rate limits).

**Use this for:** Keeping trade data fresh. Run on a schedule (e.g., cron every 15 minutes).

## Trade Schema

Each ingested trade creates a row in the `trade` table:

| Field | Source |
|:------|:-------|
| `walletAddress` | Wallet that made the trade |
| `chain` | `"sol"` or `"bsc"` |
| `type` | `"buy"` or `"sell"` |
| `tokenAddress` | Token contract address |
| `tokenSymbol` | Token ticker (e.g. `"BONK"`) |
| `tokenName` | Full token name |
| `tokenLogo` | Logo URL from GMGN |
| `tokenLaunchpad` | Launchpad source (if known) |
| `amountUsd` | Trade value in USD |
| `amountToken` | Token quantity traded |
| `priceUsd` | Token price at time of trade |
| `realizedProfit` | Profit/loss in USD |
| `realizedProfitPnl` | Profit/loss as a ratio |
| `fee` | Transaction fee |
| `txHash` | On-chain transaction hash |
| `source` | `"gmgn"` or `"onchain"` |
| `walletLabel` | Display name for the wallet |
| `walletTags` | JSON array of tags (e.g. `["kol", "smart_degen"]`) |
| `tradedAt` | Timestamp of the trade |

## Querying Trades

After ingestion, trades are served via `GET /api/trades`:

```bash
# Recent trades
curl 'http://localhost:3000/api/trades?limit=10'

# Solana buys only
curl 'http://localhost:3000/api/trades?chain=sol&type=buy'

# Specific wallet
curl 'http://localhost:3000/api/trades?wallet=CyaE1Vxv...'

# Pagination with cursor
curl 'http://localhost:3000/api/trades?cursor=2025-01-15T12:30:00.000Z'
```

## Deduplication

Both import modes use `onConflictDoNothing`, so re-running ingestion is safe. Trades are identified by their primary key (ULID/UUID generated at insert time), and the conflict check prevents exact duplicates.

## Running on a Schedule

For continuous trade data, set up polling as a cron job:

```bash
# Every 15 minutes
*/15 * * * * cd /path/to/kol-quest/site && npx tsx scripts/ingest-trades.ts poll >> /var/log/kolquest-trades.log 2>&1
```
