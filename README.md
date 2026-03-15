# Glint Analytics Automation

A monorepo for **AI-powered analytics**: schema generation from codebases, event ingestion, and a dashboard platform. Built for product teams who want analytics that are generated once from their app and executed everywhere with minimal runtime overhead.

---

## What’s in this repo

| Package | Purpose |
|--------|---------|
| **[analytics-generator](./packages/analytics-generator)** | Service that analyzes your codebase (e.g. via GitHub) and generates analytics schemas using an LLM. Runs on port **8081**. |
| **[analytics-service](./packages/analytics-service)** | Backend API: event ingest, events API, analytics/query/tiles, health. Runs on port **8082**. |
| **[analytics-platform](./packages/analytics-platform)** | Next.js demo app: dashboards, live events, data contracts, AI wizard. Runs on port **3002**. |

All services use **Supabase** for database and (optionally) **GitHub** for repo access and webhooks.

---

## Prerequisites

- **Node.js** 20+
- **Supabase** project ([supabase.com](https://supabase.com))
- **(Optional)** GitHub App for generator webhooks and repo access
- **(Optional)** Anthropic API key for AI Wizard in the platform

---

## Quick start

### 1. Clone and install

```bash
git clone <this-repo>
cd analytics-automation
npm install
```

### 2. Configure environment

- **Generator:** copy `packages/analytics-generator/.env.example` → `.env`
- **Service:** copy `packages/analytics-service/.env.example` → `.env`
- **Platform:** copy `packages/analytics-platform/.env.local.example` → `.env.local`

Set at least:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in each package that needs DB access.

See each package’s README for full env details.

### 3. Run everything

From repo root:

```bash
# Start generator (port 8081)
cd packages/analytics-generator && npm run dev &

# Start analytics service (port 8082)
cd packages/analytics-service && npm run dev &

# Start platform UI (port 3002)
cd packages/analytics-platform && npm run dev
```

Or use the project scripts (if you use them):

- `./restart-services.sh` — restarts generator + service (path inside may need updating)
- `./platform-deploy.sh` — full platform deploy flow with GitHub checks

---

## Ports

| Service | Port |
|--------|------|
| analytics-generator | 8081 |
| analytics-service | 8082 |
| analytics-platform | 3002 |

---

## Scripts (repo root)

- `restart-services.sh` — restart generator and analytics-service (no schema regeneration).
- `platform-deploy.sh` — full platform deployment with dependency checks and GitHub integration.
- `start.sh` — legacy script; may reference old paths (e.g. `backend`, `examples/test-app-rich`).

---

## Documentation

- **[packages/analytics-generator/README.md](./packages/analytics-generator/README.md)** — generator API, env, and usage.
- **[packages/analytics-service/README.md](./packages/analytics-service/README.md)** — ingest, events, query, tiles, and env.
- **[packages/analytics-platform/README.md](./packages/analytics-platform/README.md)** — dashboard app and demo features.

Additional design docs (e.g. `ARCHITECTURE.md`, `COMPLETE_PIPELINE_FLOW.md`) live in `packages/analytics-generator` and elsewhere for deep dives.

---

## License

See repository license file.
