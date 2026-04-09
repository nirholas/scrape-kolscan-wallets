# Database

KolQuest uses PostgreSQL with Drizzle ORM. The schema is defined in `site/drizzle/db/schema.ts`.

## Setup

```bash
cd site

# Push schema directly to database (development)
npm run db:push

# Or use migrations (production)
npm run db:generate   # Generate migration SQL from schema changes
npm run db:migrate    # Apply pending migrations
```

## Tables

### user

Core user account table. Created by Better-Auth on signup.

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | text PK | UUID |
| `name` | text | Display name |
| `email` | text UNIQUE | Email (or `{address}@solana.wallet` for wallet users) |
| `email_verified` | boolean | Default `false` |
| `image` | text | Avatar URL |
| `role` | text | `"user"` or `"admin"` |
| `username` | varchar(20) UNIQUE | Login username |
| `display_username` | varchar(20) | Case-preserved display username |
| `created_at` | timestamp | Auto-set |
| `updated_at` | timestamp | Auto-set |

### session

Active user sessions. Managed by Better-Auth.

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | text PK | Session ID |
| `expires_at` | timestamp | Session expiry |
| `token` | text UNIQUE | Session token (stored in cookie) |
| `ip_address` | text | Client IP |
| `user_agent` | text | Client user agent |
| `user_id` | text FK → user | Cascades on delete |

### account

Linked authentication providers (email, Solana, Ethereum).

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | text PK | Account ID |
| `account_id` | text | Provider-specific account identifier |
| `provider_id` | text | `"credential"`, `"siwe"`, `"solana-wallet"` |
| `user_id` | text FK → user | Cascades on delete |
| `password` | text | Hashed password (credential provider only) |
| `access_token` | text | OAuth access token |
| `refresh_token` | text | OAuth refresh token |

### verification

Email verification tokens. Managed by Better-Auth.

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | text PK | Token ID |
| `identifier` | text | Email address |
| `value` | text | Verification code |
| `expires_at` | timestamp | Token expiry |

### wallet_submission

Community-submitted wallets awaiting moderation.

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | text PK | UUID |
| `wallet_address` | varchar(96) | The wallet address |
| `chain` | text | `"solana"` or `"bsc"` |
| `label` | varchar(120) | User-given name |
| `notes` | text | Optional description |
| `twitter` | text | Optional Twitter URL |
| `telegram` | text | Optional Telegram URL |
| `status` | text | `"pending"`, `"approved"`, or `"rejected"` |
| `submitted_by` | text FK → user | Cascades on delete |
| `created_at` | timestamp | Auto-set |
| `updated_at` | timestamp | Auto-set |

**Indexes:** `status`, `chain`, `wallet_address`

### wallet_vouch

Community votes on wallet submissions.

| Column | Type | Description |
|:-------|:-----|:------------|
| `user_id` | text FK → user | Cascades on delete |
| `submission_id` | text FK → wallet_submission | Cascades on delete |
| `weight` | integer | Vote weight (default 1) |
| `created_at` | timestamp | Auto-set |

**Primary key:** `(user_id, submission_id)` — one vouch per user per submission.

### wallet_address

User-linked wallet addresses.

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | text PK | UUID |
| `wallet_address` | text | The address |
| `chain_id` | integer | Chain identifier |
| `user_id` | text FK → user | Cascades on delete |
| `created_at` | timestamp | Auto-set |

### trade

Trade activity records from smart wallets.

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | text PK | ULID or UUID |
| `wallet_address` | varchar(96) | Trader's wallet |
| `chain` | text | `"sol"` or `"bsc"` |
| `type` | text | `"buy"` or `"sell"` |
| `token_address` | varchar(96) | Token contract address |
| `token_symbol` | varchar(32) | e.g. `"BONK"` |
| `token_name` | varchar(120) | Full token name |
| `token_logo` | text | Logo URL |
| `token_launchpad` | varchar(60) | Launchpad source |
| `amount_usd` | double | Trade value in USD |
| `amount_token` | double | Token quantity |
| `price_usd` | double | Token price at trade time |
| `realized_profit` | double | Profit/loss in USD |
| `realized_profit_pnl` | double | Profit/loss as percentage |
| `fee` | double | Transaction fee |
| `tx_hash` | varchar(128) | Transaction hash |
| `source` | text | `"gmgn"` or `"onchain"` |
| `wallet_label` | varchar(120) | Display name for the wallet |
| `wallet_tags` | text | JSON array as string |
| `traded_at` | timestamp | When the trade happened |
| `created_at` | timestamp | When the record was inserted |

**Indexes:** `wallet_address`, `chain`, `traded_at`, `token_address`

### watchlist

User-saved wallet watchlist.

| Column | Type | Description |
|:-------|:-----|:------------|
| `user_id` | text FK → user | Cascades on delete |
| `wallet_address` | varchar(96) | Watched wallet |
| `chain` | text | `"sol"` or `"bsc"` |
| `label` | varchar(120) | Custom label |
| `group_name` | varchar(60) | Custom group name |
| `created_at` | timestamp | Auto-set |

**Primary key:** `(user_id, wallet_address)` — one entry per user per wallet.  
**Indexes:** `user_id`

## Entity Relationships

```
user
 ├── session (1:many, cascade delete)
 ├── account (1:many, cascade delete)
 ├── wallet_submission (1:many, cascade delete)
 ├── wallet_vouch (1:many, cascade delete)
 ├── wallet_address (1:many, cascade delete)
 └── watchlist (1:many, cascade delete)

wallet_submission
 └── wallet_vouch (1:many, cascade delete)
```

All foreign keys cascade on delete — removing a user cleans up all their data.
