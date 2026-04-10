## Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

---

## Site-Specific Context

This is the Next.js 14 web application. Key paths:
- `app/` — pages and API routes (App Router)
- `lib/` — shared utilities, types, auth config
- `drizzle/db/schema.ts` — PostgreSQL schema
- `components/` — shared React components (inside `app/components/`)

### Commands (run from this directory)
```bash
npm run dev           # Start dev server on port 3000
npm run build         # Production build
npm run db:push       # Push schema to database
npm run db:generate   # Generate migration from schema changes
npm run ingest        # Batch import trades from JSON
npm run ingest:poll   # Poll GMGN API for live trades
```

### Code Quality
- **No lazy shortcuts.** Complete implementations, no TODOs, no stubs.
- **TypeScript strictly.** No `any` unless documented. Fix type errors before committing.
- **Validate at boundaries.** All API routes use Zod for input validation.
- **Follow patterns.** Check how similar features work before adding new code.
- **Test your changes.** Run `npx tsc --noEmit` to verify no type errors.

### x402 Payment Gating

**All `/api/**` routes are x402-gated by default.** The middleware uses a catch-all
`/api/:path*` matcher and gates every route unless it is listed in `X402_FREE_PREFIXES`
in `lib/x402.ts`. Session-authenticated users (web app) bypass payment automatically.

**When adding a new API route:**
- Public/data routes: no changes needed — gated automatically.
- Internal/infra routes that must stay free: add the prefix to `X402_FREE_PREFIXES` in
  `site/lib/x402.ts` with a comment explaining why it's exempt.

**Currently exempt prefixes** (defined in `lib/x402.ts`):
- `/api/auth` — Better-Auth (auth itself cannot require payment)
- `/api/health` — Infra health probe
- `/api/openapi.json` — OpenAPI spec for agent discoverability
- `/api/admin` — Protected by session + admin role check at handler level
- `/api/cron` — Protected by `CRON_SECRET` header (Vercel cron)
- `/api/cache` — Internal cache management
- `/api/trades/ingest` — Protected by `INGEST_SECRET` header
