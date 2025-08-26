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
  status: string;
  event_type: string | null;
  summary: any;
};
type RepoRow = {
  id: string;
  provider: 'github';
  owner: string;
  name: string;
  default_branch: string;
  installation_id: string | null;
};

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
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function parseCompare(compare?: string | null): { base?: string; head?: string } {
  if (!compare) return {};
  const i = compare.lastIndexOf('/compare/');
  if (i === -1) return {};
  const tail = compare.slice(i + '/compare/'.length);
  const parts = tail.split('...');
  if (parts.length !== 2) return {};
  return { base: parts[0], head: parts[1] };
}

function extOf(filename: string) {
  const i = filename.lastIndexOf('.');
  return i === -1 ? '' : filename.slice(i + 1).toLowerCase();
}

async function fetchDiff(repo: RepoRow, base: string, head: string) {
  if (!repo.installation_id) throw new Error('Repo has no installation_id');
  const instAuth: any = await appOctokit.auth({ type: 'installation', installationId: Number(repo.installation_id) });
  const kit = new Octokit({ auth: instAuth.token });

  const { data } = await kit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
    owner: repo.owner,
    repo: repo.name,
    base,
    head,
    per_page: 250,
  });

  const files = (data.files ?? []).map((f: any) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
  }));

  const totals = files.reduce(
    (acc: any, f: any) => {
      acc.files += 1;
      acc.additions += f.additions || 0;
      acc.deletions += f.deletions || 0;
      const ex = extOf(f.filename);
      if (ex) acc.by_ext[ex] = (acc.by_ext[ex] || 0) + 1;
      return acc;
    },
    { files: 0, additions: 0, deletions: 0, by_ext: {} as Record<string, number> }
  );

  const top = [...files].sort((a, b) => (b.changes || 0) - (a.changes || 0)).slice(0, 8);
  return { totals, topFiles: top.map(f => f.filename) };
}

async function analyzeWithOpenAI(ctx: {
  repoFull: string;
  base: string;
  head: string;
  totals: { files: number; additions: number; deletions: number; by_ext: Record<string, number> };
  topFiles: string[];
}) {
  const summaryLine = `Changes: ${ctx.totals.files} files, +${ctx.totals.additions}/-${ctx.totals.deletions}. By ext: ${Object.entries(ctx.totals.by_ext).map(([k,v])=>`${k}:${v}`).join(', ') || 'n/a'}`;
  const prompt = `
You are a senior code change analyst. Summarize the impact of a git push for stakeholders (eng/Product/SWE). 
Keep it crisp (3–5 bullets). Include scope, risk, notable areas, and suggested follow-ups.
Repo: ${ctx.repoFull}
Range: ${ctx.base}...${ctx.head}
${summaryLine}
Top files: ${ctx.topFiles.slice(0,8).join(', ') || 'n/a'}
`.trim();

  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'Return concise, actionable bullets. Avoid fluff.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  });

  const text = resp.choices?.[0]?.message?.content?.trim() || 'No analysis generated.';
  return { model: resp.model || OPENAI_MODEL, insight: text };
}

async function runOnce() {
  // pick the oldest queued push
  const pick = await supabase
    .from('analyzer_runs')
    .select('id, repo_id, commit_sha, status, event_type, summary')
    .eq('status', 'queued')
    .eq('event_type', 'push')
    .order('created_at', { ascending: true })
    .limit(1);

  if (pick.error) throw new Error(pick.error.message);
  const run: RunRow | undefined = pick.data?.[0];
  if (!run) { console.log('no queued push rows'); return; }

  await supabase.from('analyzer_runs').update({ status: 'running' }).eq('id', run.id);

  const r = await supabase.from('repos').select('*').eq('id', run.repo_id).single();
  if (r.error) throw new Error(r.error.message);
  const repo = r.data as RepoRow;

  const s = run.summary || {};
  const base = s.base_sha || parseCompare(s.compare).base;
  const head = s.head_sha || run.commit_sha || parseCompare(s.compare).head;
  if (!base || !head) throw new Error('Missing base/head SHAs');

  const diff = await fetchDiff(repo, base, head);
  const analysis = await analyzeWithOpenAI({
    repoFull: `${repo.owner}/${repo.name}`,
    base, head,
    totals: diff.totals,
    topFiles: diff.topFiles,
  });

  const newSummary = {
    ...(run.summary || {}),
    analysis: {
      model: `openai:${analysis.model}`,
      insight: analysis.insight,
      totals: diff.totals,
      top_files: diff.topFiles,
      base_sha: base,
      head_sha: head,
    },
  };

  // write a derived event (dedupe on repo_id+commit+verb if you added that index)
  const evt = await supabase.from('events').insert({
    id: crypto.randomUUID(),
    source: 'github',
    repo_id: repo.id,
    commit_sha: head,
    actor: null,
    verb: 'push_summary',
    metadata: newSummary.analysis,
  });
  if (evt.error && evt.error.code !== '23505') throw new Error(evt.error.message);

  const upd = await supabase
    .from('analyzer_runs')
    .update({ status: 'completed', framework: `openai:${analysis.model}`, summary: newSummary })
    .eq('id', run.id);
  if (upd.error) throw new Error(upd.error.message);

  console.log('completed', run.id, `${repo.owner}/${repo.name}`, head);
}

runOnce().catch(e => { console.error('worker failed:', e?.message || e); process.exit(1); });
