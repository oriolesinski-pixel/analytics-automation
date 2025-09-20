import 'dotenv/config';
import Fastify from 'fastify';
import { createClient } from '@supabase/supabase-js';
import ingestRoutes from './routes/ingest';
import analyticsRoutes from './routes/analytics';
import selfcheck from "./selfcheck";

const app = Fastify({ logger: true });
const PORT = Number(process.env.ANALYTICS_PORT || 8082);

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

async function start() {
    // Register CORS FIRST - before any routes
    await app.register(require('@fastify/cors'), {
        origin: [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:3003',  // Added port 3003
            'http://localhost:3004',  // Added for future use
            'http://localhost:3005'   // Added for future use
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    });

    // ---- routes ----
    app.get('/healthz', async () => ({ ok: true }));

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

    // Register other routes after CORS
    await app.register(ingestRoutes);
    await app.register(selfcheck);
    await app.register(analyticsRoutes);

    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`Analytics service listening on :${PORT}`);
}

// kick it off
start().catch((e) => { app.log.error(e); process.exit(1); });