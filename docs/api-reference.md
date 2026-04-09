# API Reference

KolQuest has two API surfaces:
1. **Next.js API routes** (`/api/*`) — serve the web app, handle auth, submissions, trades, watchlists
2. **Bun REST API** (port 3002) — standalone read-only API for KolScan + GMGN data

---

## Next.js API Routes

Base URL: your app URL (e.g. `http://localhost:3000`)

### Submissions

#### `GET /api/submissions`

List all approved community wallet submissions.

**Auth:** None  
**Response:**
```json
{
  "submissions": [
    {
      "id": "uuid",
      "walletAddress": "...",
      "chain": "solana",
      "label": "AlphaWallet",
      "notes": "Found this on CT",
      "twitter": "https://x.com/...",
      "telegram": null,
      "status": "approved",
      "createdAt": "2025-01-15T..."
    }
  ]
}
```

#### `POST /api/submissions`

Submit a new wallet for community review.

**Auth:** Required  
**Rate limit:** 12/hour per user  
**Body:**
```json
{
  "walletAddress": "CyaE1Vxv...",
  "chain": "solana",
  "label": "AlphaWhale",
  "notes": "Top degen trader",
  "twitter": "https://x.com/...",
  "telegram": "https://t.me/..."
}
```

- `walletAddress` (required) — trimmed string
- `chain` (required) — `"solana"` or `"bsc"`
- `label` (required) — 2–80 chars
- `notes` (optional) — max 800 chars
- `twitter` (optional) — https URL
- `telegram` (optional) — https URL

**Behavior:**
- Returns 409 if wallet+chain already submitted
- Auto-approves if user has admin role
- Otherwise sets status to `"pending"`

#### `GET /api/submissions/mine`

List the authenticated user's own submissions (all statuses).

**Auth:** Required

#### `GET /api/submissions/pending`

List all pending submissions awaiting moderation.

**Auth:** Admin only (403 otherwise)

#### `POST /api/submissions/[id]/approve`

Approve a pending submission.

**Auth:** Admin only

#### `POST /api/submissions/[id]/reject`

Reject a pending submission.

**Auth:** Admin only

---

### Trades

#### `GET /api/trades`

Query trade activity with cursor-based pagination.

**Auth:** None

**Query params:**
| Param | Type | Description | Default |
|:------|:-----|:------------|:--------|
| `chain` | string | `"sol"`, `"bsc"`, or omit for all | all |
| `wallet` | string | Filter by wallet address | — |
| `type` | string | `"buy"` or `"sell"` | all |
| `limit` | number | 1–200 | 50 |
| `cursor` | string | ISO timestamp for pagination | — |

**Response:**
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
      "tokenLaunchpad": null,
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

`nextCursor` is `null` when there are no more results. Pass it as `?cursor=` to get the next page.

---

### Watchlist

All watchlist endpoints require authentication.

#### `GET /api/watchlist`

Get the authenticated user's watchlisted wallets.

**Response:**
```json
[
  {
    "walletAddress": "...",
    "chain": "sol",
    "label": "My Alpha Wallet",
    "groupName": "Degens",
    "createdAt": "2025-01-15T..."
  }
]
```

#### `POST /api/watchlist`

Add a wallet to the watchlist.

**Body:**
```json
{
  "walletAddress": "CyaE1Vxv...",
  "chain": "sol",
  "label": "My Alpha Wallet",
  "groupName": "Degens"
}
```

- `walletAddress` (required, max 96 chars)
- `chain` (required, `"sol"` or `"bsc"`)
- `label` (optional, max 120 chars)
- `groupName` (optional, max 60 chars)

Silently ignores duplicates (conflict do-nothing).

#### `PATCH /api/watchlist`

Update label or group for a watchlisted wallet.

**Body:**
```json
{
  "walletAddress": "CyaE1Vxv...",
  "label": "New Name",
  "groupName": "New Group"
}
```

#### `DELETE /api/watchlist`

Remove a wallet from the watchlist.

**Body:**
```json
{
  "walletAddress": "CyaE1Vxv..."
}
```

---

### Admin

#### `POST /api/admin/bootstrap-role`

Grant admin role to the current user if their username matches `ADMIN_USERNAME` env var.

**Auth:** Required  
**Response:** `{ "ok": true }` or 403

---

### Authentication

All auth endpoints are handled by Better-Auth at `/api/auth/[...all]`. Key endpoints:

| Endpoint | Method | Description |
|:---------|:-------|:------------|
| `/api/auth/sign-up/email` | POST | Register with username + password |
| `/api/auth/sign-in/email` | POST | Sign in with username + password |
| `/api/auth/sign-out` | POST | End session |
| `/api/auth/get-session` | GET | Get current session |
| `/api/auth/siwe/nonce` | POST | Get nonce for Ethereum wallet sign-in |
| `/api/auth/siwe/verify` | POST | Verify Ethereum wallet signature |
| `/api/auth/solana/nonce` | POST | Get nonce for Solana wallet sign-in |
| `/api/auth/solana/verify` | POST | Verify Solana wallet signature |

See [authentication.md](authentication.md) for detailed auth flows.

---

## Bun REST API

Standalone read-only API serving scraped data. Start with:

```bash
bun api/index.ts          # default port 3002
API_PORT=8080 bun api/index.ts
```

All endpoints are `GET`, return JSON, and have CORS enabled.

### KolScan Endpoints

#### `GET /health`

Health check with data counts.

```json
{
  "status": "ok",
  "kolscan": { "entries": 1304, "uniqueWallets": 472 },
  "gmgn": { "sol": 1023, "bsc": 412 }
}
```

#### `GET /api/leaderboard`

Paginated KolScan leaderboard.

| Param | Type | Description | Default |
|:------|:-----|:------------|:--------|
| `timeframe` | number | 1 (daily), 7 (weekly), 30 (monthly) | all |
| `sort` | string | `profit`, `wins`, `losses`, `winrate`, `name` | `profit` |
| `order` | string | `asc` or `desc` | `desc` |
| `page` | number | 1-indexed page number | 1 |
| `limit` | number | Results per page (max 500) | 50 |
| `search` | string | Filter by name or wallet address | — |

**Response:**
```json
{
  "data": [...],
  "total": 472,
  "page": 1,
  "totalPages": 10
}
```

#### `GET /api/wallets`

List all unique wallet addresses.

#### `GET /api/wallet/:address`

Detailed stats for a single wallet.

```json
{
  "wallet_address": "...",
  "name": "Cented",
  "twitter": "https://x.com/Cented7",
  "telegram": null,
  "stats": {
    "total_profit": 342.5,
    "total_wins": 280,
    "total_losses": 190,
    "total_trades": 470,
    "win_rate": 59.6
  },
  "rankings": { "daily": 5, "weekly": 12, "monthly": 8 },
  "timeframes": [...]
}
```

#### `GET /api/top`

Top performers for a given timeframe.

| Param | Type | Default |
|:------|:-----|:--------|
| `timeframe` | number | 1 |
| `sort` | string | `profit` |
| `limit` | number (1–100) | 10 |

#### `GET /api/stats`

Aggregate statistics: entry counts, unique wallets, timeframes, top daily performer.

#### `GET /api/export/gmgn`

All wallets formatted for GMGN bulk import: `[{ "address": "...", "label": "..." }]`

### GMGN Endpoints

#### `GET /api/gmgn/sol`

Solana smart money wallets.

| Param | Type | Description | Default |
|:------|:-----|:------------|:--------|
| `sort` | string | Sort field | `realized_profit_7d` |
| `order` | string | `asc` or `desc` | `desc` |
| `page` | number | Page number | 1 |
| `limit` | number | Max 500 | 50 |
| `category` | string | `smart_degen`, `kol`, `snipe_bot`, `launchpad_smart`, `fresh_wallet` | — |
| `search` | string | Search by name, address, or Twitter | — |

#### `GET /api/gmgn/bsc`

BSC smart money wallets. Same params as `/api/gmgn/sol`.

#### `GET /api/gmgn/wallet/:address`

Full GMGN data for a specific wallet (all metrics, PnL distribution, sparkline).

#### `GET /api/gmgn/categories`

List categories and wallet counts.

| Param | Type | Default |
|:------|:-----|:--------|
| `chain` | string | `sol` |

```json
{
  "chain": "sol",
  "categories": {
    "smart_degen": 312,
    "kol": 180,
    "snipe_bot": 95,
    "launchpad_smart": 45,
    "fresh_wallet": 391
  }
}
```

#### `GET /api/gmgn/stats`

Aggregate GMGN stats with top 3 performers per chain.
