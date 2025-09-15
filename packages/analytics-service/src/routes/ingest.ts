// src/routes/ingest.ts
import type { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'node:crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------- Types & Schemas ----------
const IngestBody = z.object({
  full: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  source: z.string().default('web'),
  verb: z.string().min(1),
  ts: z.number().optional(), // client timestamp (ms)
  // classic Zod: explicit value type for record
  metadata: z.record(z.string(), z.unknown()).default({})
});

// ---------- Helpers ----------
async function repoIdByFull(full: string): Promise<string> {
  const [owner, name] = full.split('/');
  const { data, error } = await supabase
    .from('repos')
    .select('id')
    .eq('provider', 'github')
    .eq('owner', owner)
    .eq('name', name)
    .single();
  if (error || !data) throw new Error('repo not found');
  return data.id as string;
}

async function latestEventByVerb(repoId: string, verb: string) {
  const { data } = await supabase
    .from('events')
    .select('metadata, commit_sha, ts')
    .eq('repo_id', repoId)
    .eq('verb', verb)
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

function toRegexFromPattern(pattern: unknown): RegExp {
  const s = String(pattern ?? '');
  // '/product/:id' -> ^/product/[^/]+$
  const esc = s
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\:splat/g, '.+')
    .replace(/\\:param/g, '[^/]+')
    .replace(/\\:([a-zA-Z_][a-zA-Z0-9_]*)/g, '[^/]+');
  return new RegExp('^' + esc + '$');
}

function asString(x: unknown): string | undefined {
  return typeof x === 'string' ? x : undefined;
}

function coercePathFromUrl(u: unknown): string | undefined {
  if (typeof u !== 'string') return undefined;
  try { return new URL(u).pathname; } catch { return undefined; }
}

// ---------- Route Module ----------
export default async function ingestRoutes(app: FastifyInstance) {
  // --- Tiny HTML sandbox to play with schema/graph & send events ---
  app.get('/sandbox', async (_req, reply) => {
    reply
      .header('content-type', 'text/html; charset=utf-8')
      .send(`<!doctype html>
<html><head><meta charset="utf-8"/><title>AA Sandbox</title>
<style>body{font:14px/1.4 system-ui, sans-serif; padding:16px; max-width:1100px; margin:auto}
pre,textarea{width:100%; min-height:160px; font:12px/1.4 ui-monospace,Menlo,monospace}
.grid{display:grid; gap:16px; grid-template-columns:1fr 1fr}
.card{border:1px solid #ddd; border-radius:10px; padding:12px}</style>
</head><body>
<h1>Analytics Automation — Sandbox</h1>
<div class="card">
  <label>Repo (owner/name): <input id="full" size="40" value="oriolesinski-pixel/demo-frontend"/></label>
  <button onclick="loadAll()">Load</button>
</div>
<div class="grid">
  <div class="card">
    <h3>Latest Schema</h3>
    <pre id="schema"></pre>
    <h4>Edit + Save Override</h4>
    <textarea id="schemaEdit" placeholder='{"events":[...]}'></textarea>
    <button onclick="saveSchemaOverride()">Save Schema Override</button>
  </div>
  <div class="card">
    <h3>Latest Route Graph</h3>
    <pre id="graph"></pre>
    <h4>Edit + Save Override</h4>
    <textarea id="graphEdit" placeholder='{"nodes":[...],"edges":[...]}'></textarea>
    <button onclick="saveGraphOverride()">Save Graph Override</button>
  </div>
</div>
<div class="grid">
  <div class="card">
    <h3>Send Test Event</h3>
    <label>verb: <input id="verb" value="page_view"/></label><br/>
    <label>metadata JSON:</label>
    <textarea id="meta">{ "page_url": "http://localhost:5173/", "route": "/" }</textarea>
    <button onclick="sendEvent()">POST /ingest</button>
    <pre id="ingestRes"></pre>
  </div>
  <div class="card">
    <h3>Last 50 Events</h3>
    <pre id="events"></pre>
  </div>
</div>
<script>
async function loadAll(){
  const full = document.getElementById('full').value;
  const s = await fetch('/schema/latest?full='+encodeURIComponent(full)).then(r=>r.ok?r.json():null).catch(()=>null);
  document.getElementById('schema').textContent = JSON.stringify(s, null, 2);
  const g = await fetch('/routes/latest?full='+encodeURIComponent(full)).then(r=>r.ok?r.json():null).catch(()=>null);
  document.getElementById('graph').textContent = JSON.stringify(g, null, 2);
  const e = await fetch('/events?full='+encodeURIComponent(full)+'&limit=50').then(r=>r.json());
  document.getElementById('events').textContent = JSON.stringify(e, null, 2);
}
async function saveSchemaOverride(){
  const full = document.getElementById('full').value;
  const body = { full, suggested: JSON.parse(document.getElementById('schemaEdit').value || '{}') };
  const r = await fetch('/schema/override', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  alert('schema override: ' + r.status);
}
async function saveGraphOverride(){
  const full = document.getElementById('full').value;
  const body = { full, graph: JSON.parse(document.getElementById('graphEdit').value || '{}') };
  const r = await fetch('/routes/override', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  alert('graph override: ' + r.status);
}
async function sendEvent(){
  const full = document.getElementById('full').value;
  const verb = document.getElementById('verb').value;
  const metadata = JSON.parse(document.getElementById('meta').value || '{}');
  const r = await fetch('/ingest', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ full, verb, metadata, source:'sandbox' })});
  document.getElementById('ingestRes').textContent = await r.text();
  loadAll();
}
loadAll();
</script>
</body></html>`);
  });

  // --- GET /routes/latest?full=owner/name  (prefer override, else analyzer) ---
  app.get('/routes/latest', async (req, reply) => {
    try {
      const full = (req.query as any)?.full as string | undefined;
      if (!full || !/^[\w.-]+\/[\w.-]+$/.test(full)) {
        return reply.code(400).send({ error: 'Provide ?full=owner/name' });
      }
      const [owner, name] = full.split('/');

      const repo = await supabase
        .from('repos')
        .select('id')
        .eq('provider', 'github')
        .eq('owner', owner)
        .eq('name', name)
        .single();
      if (repo.error || !repo.data) return reply.code(404).send({ error: 'repo not found' });

      const ovr = await supabase
        .from('events')
        .select('commit_sha, ts, metadata')
        .eq('repo_id', repo.data.id)
        .eq('verb', 'route_graph_override')
        .order('ts', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ovr.data) {
        return reply.send({
          full,
          commit_sha: ovr.data.commit_sha,
          ts: ovr.data.ts,
          graph: (ovr.data.metadata as any)?.graph ?? null
        });
      }

      const ai = await supabase
        .from('events')
        .select('commit_sha, ts, metadata')
        .eq('repo_id', repo.data.id)
        .eq('verb', 'route_graph')
        .order('ts', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ai.data) return reply.code(404).send({ error: 'No route graph yet' });

      return reply.send({
        full,
        commit_sha: ai.data.commit_sha,
        ts: ai.data.ts,
        graph: (ai.data.metadata as any)?.graph ?? null
      });
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || 'failed to fetch latest routes' });
    }
  });

  // --- Manual schema override (stores an event) ---
  app.post('/schema/override', async (req, reply) => {
    const body = req.body as any;
    const parsedFull = z.string().regex(/^[\w.-]+\/[\w.-]+$/).safeParse(body?.full);
    if (!parsedFull.success) return reply.code(400).send({ error: 'Provide body.full=owner/name' });
    const repoId = await repoIdByFull(parsedFull.data);
    const suggested = body?.suggested;
    if (!suggested) return reply.code(400).send({ error: 'Provide body.suggested' });

    const { error } = await supabase.from('events').insert({
      id: crypto.randomUUID(),
      source: 'ui',
      repo_id: repoId,
      commit_sha: null,
      actor: 'override',
      ts: new Date().toISOString(),
      verb: 'schema_override',
      metadata: { suggested }
    });
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ ok: true });
  });

  // --- Manual route-graph override (stores an event) ---
  app.post('/routes/override', async (req, reply) => {
    const body = req.body as any;
    const parsedFull = z.string().regex(/^[\w.-]+\/[\w.-]+$/).safeParse(body?.full);
    if (!parsedFull.success) return reply.code(400).send({ error: 'Provide body.full=owner/name' });
    const repoId = await repoIdByFull(parsedFull.data);
    const graph = body?.graph;
    if (!graph) return reply.code(400).send({ error: 'Provide body.graph' });

    const { error } = await supabase.from('events').insert({
      id: crypto.randomUUID(),
      source: 'ui',
      repo_id: repoId,
      commit_sha: null,
      actor: 'override',
      ts: new Date().toISOString(),
      verb: 'route_graph_override',
      metadata: { graph }
    });
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ ok: true });
  });

  // --- Ingest endpoint: validate vs schema (override > ai), enrich with graph, store ---
  app.post('/ingest', async (req, reply) => {
    try {
      const p = IngestBody.parse(req.body);
      const repoId = await repoIdByFull(p.full);

      // 1) Load schema: prefer override, else latest AI schema
      const ovr = await latestEventByVerb(repoId, 'schema_override');
      const ai = await latestEventByVerb(repoId, 'schema');
      const schema: any =
        (ovr?.metadata as any)?.suggested ||
        (ai?.metadata as any)?.suggested ||
        { events: [] };

      const events = Array.isArray(schema.events) ? schema.events : [];
      const eSpec = events.find((e: any) => e?.name === p.verb);

      if (!eSpec) {
        return reply.code(400).send({ ok: false, error: `Unknown event verb "${p.verb}" in schema` });
      }
      const required = new Set<string>(Array.isArray(eSpec.required) ? eSpec.required : []);
      for (const k of required) {
        if (!(k in p.metadata)) {
          return reply.code(400).send({ ok: false, error: `Missing required field "${k}" for ${p.verb}` });
        }
      }

      // 2) Enrich with route graph (override > ai)
      const gro = await latestEventByVerb(repoId, 'route_graph_override');
      const gra = await latestEventByVerb(repoId, 'route_graph');
      const graph: any = (gro?.metadata as any)?.graph || (gra?.metadata as any)?.graph || null;

      let node_id: string | null = null;
      let edge_id: string | null = null;

      const route = asString((p.metadata as any).route);
      const pageUrl = asString((p.metadata as any).page_url);
      const prevNodeId = asString((p.metadata as any).prev_node_id);

      if (graph && (route || pageUrl)) {
        const path = route ?? coercePathFromUrl(pageUrl);
        const nodes: any[] = Array.isArray(graph?.nodes) ? graph.nodes : [];
        if (path) {
          for (const n of nodes) {
            const pat = n?.pattern ?? n?.id;
            try {
              if (toRegexFromPattern(pat).test(path)) { node_id = String(n.id); break; }
            } catch { /* ignore bad patterns */ }
          }
          if (node_id && prevNodeId) {
            edge_id = `${prevNodeId}->${node_id}`;
          }
        }
      }

      // 3) Insert the event
      const row = {
        id: crypto.randomUUID(),
        source: p.source,
        repo_id: repoId,
        commit_sha: null,
        actor: (p.metadata as any)?.actor ?? null,
        ts: new Date(p.ts ?? Date.now()).toISOString(),
        verb: p.verb,
        metadata: { ...(p.metadata as Record<string, unknown>), node_id, edge_id }
      };
      const { error } = await supabase.from('events').insert(row);
      if (error) return reply.code(500).send({ ok: false, error: error.message });

      return reply.send({ ok: true, node_id, edge_id });
    } catch (e: any) {
      return reply.code(400).send({ ok: false, error: e?.message || 'bad request' });
    }
  });
  // Basic app management endpoints
  app.get('/apps', async (req, reply) => {
    return reply.send({ apps: [], message: 'app management coming soon' });
  });

  app.post('/apps', async (req, reply) => {
    const body = req.body as any;
    return reply.send({
      app: {
        name: body.name || 'unnamed app',
        created: new Date().toISOString()
      }
    });
  });
}
