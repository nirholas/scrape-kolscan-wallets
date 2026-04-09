# CLAUDE.md — KolQuest Agent Guide

## Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

---

## Project Layout

```
kol-quest/
├── scrape*.js / scrape-kolscan.ts   # Data scrapers (Playwright)
├── api/index.ts                     # Bun REST API server (port 3002)
├── mcp/index.ts                     # MCP server for AI assistants (stdio)
├── fetchers/                        # On-demand wallet data fetchers (multi-source)
├── output/                          # Raw scraper output (JSON)
├── docs/                            # Full documentation
└── site/                            # Next.js 14 web application
    ├── app/                         # App router pages and API routes
    ├── data/                        # JSON data files consumed by the app
    ├── drizzle/db/schema.ts         # PostgreSQL schema (Drizzle ORM)
    ├── drizzle/migrations/          # Migration files
    ├── lib/                         # Shared utilities and types
    └── scripts/                     # ingest-trades.ts, download-avatars.js
```

**Two package.json roots:**
- Root (`/`) — scrapers, Bun API, MCP server
- `site/` — Next.js application

---

## Common Commands

All commands from the repo root unless noted.

```bash
# Development
npm run dev               # Start Next.js dev server (port 3000)
npm run build             # Build Next.js for production

# Scraping (updates JSON data files)
npm run scrape            # KolScan leaderboard (~472 wallets) → output/kolscan-leaderboard.json
npm run scrape:axiom      # GMGN smart money → site/data/solwallets.json + bscwallets.json
npm run scrape:x          # X/Twitter profiles → site/data/x-profiles.json
npm run scrape:x-tracker  # GMGN X tracker → site/data/gmgn-x-tracker.json

# Database (run from site/)
cd site && npm run db:push        # Push schema to DB (development)
cd site && npm run db:generate    # Generate migration SQL from schema changes
cd site && npm run db:migrate     # Apply pending migrations

# Trade ingestion (run from site/)
cd site && npm run ingest         # Batch import from JSON files
cd site && npm run ingest:poll    # Live poll GMGN API for recent trades

# Servers
npm run api               # Bun REST API (port 3002)
npm run mcp               # MCP stdio server for AI assistants
```

---

## Environment Variables (`site/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | `postgres://user:pass@host:5432/dbname` |
| `AUTH_SECRET` | Yes | Session signing secret (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_URL` | Recommended | App public URL (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Recommended | Auth URL (usually same as above) |
| `ADMIN_USERNAME` | Optional | Auto-promotes this username to admin on first login |
| `GMGN_TOKEN` | Optional | Bearer token for GMGN API (reduces rate-limit hits) |
| `X402_ENABLED` | Optional | Set to `false` to disable x402 payment gating (default: enabled) |
| `X402_PAYMENT_ADDRESS` | Optional | Override the USDC recipient address on Base mainnet for x402 payments |

---

## Tech Stack

- **Frontend/API:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Better-Auth (Solana ed25519, Ethereum EIP-191/SIWE, email/password)
- **Rate limiting:** Upstash Redis + `@upstash/ratelimit`
- **Scrapers:** Playwright (Chromium)
- **API/MCP servers:** Bun runtime

---

## Data Model

### Static data (JSON files)
Read from `site/data/` by `site/lib/data.ts`. Falls back to GitHub raw URLs if local files are missing.

Key files:
- `site/data/kolscan-leaderboard.json` — KolScan KOL rankings
- `site/data/solwallets.json` — GMGN Solana wallets
- `site/data/bscwallets.json` — GMGN BSC wallets
- `site/data/x-profiles.json` — X/Twitter profile metadata

### Dynamic data (PostgreSQL tables)
Defined in `site/drizzle/db/schema.ts`:
- `trade` — ingested on-chain/GMGN trade records
- `wallet_submission` — community-submitted wallets
- `wallet_vouch` — user vouches for submissions
- `wallet_address` — approved wallet addresses
- `watchlist` — user watchlist entries
- `user`, `session`, `account`, `verification` — Better-Auth tables

### Core TypeScript types (`site/lib/types.ts`)
- `KolEntry` — KolScan leaderboard entry
- `GmgnWallet` — GMGN normalized wallet (Solana or BSC)
- `UnifiedWallet` — merged view used by the All Solana page

---

## Key Conventions

### Wallet name/label resolution
GMGN JSON has two layers of wallet identity:
- Top-level wallet entry: `name`, `twitter_username`, `twitter_name`
- `walletDetails[address]`: `sns.id` / `sns_id`, `ens` / `ens_name`, `detail.name`

When parsing GMGN raw data, merge both layers for the best display label. See `site/lib/data.ts` (`parseGmgnRaw`).

### Data deduplication (All Solana view)
- KolScan + GMGN wallets merged by `wallet_address`
- GMGN data takes priority (richer fields) when both sources have the same address
- Wallets found in both get a `"kolscan"` tag appended

### API routes (`site/app/api/`)
All API routes validate input at the boundary using Zod. Rate limiting is applied with Upstash Redis where configured.

### Auth
Three providers: `"credential"` (email/password), `"solana-wallet"` (ed25519 sign), `"siwe"` (Ethereum SIWE). Roles: `"user"` and `"admin"`. Admin role can be seeded via `ADMIN_USERNAME` env var.

### Origin assertion
`site/lib/assert-origin.ts` — call at the top of API routes that mutate data to reject cross-origin requests.

---

## Important Files

| File | Purpose |
|---|---|
| `site/lib/data.ts` | All static data loading and parsing |
| `site/lib/types.ts` | Shared TypeScript interfaces |
| `site/lib/auth.ts` | Better-Auth server config |
| `site/lib/auth-client.ts` | Better-Auth browser client |
| `site/drizzle/db/schema.ts` | Full DB schema |
| `site/middleware.ts` | Next.js middleware (auth gates) |
| `site/app/layout.tsx` | Root layout, nav, footer |
| `api/index.ts` | Standalone Bun REST API |
| `mcp/index.ts` | MCP server (AI assistant interface) |

---

## Code Quality Standards

### No lazy shortcuts
- **Read before editing.** Always read enough context to understand functions, types, and call sites before making changes.
- **Complete implementations.** No placeholder code, no `// TODO: implement later`, no stubbed returns. Finish the work.
- **Type safety.** Use TypeScript strictly — no `any` unless absolutely necessary and documented. Infer types where possible; define explicit interfaces for API boundaries.
- **Error handling.** Catch errors explicitly. API routes return proper HTTP status codes with meaningful messages. Never swallow errors silently.
- **Validation at boundaries.** All user input is validated with Zod schemas at API route entry points. Never trust client data.

### Consistency
- **Follow existing patterns.** Look at how similar features are implemented before adding new code. Match the style.
- **File organization.** Components in `site/app/components/`, utilities in `site/lib/`, API routes in `site/app/api/`.
- **Naming.** camelCase for variables/functions, PascalCase for components/types, kebab-case for files and routes.
- **Imports.** Use absolute imports (`@/lib/...`, `@/components/...`) inside the site package. Relative imports for adjacent files only.

### Testing changes
- After editing code, verify there are no TypeScript errors by checking with `npx tsc --noEmit` in the `site/` directory.
- For API changes, test the endpoint manually with curl or the browser.
- For UI changes, check the page renders without errors in dev mode.

### Git hygiene
- Write clear commit messages: imperative mood, concise, describe the "what" not the "how".
- Keep commits atomic — one logical change per commit.

---

## Common Patterns

### Adding a new API route
1. Create `site/app/api/{route}/route.ts`
2. Define Zod schema for request body/params
3. Call `assertOrigin(request)` for mutations
4. Get session with `auth.api.getSession({ headers: request.headers })`
5. Validate input, query database, return `NextResponse.json(...)`
6. Add rate limiting if user-facing

### Adding a new page
1. Create `site/app/{route}/page.tsx`
2. Use async server components for data fetching
3. Import shared components from `site/app/components/`
4. Use Tailwind for styling — match existing design tokens

### Working with wallet data
1. Static data: use functions from `site/lib/data.ts` (`getData()`, `getGmgnSolData()`, etc.)
2. Dynamic data: query via Drizzle from `site/drizzle/db/index.ts`
3. For new wallet fields, update `site/lib/types.ts` interfaces first

### Database changes
1. Edit `site/drizzle/db/schema.ts`
2. Run `cd site && npm run db:push` for dev
3. Run `cd site && npm run db:generate` to create a migration file for prod
4. Update TypeScript types if schema changes affect API responses

---

## Anti-Patterns (Don't Do This)

- **Don't hardcode wallet addresses or API keys.** Use environment variables.
- **Don't bypass validation.** Even internal calls should go through Zod schemas.
- **Don't use `fetch()` for database operations.** Use Drizzle queries directly on the server.
- **Don't put business logic in components.** Extract to `lib/` utilities or server actions.
- **Don't leave console.log statements.** Remove debug logging before committing.
- **Don't ignore TypeScript errors.** Fix them or document why the exception is necessary with a comment.

---

## Docs

Full documentation lives in `docs/`:
- `docs/architecture.md` — system design and data flow
- `docs/database.md` — table schemas and Drizzle usage
- `docs/api-reference.md` — REST API endpoints
- `docs/authentication.md` — auth flow and providers
- `docs/trade-ingestion.md` — trade import and polling
- `docs/data-sources.md` — fetcher roadmap and external API status
- `docs/scrapers.md` — scraper details
- `docs/mcp-server.md` — MCP server tools
- `docs/deployment.md` — Vercel + environment setup
