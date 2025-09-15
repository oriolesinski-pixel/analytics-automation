// scripts/analyzer-worker.ts
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import OpenAI from 'openai';

type RunRow = {
  id: string;
  repo_id: string;
  commit_sha: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  event_type: string | null;
  summary: any;
};

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/* ---------------- helpers ---------------- */
function getGithubPrivateKey(): string {
  const inline = process.env.GITHUB_PRIVATE_KEY;
  if (inline && inline.trim()) {
    let k = inline.trim();
    if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
    return k.replace(/\\n/g, '\n').trim();
  }
  const filePath = process.env.GITHUB_PRIVATE_KEY_PATH;
  if (filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    return fs.readFileSync(abs, 'utf8').trim();
  }
  throw new Error('No GitHub private key configured');
}
function toShort(sha?: string | null) { return sha ? sha.slice(0, 7) : ''; }
function parseCompare(compare?: string | null): { base?: string; head?: string } {
  if (!compare) return {};
  const i = compare.lastIndexOf('/compare/');
  if (i === -1) return {};
  const tail = compare.slice(i + '/compare/'.length);
  const parts = tail.split('...');
  if (parts.length !== 2) return {};
  return { base: parts[0], head: parts[1] };
}
function b64ToStr(b64: string) {
  return Buffer.from(b64, 'base64').toString('utf8');
}

/* ---- clients ---- */
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const appOctokit = new Octokit({
  authStrategy: createAppAuth,
  auth: { appId: Number(process.env.GITHUB_APP_ID!), privateKey: getGithubPrivateKey() },
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function getInstallationOctokit(owner: string, repo: string) {
  const inst = await appOctokit.rest.apps.getRepoInstallation({ owner, repo });
  const auth: any = await appOctokit.auth({ type: 'installation', installationId: inst.data.id });
  return new Octokit({ auth: auth.token });
}

/* ---- discovery helpers ---- */
async function fetchPackageJson(kit: Octokit, owner: string, repo: string, ref: string) {
  try {
    const { data } = await kit.rest.repos.getContent({ owner, repo, path: 'package.json', ref });
    if (!('content' in data)) return null;
    const raw = b64ToStr((data as any).content);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function detectFrameworks(pkg: any): string[] {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const found: string[] = [];
  const add = (k: string) => { if (!found.includes(k)) found.push(k); };
  if (deps['next']) add('nextjs');
  if (deps['react']) add('react');
  if (deps['vue']) add('vue');
  if (deps['@angular/core']) add('angular');
  if (deps['svelte']) add('svelte');
  if (deps['react-router'] || deps['react-router-dom']) add('react-router');
  return found;
}

function isRouteLikePath(p: string) {
  return (
    p.startsWith('pages/') || p.includes('/pages/') ||
    p.startsWith('app/') || p.includes('/app/') ||
    p.startsWith('src/routes') || p.includes('/routes/') ||
    /\/page\.(t|j)sx?$/.test(p) ||
    p.endsWith('.vue') ||
    p.endsWith('.svelte') ||
    /app\/.*\/(layout|page)\.(t|j)sx?$/.test(p)
  );
}

async function listRoutesFromTree(kit: Octokit, owner: string, repo: string, ref: string) {
  try {
    // 1) get the commit so we can grab its tree SHA
    const commit = await kit.rest.repos.getCommit({ owner, repo, ref });
    const treeSha = commit.data.commit.tree.sha;

    // 2) list the whole tree at that commit
    const { data } = await kit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: 'true' as any
    });

    const files = (data.tree || [])
      .filter((t: any) => t.type === 'blob')
      .map((t: any) => t.path as string);

    return files.filter(isRouteLikePath).slice(0, 60);
  } catch {
    return [];
  }
}


function summarizeCompare(cmp: any) {
  const files = (cmp.files ?? []).map((f: any) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions || 0,
    deletions: f.deletions || 0,
    changes: f.changes || 0,
  }));
  const totals = files.reduce(
    (acc: any, f) => {
      acc.files += 1;
      acc.additions += f.additions;
      acc.deletions += f.deletions;
      const ext = f.filename.includes('.') ? f.filename.split('.').pop()!.toLowerCase() : '';
      if (ext) acc.by_ext[ext] = (acc.by_ext[ext] || 0) + 1;
      return acc;
    },
    { files: 0, additions: 0, deletions: 0, by_ext: {} as Record<string, number> }
  );
  const topFiles = [...files].sort((a, b) => b.changes - a.changes).slice(0, 12).map(f => f.filename);
  const changedFrontend = files.map(f => f.filename).filter(isRouteLikePath).slice(0, 40);
  return { totals, topFiles, changedFrontend };
}

/* ---- prompt ---- */
function buildSchemaPrompt(args: {
  repoFull: string;
  base: string;
  head: string;
  frameworks: string[];
  routesSample: string[];
  changedFrontend: string[];
  totals: { files: number; additions: number; deletions: number; by_ext: Record<string, number> };
}) {
  const frameworksLine = args.frameworks.length ? args.frameworks.join(', ') : 'unknown';
  const routesList = args.routesSample.length ? args.routesSample.map(r => `- ${r}`).join('\n') : '(none detected)';
  const changedList = args.changedFrontend.length ? args.changedFrontend.map(r => `- ${r}`).join('\n') : '(none in this push)';

  return `
You are an analytics architect. From the context below, propose a FRONT-END analytics event schema and minimal instrumentation snippets.

Return STRICT JSON with this exact shape:
{
  "frameworks": string[],                // detected frameworks, e.g. ["nextjs","react-router"]
  "events": [                            // 3–12 high-signal events
    {
      "name": string,                    // e.g. "PageViewed", "CTA_Clicked", "Signup_Submitted"
      "when": string,                    // human-readable trigger, e.g. "on route render /dashboard"
      "properties": { [key: string]: "string"|"number"|"boolean" },
      "severity": "low"|"medium"|"high"  // business impact / alert priority
    }
  ],
  "snippets": [                          // <= 2 tiny snippets to wire analytics
    {
      "framework": "react"|"nextjs"|"vue"|"angular"|"svelte",
      "language": "ts"|"js",
      "filename": string,                // where to place it
      "code": string                     // <= ~40 lines
    }
  ]
}

Prefer generalizable, privacy-aware properties (no PII). Use stable names and camelCase keys.

# Repo
${args.repoFull}
Range: ${toShort(args.base)}...${toShort(args.head)}
Frameworks: ${frameworksLine}
Totals: files=${args.totals.files}, +${args.totals.additions}/-${args.totals.deletions}

# Routes (sample)
${routesList}

# Front-end files changed in this push
${changedList}
`.trim();
}

/* ---------------- main unit of work ---------------- */
async function runOnce() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');

  // 1) pick oldest queued push
  const pick = await supabase
    .from('analyzer_runs')
    .select('id, repo_id, commit_sha, status, event_type, summary')
    .eq('status', 'queued')
    .eq('event_type', 'push')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pick.error) throw new Error(pick.error.message);
  const run: RunRow | null = pick.data || null;
  if (!run) { console.log('no queued push rows'); return; }

  await supabase.from('analyzer_runs').update({ status: 'running' }).eq('id', run.id);

  try {
    // 2) repo info
    const r = await supabase
      .from('repos')
      .select('owner,name,default_branch')
      .eq('id', run.repo_id)
      .single();
    if (r.error) throw new Error(r.error.message);
    const owner = r.data.owner as string;
    const name = r.data.name as string;
    const repoFull = `${owner}/${name}`;

    // 3) resolve base/head (from run summary or GitHub)
    const s = run.summary || {};
    let base = s.base_sha || parseCompare(s.compare)?.base || null;
    let head = s.head_sha || run.commit_sha || parseCompare(s.compare)?.head || null;

    const kit = await getInstallationOctokit(owner, name);

    if (!head) throw new Error('Missing head commit SHA for schema analyzer');
    if (!base) {
      const headCommit = await kit.rest.repos.getCommit({ owner, repo: name, ref: head });
      base = headCommit.data.parents?.[0]?.sha || null;
    }
    if (!base) throw new Error('Could not determine base commit (no parent)');

    // 4) compare and summarize
    const cmp = await kit.rest.repos.compareCommits({ owner, repo: name, base, head, per_page: 250 });
    const { totals, topFiles, changedFrontend } = summarizeCompare(cmp.data);

    // 5) discover framework + routes (using head)
    const pkg: any = await fetchPackageJson(kit, owner, name, head);
    const frameworks = detectFrameworks(pkg);
    const routesSample = await listRoutesFromTree(kit, owner, name, head);

    // (optional, recommended) skip non-frontend repos to avoid noise
    if ((frameworks?.length ?? 0) === 0 && routesSample.length === 0 && changedFrontend.length === 0) {
      await supabase
        .from('analyzer_runs')
        .update({
          status: 'completed',
          summary: { ...(run.summary || {}), note: 'skipped: no frontend signals detected at head commit' }
        })
        .eq('id', run.id);

      console.log('completed(skip-non-frontend)', run.id, repoFull, head);
      return;
    }
    if (frameworks.length === 0 && routesSample.length === 0 && changedFrontend.length === 0) {
      await supabase
        .from('analyzer_runs')
        .update({
          status: 'completed',
          summary: { ...(run.summary || {}), note: 'skipped: no frontend signals detected at head commit' }
        })
        .eq('id', run.id);

      console.log('completed(skip-non-frontend)', run.id, repoFull, head);
      return;
    }
    // 5) discover framework + routes (using head)
    // const pkg = await fetchPackageJson(kit, owner, name, head);
    // const frameworks = detectFrameworks(pkg);

    // 6) OpenAI: propose schema (JSON mode)
    const prompt = buildSchemaPrompt({
      repoFull, base, head, frameworks, routesSample, changedFrontend, totals
    });

    const cc = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const text = cc.choices?.[0]?.message?.content?.trim() || '{}';
    const schema = JSON.parse(text);

    const compareUrl = `https://github.com/${owner}/${name}/compare/${toShort(base)}...${toShort(head)}`;

    // 7) upsert derived event (verb='schema')
    const ev = await supabase
      .from('events')
      .upsert({
        id: crypto.randomUUID(),
        source: 'github',
        repo_id: run.repo_id,
        commit_sha: head,
        actor: cmp.data?.commits?.[cmp.data.commits.length - 1]?.author?.login || null,
        ts: new Date().toISOString(),
        verb: 'schema',
        metadata: {
          compare: compareUrl,
          base_sha: base,
          head_sha: head,
          frameworks,
          totals,
          top_files: topFiles,
          routes_sample: routesSample,
          changed_frontend: changedFrontend,
          suggested: schema, // { frameworks, events[], snippets[] }
        },
      }, { onConflict: 'repo_id,commit_sha,verb' })
      .select()
      .maybeSingle();

    if ((ev as any).error) throw new Error((ev as any).error.message);

    // 8) mark run completed with summary
    const upd = await supabase
      .from('analyzer_runs')
      .update({
        status: 'completed',
        framework: `openai:${cc.model || OPENAI_MODEL}`,
        summary: {
          ...(run.summary || {}),
          schema: {
            compare: compareUrl,
            head_sha: head,
            frameworks,
            event_count: Array.isArray(schema?.events) ? schema.events.length : 0
          }
        }
      })
      .eq('id', run.id);
    if (upd.error) throw new Error(upd.error.message);

    console.log('completed(schema)', run.id, repoFull, head, `events=${Array.isArray(schema?.events) ? schema.events.length : 0}`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    await supabase
      .from('analyzer_runs')
      .update({ status: 'failed', summary: { ...(run.summary || {}), error: msg } })
      .eq('id', run.id);
    console.error('worker failed:', msg);
  }
}

/* ---------------- entry ---------------- */
runOnce().catch(e => { console.error('worker crashed:', e?.message || e); process.exit(1); });
