// packages/analytics-service/src/server.ts
import 'dotenv/config';
import Fastify from 'fastify';
import { createClient } from '@supabase/supabase-js';
import ingestRoutes from './routes/ingest';
import analyticsRoutes from './routes/analytics';
import selfcheck from "./selfcheck";
import deployRoutes from './routes/deploy';
import mergeRoutes from './routes/merge';
import crypto from 'crypto';

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
            'http://localhost:3003',
            'http://localhost:3004',
            'http://localhost:3005',
            'https://test-app-rich-demo.vercel.app' // Add production domain
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    });

    // ---- Health check ----
    app.get('/healthz', async () => ({ ok: true }));

    // ---- Existing event routes ----
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

    // ---- Enhanced Apps Management (keeping existing + adding new) ----
    app.get('/apps/list', async (req, reply) => {
        const { data: apps, error } = await supabase
            .from('apps')
            .select('*, repos:repo_id (owner, name)')
            .order('created_at', { ascending: false });

        if (error) return reply.code(500).send({ ok: false, error: error.message });
        return reply.send({ ok: true, apps: apps || [], count: apps?.length || 0 });
    });

    // Get single app by key
    app.get('/apps/:appKey', async (req, reply) => {
        const { appKey } = req.params as any;

        const { data: app, error } = await supabase
            .from('apps')
            .select('*, repos:repo_id (owner, name)')
            .eq('app_key', appKey)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return reply.code(404).send({ ok: false, error: 'App not found' });
            }
            return reply.code(500).send({ ok: false, error: error.message });
        }

        return reply.send({ ok: true, app });
    });

    // Keep existing create endpoint
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

    // NEW: Register app (upsert - create or update)
    app.post('/apps/register', async (req, reply) => {
        const { app_key, name, domain, repo_id, github_repo, setup_status } = req.body as any;

        if (!app_key || !name) {
            return reply.code(400).send({ ok: false, error: 'app_key and name are required' });
        }

        // Check if app already exists
        const { data: existingApp } = await supabase
            .from('apps')
            .select('id')
            .eq('app_key', app_key)
            .single();

        if (existingApp) {
            // Update existing app
            const { data: updatedApp, error: updateError } = await supabase
                .from('apps')
                .update({
                    name,
                    domain: domain || `${app_key}.localhost`,
                    repo_id,
                    github_repo,
                    setup_status: setup_status || 'registered',
                    updated_at: new Date().toISOString()
                })
                .eq('app_key', app_key)
                .select()
                .single();

            if (updateError) {
                return reply.code(500).send({ ok: false, error: updateError.message });
            }

            console.log(`✅ Updated existing app: ${app_key}`);
            return reply.send({
                ok: true,
                app: updatedApp,
                action: 'updated'
            });
        }

        // Create repo if repo_id not provided
        let finalRepoId = repo_id;
        if (!finalRepoId && github_repo) {
            const [owner, repoName] = github_repo.split('/');
            const repoData = {
                id: crypto.randomUUID(),
                name: repoName || app_key,
                owner: owner || 'local',
                provider: 'github',
                default_branch: 'main',
                default_app_key: app_key,
                created_at: new Date().toISOString()
            };

            const { data: newRepo, error: repoError } = await supabase
                .from('repos')
                .insert(repoData)
                .select()
                .single();

            if (!repoError && newRepo) {
                finalRepoId = newRepo.id;
                console.log(`Created repo for ${app_key}:`, finalRepoId);
            }
        }

        // Create new app
        const appData = {
            app_key,
            name,
            domain: domain || `${app_key}.localhost`,
            repo_id: finalRepoId || '1a8cdd0b-1150-4806-b1d0-2fcbca7f19d7', // fallback to demo repo
            github_repo,
            setup_status: setup_status || 'registered',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: newApp, error: createError } = await supabase
            .from('apps')
            .insert(appData)
            .select()
            .single();

        if (createError) {
            return reply.code(500).send({ ok: false, error: createError.message });
        }

        console.log(`✅ Registered new app: ${app_key}`);
        return reply.code(201).send({
            ok: true,
            app: newApp,
            action: 'created'
        });
    });

    // NEW: Update app (for status updates, PR info, etc)
    app.post('/apps/update', async (req, reply) => {
        const { app_key, setup_status, pr_url, pr_number, domain } = req.body as any;

        if (!app_key) {
            return reply.code(400).send({ ok: false, error: 'app_key is required' });
        }

        const updateData: any = {
            updated_at: new Date().toISOString()
        };

        if (setup_status !== undefined) updateData.setup_status = setup_status;
        if (pr_url !== undefined) updateData.pr_url = pr_url;
        if (pr_number !== undefined) updateData.pr_number = pr_number;
        if (domain !== undefined) updateData.domain = domain;

        const { data: updatedApp, error } = await supabase
            .from('apps')
            .update(updateData)
            .eq('app_key', app_key)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return reply.code(404).send({ ok: false, error: 'App not found' });
            }
            return reply.code(500).send({ ok: false, error: error.message });
        }

        console.log(`✅ Updated app ${app_key} status to: ${setup_status || 'updated'}`);
        return reply.send({
            ok: true,
            app: updatedApp
        });
    });

    // NEW: Simple status update endpoint
    app.post('/apps/update-status', async (req, reply) => {
        const { app_key, setup_status } = req.body as any;

        if (!app_key || !setup_status) {
            return reply.code(400).send({ ok: false, error: 'app_key and setup_status are required' });
        }

        const { data, error } = await supabase
            .from('apps')
            .update({
                setup_status,
                updated_at: new Date().toISOString()
            })
            .eq('app_key', app_key)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return reply.code(404).send({ ok: false, error: 'App not found' });
            }
            return reply.code(500).send({ ok: false, error: error.message });
        }

        console.log(`✅ Updated ${app_key} status to: ${setup_status}`);
        return reply.send({ ok: true, app: data });
    });

    // NEW: Delete app
    app.delete('/apps/:appKey', async (req, reply) => {
        const { appKey } = req.params as any;

        const { error } = await supabase
            .from('apps')
            .delete()
            .eq('app_key', appKey);

        if (error) {
            return reply.code(500).send({ ok: false, error: error.message });
        }

        console.log(`✅ Deleted app: ${appKey}`);
        return reply.send({ ok: true, message: 'App deleted successfully' });
    });

    // NEW: Get app analytics summary
    app.get('/apps/:appKey/analytics', async (req, reply) => {
        const { appKey } = req.params as any;

        // Get app first
        const { data: app, error: appError } = await supabase
            .from('apps')
            .select('id, name')
            .eq('app_key', appKey)
            .single();

        if (appError || !app) {
            return reply.code(404).send({ ok: false, error: 'App not found' });
        }

        // Get event counts
        const { count: totalEvents } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('app_key', appKey);

        // Get recent events
        const { data: recentEvents } = await supabase
            .from('events')
            .select('*')
            .eq('app_key', appKey)
            .order('ts', { ascending: false })
            .limit(10);

        // Get unique sessions
        const { data: sessions } = await supabase
            .from('events')
            .select('session_id')
            .eq('app_key', appKey);

        const uniqueSessions = sessions ? [...new Set(sessions.map(s => s.session_id).filter(Boolean))].length : 0;

        return reply.send({
            ok: true,
            app: {
                ...app,
                app_key: appKey
            },
            analytics: {
                totalEvents: totalEvents || 0,
                uniqueSessions,
                recentEvents: recentEvents || []
            }
        });
    });

    // Keep existing ingest endpoint
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

    // Keep existing metrics endpoint
    app.get('/metrics', async (_req, reply) => {
        const { data, error } = await supabase
            .from('analyzer_runs')
            .select('status, count:id')
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
    await app.register(deployRoutes);
    await app.register(mergeRoutes);


    await app.listen({ port: PORT, host: '0.0.0.0' });

    console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║     🚀 Analytics Service Running                    ║
║                                                      ║
║     Port: ${PORT}                                   ║
║                                                      ║
║     Core Endpoints:                                 ║
║       • POST   /ingest/analytics                    ║
║       • POST   /ingest/app                         ║
║       • GET    /events                             ║
║       • GET    /metrics                            ║
║                                                      ║
║     App Management:                                 ║
║       • GET    /apps/list                          ║
║       • GET    /apps/:appKey                       ║
║       • POST   /apps/create                        ║
║       • POST   /apps/register                      ║
║       • POST   /apps/update                        ║
║       • POST   /apps/update-status                 ║
║       • DELETE /apps/:appKey                       ║
║       • GET    /apps/:appKey/analytics             ║
║                                                      ║
║     Analytics:                                     ║
║       • GET    /analytics/events                   ║
║       • GET    /analytics/funnel                   ║
║       • GET    /analytics/metrics                  ║
║                                                      ║
║     GitHub Integration:                            ║
║       • POST   /deploy                             ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
    `);
}

// kick it off
start().catch((e) => { app.log.error(e); process.exit(1); });