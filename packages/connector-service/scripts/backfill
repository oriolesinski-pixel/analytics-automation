import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

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
  process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const appOctokit = new Octokit({
  authStrategy: createAppAuth,
  auth: { appId: Number(process.env.GITHUB_APP_ID!), privateKey: getGithubPrivateKey() },
});

function parseFull(full: string) {
  const [owner, name] = full.split('/');
  if (!owner || !name) throw new Error('Use --full owner/name');
  return { owner, name };
}

async function ensureRepo(full: string, defaultBranch: string, installationId: string | null) {
  const [owner, name] = full.split('/');
  const up = await supabase
    .from('repos')
    .upsert(
      { provider: 'github', owner, name, default_branch: defaultBranch, installation_id: installationId },
      { onConflict: 'provider,owner,name' }
    )
    .select()
    .single();
  if (up.error) throw new Error(up.error.message);
  return up.data;
}

async function main() {
  const fullArg = process.argv.find(a => a.startsWith('--full='));
  const countArg = process.argv.find(a => a.startsWith('--count='));
  if (!fullArg) throw new Error('Usage: pnpm tsx scripts/backfill.ts --full=owner/name [--count=20]');
  const full = fullArg.split('=')[1];
  const count = Number((countArg?.split('=')[1] ?? '20'));

  const { owner, name } = parseFull(full);

  // find repo row (must have installation_id)
  const repoRes = await supabase
    .from('repos')
    .select('*')
    .eq('provider', 'github')
    .eq('owner', owner)
    .eq('name', name)
    .single();

  let repo = repoRes.data as any;
  let installationId = repo?.installation_id ?? null;

  // if no repo row, try to infer installation and default branch from GitHub
  if (!repo) throw new Error('Repo not found in DB. Trigger an installation event first.');
  if (!installationId) throw new Error('Repo has no installation_id. Reinstall app or handle installation events.');

  // get install token + default branch from GitHub
  const instAuth: any = await appOctokit.auth({ type: 'installation', installationId: Number(installationId) });
  const kit = new Octokit({ auth: instAuth.token });
  const repoInfo = await kit.repos.get({ owner, repo: name });
  const defaultBranch = repoInfo.data.default_branch || 'main';

  // ensure repo defaults are up to date
  repo = await ensureRepo(full, defaultBranch, String(installationId));

  // list recent commits on default branch
  const commits = await kit.repos.listCommits({
    owner, repo: name, sha: defaultBranch, per_page: Math.min(count, 100),
  });

  let inserted = 0, skipped = 0;
  for (const c of commits.data) {
    const headSha = c.sha;
    const baseSha = c.parents?.[0]?.sha || null; // first parent
    // skip root commits without a parent
    if (!baseSha) { skipped++; continue; }

    // dedupe check
    const exists = await supabase
      .from('analyzer_runs')
      .select('id')
      .eq('repo_id', repo.id)
      .eq('commit_sha', headSha)
      .limit(1);

    if (exists.data && exists.data.length > 0) { skipped++; continue; }

    const summary = {
      compare: `https://github.com/${owner}/${name}/compare/${baseSha}...${headSha}`,
      base_sha: baseSha,
      head_sha: headSha,
      context: { branch: defaultBranch, actor: null },
      stats: { added: 0, removed: 0, modified: 0 } // worker will compute real stats
    };

    const ins = await supabase.from('analyzer_runs').insert({
      id: crypto.randomUUID(),
      repo_id: repo.id,
      commit_sha: headSha,
      framework: null,
      status: 'queued',
      event_type: 'push',
      summary,
    });
    if (ins.error) throw new Error(ins.error.message);
    inserted++;
  }

  console.log(JSON.stringify({ ok: true, repo_id: repo.id, inserted, skipped }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });

