# Analytics Generator

Service that **analyzes your codebase** (via GitHub) and **generates analytics schemas** using an LLM. Schemas describe events, properties, and metadata so the rest of the pipeline can ingest and display analytics without runtime inference.

**Default port:** `8081`

---

## What it does

- **GitHub integration:** Webhooks, App auth, list installations and repos.
- **Schema generation:** Trigger analysis of a repo; LLM produces a unified analytics schema (events, semantics, conversion relevance, etc.).
- **Schema approval:** Store and approve generated schemas for use by the platform and service.

Intelligence is applied **at generation time**; the tracker and ingest layer just use the schema.

---

## Prerequisites

- Node.js 20+
- **Supabase** project (URL + service role key)
- **GitHub App** (optional but recommended): App ID, slug, webhook secret, private key for webhooks and repo access

---

## Quick start

```bash
cd packages/analytics-generator
cp .env.example .env
# Edit .env with your Supabase and GitHub App values
npm install
npm run dev
```

Service will be at `http://localhost:8081`.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `GITHUB_APP_ID` | For GitHub features | GitHub App numeric ID |
| `GH_APP_SLUG` | For GitHub features | App slug (e.g. `analytics-app`) |
| `GITHUB_WEBHOOK_SECRET` | For webhooks | Webhook secret from GitHub App |
| `GITHUB_PRIVATE_KEY` or `GITHUB_PRIVATE_KEY_PATH` | For App auth | Private key (inline or path to `.pem`) |
| `GENERATOR_PORT` | No | Port (default: `8081`) |

---

## Main endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Health check |
| GET | `/config` | Config status (App ID, keys, etc.) |
| GET | `/github/install` | Redirect to GitHub App installation |
| GET | `/installations` | List GitHub App installations |
| POST | `/webhooks/github` | GitHub webhook receiver |
| GET | `/installation/:id/repos` | Repos for an installation |
| POST | `/admin/sync-installations` | Sync installations to DB |
| GET | `/schema/latest` | Latest schema (query params as defined in routes) |
| POST | `/schema/approve` | Approve a generated schema |
| GET/POST | `/analytics/progress` | Progress for schema generation |
| POST | `/analytics/generate-unified` | Trigger unified schema generation |
| GET | `/analytics/latest/:repo_id` | Latest analytics schema for repo |
| GET | `/selfcheck` | Self-check/diagnostics |

See `src/routes/` and `src/server.ts` for exact request/response shapes.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload (tsx) |
| `npm run worker:once` | Run analyzer worker once |
| `npm run worker:loop` | Run analyzer worker in a loop (script) |

---

## Related

- **[analytics-service](../analytics-service)** — Ingests events and serves APIs; uses schemas/apps registered via generator/platform.
- **[analytics-platform](../analytics-platform)** — Dashboard UI; can trigger generation and display schemas/events.

For architecture and pipeline details, see `ARCHITECTURE.md` and other docs in this package.
