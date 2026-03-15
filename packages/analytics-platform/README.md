# Analytics Platform (Demo App)

Next.js **dashboard and demo app** for the Glint Analytics Automation stack. It provides a UI for dashboards, live events, data contracts, AI wizard, onboarding, and workspace settings.

**Default port:** `3002`

---

## What it does

- **Dashboards:** Build and view dashboards with tiles and charts.
- **Live events:** Stream and inspect incoming analytics events.
- **Data contracts:** View and manage data contract definitions.
- **AI Wizard:** Use AI (Anthropic) to help configure or refine analytics.
- **Workspace / settings:** Manage workspace and app settings.
- **Onboarding:** Guided setup for new users.

The app talks to **analytics-service** (ingest, events, analytics) and **analytics-generator** (schemas, generation) via the URLs configured in env.

---

## Prerequisites

- Node.js 20+
- **Supabase** project (anon + service role keys for client and server)
- **analytics-service** and (optionally) **analytics-generator** running, or deployed URLs
- **Anthropic API key** for the AI Wizard feature

---

## Quick start

```bash
cd packages/analytics-platform
cp .env.local.example .env.local
# Edit .env.local: Supabase, API URLs, ANTHROPIC_API_KEY
npm install
npm run dev
```

App will be at `http://localhost:3002`.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Supabase |
| `SUPABASE_ANON_KEY` | Yes | Client-side Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Same URL for client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same anon key for client |
| `NEXT_PUBLIC_API_URL` | No | analytics-service base URL (default: `http://localhost:8082`) |
| `NEXT_PUBLIC_GENERATOR_API_URL` | No | analytics-generator base URL (default: `http://localhost:8081`) |
| `ANTHROPIC_API_KEY` | For AI Wizard | Anthropic API key |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth for login/linking |

---

## Main routes (app)

| Path | Description |
|------|-------------|
| `/` | Home / overview |
| `/dashboard`, `/dashboards` | Dashboard list and builder |
| `/events` | Live event feed |
| `/analytics` | Analytics views |
| `/data-contracts` | Data contracts UI |
| `/ai-wiz` | AI Wizard |
| `/onboarding` | Onboarding flow |
| `/workspace`, `/settings` | Workspace and settings |

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server on port 3002 |
| `npm run build` | Production build |
| `npm run start` | Run production server on port 3002 |
| `npm run lint` | Run ESLint |

---

## Related

- **[analytics-service](../analytics-service)** — Backend for ingest, events, and analytics.
- **[analytics-generator](../analytics-generator)** — Schema generation and GitHub integration.

For feature deep dives, see docs in this package (e.g. `AI_WIZARD_FEATURE.md`, `DATA_CONTRACTS_FEATURE.md`, `SQL_SANDBOX_SETUP.md`).
