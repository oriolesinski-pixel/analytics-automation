// packages/connector-service/src/server.ts
import 'dotenv/config';
import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import selfcheck from "./selfcheck";
import { createClient } from '@supabase/supabase-js';
import schemaRoutes from './routes/schema';
import ingestRoutes from './routes/ingest';
import analyticsRoutes from './routes/analytics';
import { addRuntimeTrackerEndpoints } from './lib/runtime-tracker-builder';
import { createTrackerEndpoint } from './lib/tracker-generator';



const app = Fastify({ logger: true });
const PORT = Number(process.env.PORT || 8080);

// capture raw JSON while still letting Fastify parse it
app.addContentTypeParser('application/json', { parseAs: 'buffer' },
  (req, body, done) => {
    (req as any).rawBody = body;        // keep raw for signature
    try { done(null, JSON.parse(body.toString('utf8'))); }
    catch (err) { done(err as any, undefined as any); }
  }
);
// also capture vendor JSON types like application/vnd.github+json
app.addContentTypeParser('application/*+json', { parseAs: 'buffer' },
  (req, body, done) => {
    (req as any).rawBody = body;
    try { done(null, JSON.parse(body.toString('utf8'))); }
    catch (err) { done(err as any, undefined as any); }
  }
);



// ---- secrets loading helpers ----
function getGithubPrivateKey(): string {
  const filePath = process.env.GITHUB_PRIVATE_KEY_PATH;
  if (filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (fs.existsSync(abs)) return fs.readFileSync(abs, 'utf8');
    app.log.warn(`GITHUB_PRIVATE_KEY_PATH set but file not found: ${abs}`);
  }
  const inline = process.env.GITHUB_PRIVATE_KEY;
  if (inline) return inline;
  return '';
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const APP_ID = Number(requireEnv('GITHUB_APP_ID'));
const GH_APP_SLUG = requireEnv('GH_APP_SLUG');
const WEBHOOK_SECRET = requireEnv('GITHUB_WEBHOOK_SECRET');
const PRIVATE_KEY = getGithubPrivateKey();
if (!PRIVATE_KEY) app.log.warn('⚠️  No GitHub private key found (set GITHUB_PRIVATE_KEY_PATH or GITHUB_PRIVATE_KEY).');

// ---- Octokit (App auth) ----
const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: APP_ID,
    privateKey: PRIVATE_KEY
  }
});

// ---- Supabase client ----
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function parseFullName(full: string) {
  const [owner, name] = String(full).split('/');
  return { owner, name };
}

async function ensureRepo(args: {
  full_name: string;
  default_branch?: string | null;
  installation_id?: string | null;
}) {
  const { owner, name } = parseFullName(args.full_name);
  const defaultBranch = args.default_branch ?? 'main';
  const installationId = args.installation_id ?? null;

  const up = await supabase
    .from('repos')
    .upsert(
      {
        provider: 'github',
        owner,
        name,
        default_branch: defaultBranch,
        installation_id: installationId,
      },
      { onConflict: 'provider,owner,name' }
    )
    .select()
    .single();

  if (up.error) throw new Error(up.error.message);
  return up.data; // includes uuid .id
}

async function findRepoId(full_name: string): Promise<string | null> {
  const { owner, name } = parseFullName(full_name);
  const q = await supabase
    .from('repos')
    .select('id')
    .eq('provider', 'github')
    .eq('owner', owner)
    .eq('name', name)
    .limit(1)
    .maybeSingle();
  return q.data?.id ?? null;
}

// Helper to normalize installation.account union (user/org/enterprise)
function pickAccount(acc: unknown) {
  const a = acc as { type?: string; login?: string; slug?: string; name?: string };
  return {
    type: a?.type ?? null,
    login_or_slug: a?.login ?? a?.slug ?? null,
    name: a?.name ?? null,
  };
}

let hasRaw = false;

async function start() {
  hasRaw = true;

  // ---- routes ----
  app.get('/healthz', async () => ({ ok: true }));

  app.get('/config', async () => ({
    appIdLoaded: !!APP_ID,
    slugLoaded: !!GH_APP_SLUG,
    webhookSecretLoaded: !!WEBHOOK_SECRET,
    privateKeyLoaded: !!PRIVATE_KEY,
    usingPrivateKeyFrom: process.env.GITHUB_PRIVATE_KEY_PATH ? 'file' : (process.env.GITHUB_PRIVATE_KEY ? 'env' : 'none'),
    hasRawBodyPlugin: hasRaw
  }));

  // Convenience route to jump to Install page
  app.get('/github/install', async (_req, reply) => {
    const url = `https://github.com/apps/${GH_APP_SLUG}/installations/new`;
    reply.redirect(url);
  });

  // List installations — SINGLE definition (union-safe)
  app.get('/installations', async () => {
    const { data } = await octokit.rest.apps.listInstallations();
    return data.map(i => ({
      id: i.id,
      account: pickAccount(i.account),
      target_type: i.target_type,
    }));
  });

  // Webhook receiver
  app.post('/webhooks/github', async (req: any, reply) => {
    try {
      // --- Signature verification (mandatory)
      const raw = (req as any).rawBody as Buffer | undefined;
      const sig = req.headers['x-hub-signature-256'] as string | undefined;

      if (!raw) {
        req.log.warn('No rawBody captured; rejecting webhook');
        return reply.code(401).send('missing raw body');
      }
      if (!WEBHOOK_SECRET) {
        req.log.error('WEBHOOK_SECRET not set');
        return reply.code(500).send('server misconfigured');
      }

      const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
      const ok = typeof sig === 'string' &&
        Buffer.isBuffer(raw) &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));

      if (!ok) {
        req.log.warn({ sig, expected }, 'Invalid webhook signature');
        return reply.code(401).send('invalid signature');
      }

      const event = String(req.headers['x-github-event'] || '');
      const payload = req.body as any;

      // -------- installation --------
      if (event === 'installation') {
        const installationId = payload.installation?.id ? String(payload.installation.id) : null;
        const repos = Array.isArray(payload.repositories) ? payload.repositories : [];

        for (const r of repos) {
          await ensureRepo({
            full_name: r.full_name,
            default_branch: r.default_branch ?? 'main',
            installation_id: installationId,
          });

          const repoId = await findRepoId(r.full_name);
          if (repoId) {
            const installIns = await supabase.from('analyzer_runs').insert({
              id: crypto.randomUUID(),
              repo_id: repoId,
              commit_sha: null,
              framework: null,
              status: 'queued',
              event_type: 'installation',
              summary: { installationId, repo: r.full_name },
            });
            if (installIns.error) {
              req.log.error({ err: installIns.error }, 'analyzer_runs insert (installation) failed');
              return reply.code(500).send({ ok: false, where: 'installation insert', error: installIns.error.message });
            }
          }
        }
        return reply.send({ ok: true, event, repos: repos.length });
      }

      // -------- installation_repositories --------
      if (event === 'installation_repositories') {
        const installationId = payload.installation?.id ? String(payload.installation.id) : null;
        const added = payload.repositories_added || [];
        const removed = payload.repositories_removed || [];

        for (const r of added) {
          const row = await ensureRepo({
            full_name: r.full_name,
            default_branch: r.default_branch ?? 'main',
            installation_id: installationId,
          });
          const addIns = await supabase.from('analyzer_runs').insert({
            id: crypto.randomUUID(),
            repo_id: row.id,
            commit_sha: null,
            framework: null,
            status: 'queued',
            event_type: 'installation_repositories',
            summary: { action: 'added', installationId, repo: r.full_name },
          });
          if (addIns.error) {
            req.log.error({ err: addIns.error }, 'analyzer_runs insert (added) failed');
            return reply.code(500).send({ ok: false, where: 'added insert', error: addIns.error.message });
          }
        }

        for (const r of removed) {
          const repoId = await findRepoId(r.full_name);
          const remIns = await supabase.from('analyzer_runs').insert({
            id: crypto.randomUUID(),
            repo_id: repoId,
            commit_sha: null,
            framework: null,
            status: 'queued',
            event_type: 'installation_repositories',
            summary: { action: 'removed', installationId, repo: r.full_name },
          });
          if (remIns.error) {
            req.log.error({ err: remIns.error }, 'analyzer_runs insert (removed) failed');
            return reply.code(500).send({ ok: false, where: 'removed insert', error: remIns.error.message });
          }
        }

        return reply.send({ ok: true, event, added: added.length, removed: removed.length });
      }

      // -------- push --------
      if (event === 'push') {
        const repo = payload.repository;
        if (!repo?.full_name) return reply.send({ ok: true, note: 'no repo.full_name' });

        const installationId = payload.installation?.id ? String(payload.installation.id) : null;
        const ensured = await ensureRepo({
          full_name: repo.full_name,
          default_branch: repo.default_branch ?? 'main',
          installation_id: installationId,
        });

        // compute base/head SHAs from the GitHub push payload
        const baseSha = payload.before ?? null;                                // old tip
        const headSha = payload.after ?? payload.head_commit?.id ?? null;      // new tip

        // dedupe by (repo_id, commit_sha = headSha)
        if (headSha) {
          const exists = await supabase
            .from('analyzer_runs')
            .select('id')
            .eq('repo_id', ensured.id)
            .eq('commit_sha', headSha)
            .limit(1);
          if (exists.error) {
            req.log.error({ err: exists.error }, 'select (dedupe) failed');
            return reply.code(500).send({ ok: false, where: 'dedupe select', error: exists.error.message });
          }
          if (exists.data && exists.data.length > 0) {
            return reply.send({ ok: true, event, dedup: true, repo_id: ensured.id, commit_sha: headSha });
          }
        }

        // summary for the jsonb column (object, not string)
        const branch = typeof payload.ref === 'string' ? payload.ref.split('/').pop() : null;
        const actor = payload.sender?.login || payload.pusher?.name || null;

        const summary = {
          compare: payload.compare ?? null,
          base_sha: baseSha,
          head_sha: headSha,
          context: { branch, actor },
          stats: {
            added: Array.isArray(payload.head_commit?.added) ? payload.head_commit.added.length : 0,
            removed: Array.isArray(payload.head_commit?.removed) ? payload.head_commit.removed.length : 0,
            modified: Array.isArray(payload.head_commit?.modified) ? payload.head_commit.modified.length : 0,
          },
        };

        // insert analyzer_run and check errors
        const pushIns = await supabase.from('analyzer_runs').insert({
          id: crypto.randomUUID(),
          repo_id: ensured.id,
          commit_sha: headSha,
          framework: null,
          status: 'queued',
          event_type: 'push',
          summary,
        });
        if (pushIns.error) {
          req.log.error({ err: pushIns.error }, 'analyzer_runs insert (push) failed');
          return reply.code(500).send({ ok: false, where: 'push insert', error: pushIns.error.message });
        }

        return reply.send({ ok: true, event, repo_id: ensured.id, commit_sha: headSha });
      }

      // ignore others
      return reply.send({ ok: true, event, ignored: true });
    } catch (e: any) {
      req.log.error(e, 'Webhook handler error');
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // --- Debug: normalized installations (already defined above) ---
  // (Nothing else here for /installations to avoid duplicates)

  // --- Debug: installation permissions — SINGLE definition
  app.get('/installation/:id/permissions', async (req, reply) => {
    const id = Number((req.params as any).id);
    try {
      const { data } = await octokit.rest.apps.getInstallation({ installation_id: id });
      return reply.send({
        ok: true,
        id: data.id,
        account: pickAccount(data.account),
        repository_selection: data.repository_selection,
        permissions: data.permissions,
      });
    } catch (e: any) {
      req.log.error(e, 'getInstallation error');
      return reply.code(500).send({ ok: false, error: e?.message });
    }
  });

  app.get('/debug/last-runs', async (_req, reply) => {
    const { data, error } = await supabase
      .from('analyzer_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) return reply.code(500).send({ ok: false, error: error.message });
    return reply.send({ ok: true, count: data?.length ?? 0, data });
  });

  app.get('/debug/runs', async (req, reply) => {
    const q = req.query as any; // ?full=owner/name
    if (!q.full) return reply.code(400).send({ ok: false, error: 'pass ?full=owner/name' });
    const [owner, name] = String(q.full).split('/');
    const repo = await supabase
      .from('repos')
      .select('id')
      .eq('provider', 'github')
      .eq('owner', owner)
      .eq('name', name)
      .single();
    if (repo.error) return reply.code(404).send({ ok: false, error: 'repo not found' });
    const runs = await supabase
      .from('analyzer_runs')
      .select('*')
      .eq('repo_id', repo.data.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (runs.error) return reply.code(500).send({ ok: false, error: runs.error.message });
    return reply.send({ ok: true, repo_id: repo.data.id, count: runs.data?.length ?? 0, data: runs.data });
  });

  app.get('/installation/:id/repos', async (req, reply) => {
    const id = Number((req.params as any).id);
    try {
      const instAuth: any = await octokit.auth({ type: 'installation', installationId: id });
      const instKit = new Octokit({ auth: instAuth.token });
      const { data } = await instKit.request('GET /installation/repositories', { per_page: 100 });
      return reply.send({
        ok: true,
        installation_id: id,
        repo_count: data.repositories?.length ?? 0,
        repos: data.repositories?.map(r => r.full_name) ?? [],
      });
    } catch (e: any) {
      req.log.error({ e }, 'installation repos error');
      return reply.code(500).send({ ok: false, error: e?.message });
    }
  });

  // GET /events?full=owner/name&since=...&limit=...
  app.get('/events', async (req, reply) => {
    const q = req.query as any;
    if (!q.full) return reply.code(400).send({ ok: false, error: 'pass ?full=owner/name' });
    const [owner, name] = String(q.full).split('/');
    const since = q.since ? new Date(String(q.since)).toISOString() : null;
    const limit = Math.min(Number(q.limit || 50), 200);

    // find repo id
    const repo = await supabase
      .from('repos')
      .select('id')
      .eq('provider', 'github')
      .eq('owner', owner)
      .eq('name', name)
      .single();
    if (repo.error) return reply.code(404).send({ ok: false, error: 'repo not found' });

    let query = supabase
      .from('events')
      .select('*')
      .eq('repo_id', repo.data.id)
      .order('ts', { ascending: false })
      .limit(limit);

    if (since) query = query.gte('ts', since);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ ok: false, error: error.message });

    return reply.send({ ok: true, count: data?.length ?? 0, data });
  });
  // Add these endpoints to packages/connector-service/src/server.ts

// Apps management
app.get('/apps/list', async (req, reply) => {
  const { data: apps, error } = await supabase
    .from('apps')
    .select('*, repos:repo_id (owner, name)')
    .order('created_at', { ascending: false });
  
  if (error) return reply.code(500).send({ ok: false, error: error.message });
  return reply.send({ ok: true, apps: apps || [], count: apps?.length || 0 });
});

app.post('/apps/create', async (req, reply) => {
  const { name, app_key, domain, repo_id } = req.body as any;
  
  const { data: app, error } = await supabase
    .from('apps')
    .insert({
      app_key: app_key || `app_${Date.now()}`,
      name: name || 'Demo App',
      domain: domain || 'localhost:3002',
      repo_id: repo_id || '1a8cdd0b-1150-4806-b1d0-2fcbca7f19d7'
    })
    .select()
    .single();

  if (error) return reply.code(500).send({ ok: false, error: error.message });
  return reply.send({ ok: true, app: app });
});

// Enhanced event ingestion
app.post('/ingest/app', async (req, reply) => {
  const { app_key, verb, metadata, source = 'web' } = req.body as any;
  
  if (!app_key || !verb) {
    return reply.code(400).send({ ok: false, error: 'app_key and verb required' });
  }

  // Insert event with app_key
  const { data: result, error } = await supabase
    .from('events')
    .insert({
      source,
      repo_id: '1a8cdd0b-1150-4806-b1d0-2fcbca7f19d7', // Your demo repo
      commit_sha: null,
      actor: metadata?.user_id || 'anonymous',
      ts: new Date().toISOString(),
      verb,
      metadata: { ...metadata, app_key },
      app_key,
      user_id: metadata?.user_id,
      session_id: metadata?.session_id,
      type: verb,
      data: metadata || {}
    })
    .select()
    .single();

  if (error) return reply.code(500).send({ ok: false, error: error.message });
  return reply.send({ ok: true, event_id: result.id, app_key });
});

  // --- Minimal metrics ---
  app.get('/metrics', async (_req, reply) => {
    const { data, error } = await supabase
      .from('analyzer_runs')
      .select('status, count:id')   // PostgREST -> GROUP BY status
      .order('status', { ascending: true });

    if (error) return reply.code(500).send({ ok: false, error: error.message });

    const statuses = ['queued', 'processing', 'completed', 'failed'] as const;
    const by: Record<typeof statuses[number], number> =
      Object.fromEntries(statuses.map(s => [s, 0])) as any;

    for (const row of data ?? []) {
      const s = String((row as any).status);
      const c = parseInt(String((row as any).count ?? '0'), 10);
      if ((statuses as readonly string[]).includes(s)) by[s as typeof statuses[number]] = c;
    }

    return reply.send({ ok: true, analyzer_runs: by });
  });

  // --- Admin: sync all installations' repos into Supabase.repos ---
  app.post('/admin/sync-installations', async (_req, reply) => {
    try {
      const installs = await octokit.rest.apps.listInstallations();
      const results: any[] = [];

      for (const inst of installs.data) {
        const instAuth: any = await octokit.auth({ type: 'installation', installationId: inst.id });
        const instKit = new Octokit({ auth: instAuth.token });

        // page through repositories (max 100/page)
        let page = 1;
        let upserted = 0;
        for (; ;) {
          const { data } = await instKit.request('GET /installation/repositories', {
            per_page: 100, page
          });
          const repos = data.repositories ?? [];
          if (repos.length === 0) break;

          for (const r of repos) {
            const { error } = await supabase
              .from('repos')
              .upsert(
                {
                  provider: 'github',
                  owner: r.owner.login, // from repo object it's always a user/org with login
                  name: r.name,
                  default_branch: r.default_branch || 'main',
                  installation_id: String(inst.id),
                },
                { onConflict: 'provider,owner,name' }
              );
            if (error) throw new Error(error.message);
            upserted++;
          }

          if (!data.total_count || repos.length < 100) break;
          page++;
        }

        results.push({ installation_id: inst.id, account: pickAccount(inst.account), upserted });
      }

      return reply.send({ ok: true, results });
    } catch (e: any) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });
  await app.register(selfcheck);
  await app.register(schemaRoutes);
  await app.register(ingestRoutes);
  await app.register(createTrackerEndpoint);
  await app.register(analyticsRoutes);
  await app.register(require('@fastify/cors'), {
    origin: ['http://localhost:3002', 'http://localhost:3001', 'http://localhost:3000']
  });
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`connector listening on :${PORT}`);
}

// kick it off
start().catch((e) => { app.log.error(e); process.exit(1); });
