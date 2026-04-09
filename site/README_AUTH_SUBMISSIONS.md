# KolQuest Auth + Submissions Setup

This project now uses a production-style stack inspired by memescope-monday:

- Better Auth for sessions/auth providers
- Drizzle ORM + PostgreSQL for persistence
- API routes for submissions, moderation, and vouches
- Middleware-protected routes for submit/admin

## 1) Environment

Copy `.env.example` to `.env.local` and fill values.

Required:
- `DATABASE_URL`
- `AUTH_SECRET`

Optional:
- `ADMIN_EMAIL` (matching signed-in email auto-gets admin role via bootstrap endpoint)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## 2) Install + schema push

```bash
cd site
npm install
npm run db:push
```

## 3) Run

```bash
npm run dev
```

## 4) Routes

- Auth page: `/auth`
- Community list: `/community`
- Submit wallet: `/submit`
- Admin moderation: `/admin/submissions`

## 5) Key API endpoints

- `GET /api/submissions`
- `POST /api/submissions`
- `GET /api/submissions/mine`
- `GET /api/submissions/pending` (admin)
- `POST /api/submissions/:id/approve` (admin)
- `POST /api/submissions/:id/vouch`

## 6) Rate limits

Current write endpoints have in-memory rate limits for safety in a single runtime process.
For multi-instance production hardening, swap to Redis-backed rate limiting.
