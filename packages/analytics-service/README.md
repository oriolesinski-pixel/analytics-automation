# Analytics Service

Backend API for **event ingestion**, **apps**, **events**, **analytics**, **query**, and **tiles**. This is the core service that receives events from your apps, stores them in Supabase, and exposes them to the platform and dashboards.

**Default port:** `8082`

---

## What it does

- **Ingest:** Accept analytics events (single or batch), validate, deduplicate, and persist to Supabase.
- **Apps:** Register and manage apps (by `app_key`); link to repos/schemas.
- **Events:** List and filter events (e.g. by repo `owner/name`, time range).
- **Analytics:** Aggregations, summary, funnels, realtime, user journey.
- **Query / Tiles:** Support for dashboard queries and tile definitions.

---

## Prerequisites

- Node.js 20+
- **Supabase** project (URL + service role key)
- DB migrations applied (see `migrations/` and `run-migration.js` if present)

---

## Quick start

```bash
cd packages/analytics-service
cp .env.example .env
# Edit .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Service will be at `http://localhost:8082`.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `PORT` or `ANALYTICS_PORT` | No | Port (default: `8082`) |

---

## Main endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Health check |
| GET | `/selfcheck`, `/selfcheck/detailed` | Diagnostics |
| POST | `/ingest/analytics` | Ingest analytics event(s) |
| POST | `/ingest/event` | Ingest single event |
| POST | `/ingest/batch` | Batch ingest |
| GET | `/ingest/validate/:appKey` | Validate ingest config for app |
| GET | `/events` | List events (e.g. `?full=owner/name&since=...`) |
| GET | `/apps/list` | List registered apps |
| GET | `/apps/:appKey` | Get app by key |
| POST | `/apps/register`, `/apps/create` | Register/create app |
| POST | `/apps/update`, `/apps/update-status` | Update app |
| DELETE | `/apps/:appKey` | Delete app |
| GET | `/apps/:appKey/analytics` | Analytics for app |
| GET | `/analytics/events` | Event-level analytics |
| GET | `/analytics/summary` | Summary stats |
| GET | `/analytics/apps` | App-level analytics |
| GET | `/metrics` | Service metrics |

Additional routes may be mounted under `/repos`, `/query`, `/tiles`, and secured routes; see `src/routes/` and `src/routes-secured/`.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run production build |
| `npm run worker:once` | Run analyzer worker once |
| `npm run worker:loop` | Run analyzer worker loop (script) |

---

## Deployment

- **Railway:** See `RAILWAY_DEPLOYMENT.md`, `deploy-to-railway.sh`, `nixpacks.toml`, `railway.json` in this package.
- Ensure Supabase env vars are set in the deployment environment.

---

## Related

- **[analytics-generator](../analytics-generator)** — Generates schemas; registers repos/apps that this service uses.
- **[analytics-platform](../analytics-platform)** — Dashboard; calls this service for ingest, events, and analytics.
