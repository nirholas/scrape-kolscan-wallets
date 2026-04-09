# Deployment

## Production Build

```bash
cd site
npm run build
npm start
```

The Next.js app builds static pages for all known wallet detail pages and pre-renders public routes.

## Environment Variables

All variables must be set in production:

| Variable | Required | Notes |
|:---------|:---------|:------|
| `DATABASE_URL` | Yes | PostgreSQL connection string with SSL if hosted |
| `AUTH_SECRET` | Yes | Must be the same across deploys to preserve sessions |
| `NEXT_PUBLIC_URL` | Yes | Your production URL (e.g. `https://kol.quest`) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Yes | Usually same as `NEXT_PUBLIC_URL` |
| `ADMIN_USERNAME` | Optional | Username for auto-admin bootstrap |
| `GMGN_TOKEN` | Optional | For trade polling script |

## Database

### Hosted PostgreSQL

Any PostgreSQL 14+ provider works: Neon, Supabase, Railway, PlanetScale (PG-compatible), or self-hosted.

```env
DATABASE_URL=postgres://user:password@host:5432/dbname?sslmode=require
```

### Migrations

Run migrations before deploying new schema changes:

```bash
cd site
npm run db:migrate
```

Or for quick iteration:

```bash
npm run db:push
```

## Hosting Options

### Vercel

The Next.js app deploys directly to Vercel:

1. Connect the GitHub repo
2. Set the root directory to `site`
3. Set environment variables in the Vercel dashboard
4. Deploy

**Note:** The scrapers and Bun API server run separately — they're not part of the Vercel deployment.

### Self-Hosted

Run behind a reverse proxy (nginx, Caddy):

```bash
cd site
npm run build
PORT=3000 npm start
```

Example nginx config:

```nginx
server {
    listen 443 ssl;
    server_name kol.quest;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Docker

No Dockerfile is included, but a basic setup:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY site/package*.json ./
RUN npm ci
COPY site/ ./
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Data Pipeline

The scrapers and trade ingestion run separately from the web app. In production:

### Option 1: Run scrapers on the same server

```bash
# Cron: scrape KolScan daily
0 6 * * * cd /path/to/kol-quest && node scrape.js >> /var/log/kolquest-scrape.log 2>&1

# Cron: scrape GMGN data daily
0 7 * * * cd /path/to/kol-quest && node scrape-axiom.js >> /var/log/kolquest-gmgn.log 2>&1

# Cron: scrape X profiles weekly
0 8 * * 0 cd /path/to/kol-quest && node scrape-x-profiles.js >> /var/log/kolquest-x.log 2>&1

# Cron: poll trades every 15 minutes
*/15 * * * * cd /path/to/kol-quest/site && npx tsx scripts/ingest-trades.ts poll >> /var/log/kolquest-trades.log 2>&1

# Copy fresh data after scraping
0 9 * * * cp /path/to/kol-quest/output/kolscan-leaderboard.json /path/to/kol-quest/site/data/
```

### Option 2: Commit data to GitHub

Since the app falls back to GitHub raw URLs, you can:
1. Run scrapers locally or in CI
2. Commit the JSON files to the repo
3. The app fetches them on demand

### Bun API Server

If you want to run the standalone REST API:

```bash
API_PORT=3002 bun api/index.ts
```

This is optional — the Next.js app serves all the same data through its own routes.

## Monitoring

### Health Check

The Bun API server has a health endpoint:

```bash
curl https://your-api:3002/health
```

Returns data counts and status.

### Logs

Key things to monitor:
- Scraper failures (network issues, rate limits, DOM changes)
- Trade ingestion errors (GMGN API rate limits)
- Database connection issues
- Auth session errors
