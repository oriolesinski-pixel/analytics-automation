// src/routes/schema.ts
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { createClient } from '@supabase/supabase-js';

// ---- Supabase (same options style as server.ts) ----
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ---- Validation / helpers ----
const FullRepo = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
const FileSpec = z.object({ path: z.string().min(1), content: z.string().default('') });
const ApproveBody = z.object({
  full: FullRepo,
  commit_sha: z.string().min(7),
  files: z.array(FileSpec).optional(),
  force: z.boolean().optional(),
});

function parseFull(full: string) {
  const [owner, name] = full.split('/');
  return { owner, name };
}
function sanitizePath(path: string) {
  if (path.startsWith('/') || path.includes('..')) throw new Error(`Unsafe path "${path}"`);
  return path;
}
function readPrivateKey(): string {
  if (process.env.GITHUB_PRIVATE_KEY) return process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n');
  if (process.env.GITHUB_PRIVATE_KEY_PATH) return fs.readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH, 'utf8');
  throw new Error('Missing GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH');
}
function branchNameFromCommit(sha: string) { return `aa/analytics-auto-${sha.slice(0,8)}`; }
function commitMessage(sha: string) { return `chore(analytics): add auto instrumentation for ${sha.slice(0,12)}`; }

async function getRepoRow(owner: string, name: string) {
  const { data, error } = await supabase
    .from('repos')
    .select('id, installation_id, default_branch')
    .eq('provider', 'github').eq('owner', owner).eq('name', name)
    .single();
  if (error || !data) throw new Error(`Repo ${owner}/${name} not found in DB`);
  return data as { id: string; installation_id: number; default_branch: string | null };
}

// Build an Installation-auth Octokit (same auth style as your server)
function makeInstallationOctokit(installationId: number) {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: Number(process.env.GITHUB_APP_ID),
      privateKey: readPrivateKey(),
      installationId
    }
  });
}

export default async function schemaRoutes(app: FastifyInstance) {
  // ---------- GET /schema/latest?full=owner/name ----------
  app.get('/schema/latest', async (req, reply) => {
    try {
      const full = (req.query as any)?.full;
      const ok = FullRepo.safeParse(full);
      if (!ok.success) return reply.code(400).send({ error: 'Provide ?full=owner/name' });

      const { owner, name } = parseFull(full);
      const repo = await getRepoRow(owner, name);

      const { data, error } = await supabase
        .from('events')
        .select('commit_sha, ts, metadata')
        .eq('repo_id', repo.id)
        .eq('verb', 'schema')
        .order('ts', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return reply.code(500).send({ error: error.message });
      if (!data) return reply.code(404).send({ error: 'No schema suggestions yet' });

      const suggested = (data.metadata as any)?.suggested ?? null;
      return reply.send({ full, commit_sha: data.commit_sha, ts: data.ts, suggested });
    } catch (e:any) {
      return reply.code(500).send({ error: e.message || 'Unknown error' });
    }
  });

  // ---------- POST /schema/approve ----------
  app.post('/schema/approve', async (req, reply) => {
    const parsed = ApproveBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() });

    const { full, commit_sha, files: inputFiles, force = false } = parsed.data;
    const { owner, name } = parseFull(full);

    // templates for first-time bootstrap (contract + sit-above files)
    const CONTRACT_JSON = `{
  "name":"analytics-core-contract",
  "version":1,
  "events":[
    {"name":"page_view","required":["page_url"],"optional":["referrer","route","title"]},
    {"name":"button_click","required":["button_id"],"optional":["surface","container_id","text"]},
    {"name":"form_submit","required":["form_id","success"],"optional":["error_count"]},
    {"name":"modal_open","required":["modal_id"],"optional":["source"]},
    {"name":"modal_close","required":["modal_id"],"optional":["duration_ms"]},
    {"name":"search_query","required":["query"],"optional":["results_count","source"]}
  ]
}\n`;
    const README_MD = `# Analytics (Auto)
This folder was added by the analytics-automation bot.

**Wire-up**: add to your app entry:
\`\`\`ts
import './aa/tracker';
import './aa/adapter';
\`\`\`
`;
    const FIRE_TS = `export function aaFire(name: string, props: Record<string, any> = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aa:track', { detail: { name, props } }));
  }
}\n`;
    const ADAPTER_TS = `import { aaFire } from './fire';
async function loadMap(){ const r=await fetch('/.analytics/adapter.map.json',{cache:'no-store'}); return r.json(); }
function delegateClick(sel:string, h:(el:Element,e:MouseEvent)=>void){ document.addEventListener('click',ev=>{const t=ev.target as Element|null; const el=t?.closest?.(sel); if(el) h(el, ev as MouseEvent);}); }
function runPV(routes:any[]){ const path=location.pathname; const route=(routes||[]).find((r:any)=>{try{return new RegExp(r.pattern).test(path)}catch{return false}})?.route||path;
  aaFire('page_view',{ page_url:location.href, referrer:document.referrer||null, route, title:document.title||null }); }
export async function initAAAdapter(){
  const map=await loadMap(); runPV(map.routes||[]);
  let last=location.pathname+location.search+location.hash;
  new MutationObserver(()=>{ const now=location.pathname+location.search+location.hash; if(now!==last){ last=now; runPV(map.routes||[]);} }).observe(document.body,{childList:true,subtree:true});
  (map.buttons||[]).forEach((b:any)=>delegateClick(b.selector,(el)=>{ const text=(el.textContent||'').trim().slice(0,80);
    aaFire('button_click',{button_id:b.button_id,surface:b.surface,container_id:b.container_id,text}); }));
  (map.forms||[]).forEach((f:any)=>{ document.addEventListener('submit',ev=>{ const t=ev.target as HTMLFormElement; if(!t?.matches?.(f.selector))return;
    const success=!t.hasAttribute('data-aa-error'); const error_count=Number(t.getAttribute('data-aa-error-count')??'0'); aaFire('form_submit',{form_id:f.form_id,success,error_count}); },{capture:true}); });
  (map.modals||[]).forEach((m:any)=>{ let openAt:number|null=null; new MutationObserver(()=>{ const isOpen=!!document.querySelector(m.openSelector); const isClosed=!!document.querySelector(m.closeSelector);
    if(isOpen&&openAt==null){ openAt=performance.now(); aaFire('modal_open',{modal_id:m.modal_id}); }
    else if(isClosed&&openAt!=null){ const dur=Math.round(performance.now()-openAt); openAt=null; aaFire('modal_close',{modal_id:m.modal_id,duration_ms:dur}); } })
    .observe(document.documentElement,{subtree:true,attributes:true,childList:true}); });
  (map.search||[]).forEach((s:any)=>{ const form=document.querySelector<HTMLFormElement>(s.submitSelector);
    const input=document.querySelector<HTMLInputElement>(s.input); if(form&&input) form.addEventListener('submit',()=>aaFire('search_query',{query:input.value??'',source:s.source}),{capture:true}); });
}
if(typeof window!=='undefined'){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>initAAAdapter()); else initAAAdapter(); }\n`;
    const TRACKER_TS = `type AAPayload={name:string;props:Record<string,any>}; const ENDPOINT=(window as any).__AA_ENDPOINT__||(process?.env?.AA_ENDPOINT??'/ingest');
function valid(p:AAPayload){ return !!p?.name && typeof p.name==='string'; }
async function send(p:AAPayload){ try{ await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source:'web',ts:Date.now(),verb:p.name,metadata:p.props}),keepalive:true}); }catch{} }
(function(){ window.addEventListener('aa:track',(ev:Event)=>{ const d=(ev as CustomEvent).detail as AAPayload; valid(d)&&send(d); }); })();\n`;

    try {
      // 1) Repo + Installation Octokit
      const repoRow = await getRepoRow(owner, name);
      const octokit = makeInstallationOctokit(repoRow.installation_id);

      // 2) Detect bootstrap (no contract at this commit)
      let isBootstrap = false;
      try {
        await octokit.rest.repos.getContent({ owner, repo: name, path: '.analytics/contract.json', ref: commit_sha });
      } catch (e: any) {
        if (e.status === 404) isBootstrap = true; else throw e;
      }

      // 3) Collect files to write
      const files: Array<{ path: string; content: string }> = [];
      if (inputFiles?.length) {
        inputFiles.forEach(f => files.push({ path: sanitizePath(f.path), content: f.content ?? '' }));
      } else {
        const { data: ev } = await supabase
          .from('events').select('metadata')
          .eq('repo_id', repoRow.id).eq('verb','schema').eq('commit_sha', commit_sha)
          .maybeSingle();
        const sugg = (ev?.metadata as any)?.suggested;
        (sugg?.snippets ?? []).forEach((s:any)=> files.push({ path: sanitizePath(s.path), content: s.content ?? '' }));
      }

      if (isBootstrap) {
        // optional adapter map from suggestion, else empty template
        let adapterMap = `{"routes":[],"buttons":[],"forms":[],"modals":[],"search":[]}\n`;
        try {
          const { data: ev2 } = await supabase
            .from('events').select('metadata')
            .eq('repo_id', repoRow.id).eq('verb','schema').eq('commit_sha', commit_sha)
            .maybeSingle();
          const m = ev2?.metadata?.suggested?.adapterMap;
          if (m) adapterMap = JSON.stringify(m, null, 2) + '\n';
        } catch {}
        files.push(
          { path: '.analytics/contract.json',    content: CONTRACT_JSON },
          { path: '.analytics/adapter.map.json', content: adapterMap },
          { path: '.analytics/README.md',        content: README_MD },
          { path: 'src/aa/fire.ts',              content: FIRE_TS },
          { path: 'src/aa/adapter.ts',           content: ADAPTER_TS },
          { path: 'src/aa/tracker.ts',           content: TRACKER_TS },
        );
      }

      // 4) Safety: refuse overwrite unless force=true (check at base commit)
      const collisions: string[] = [];
      for (const f of files) {
        try { await octokit.rest.repos.getContent({ owner, repo: name, path: f.path, ref: commit_sha }); collisions.push(f.path); }
        catch (e:any) { if (e.status !== 404) throw e; }
      }
      if (collisions.length && !force) {
        return reply.code(409).send({ error: 'Refusing to overwrite existing files', collisions, hint: 'Re-run with "force": true' });
      }

      // 5) Idempotent branch/PR
      const branch = branchNameFromCommit(commit_sha);
      const existing = await octokit.rest.pulls.list({ owner, repo: name, state: 'open', head: `${owner}:${branch}` });
      if (existing.data.length) {
        const pr = existing.data[0];
        return reply.send({ status: 'exists', pr_number: pr.number, pr_url: pr.html_url, branch });
      }

      // 6) Ensure branch (heads/<branch>), create if missing at commit_sha
      let baseFor = commit_sha;
      try {
        const ref = await octokit.rest.git.getRef({ owner, repo: name, ref: `heads/${branch}` });
        baseFor = ref.data.object.sha;
      } catch (e:any) {
        if (e.status === 404) await octokit.rest.git.createRef({ owner, repo: name, ref: `refs/heads/${branch}`, sha: commit_sha });
        else throw e;
      }

      // 7) Create blobs -> tree -> commit -> move ref
      const entries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
      for (const f of files) {
        const blob = await octokit.rest.git.createBlob({ owner, repo: name, content: f.content, encoding: 'utf-8' });
        entries.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.data.sha });
      }

      const parent = await octokit.rest.git.getCommit({ owner, repo: name, commit_sha: baseFor });
      const tree = await octokit.rest.git.createTree({ owner, repo: name, base_tree: parent.data.tree.sha, tree: entries });
      const commit = await octokit.rest.git.createCommit({ owner, repo: name, message: commitMessage(commit_sha), tree: tree.data.sha, parents: [baseFor] });
      await octokit.rest.git.updateRef({ owner, repo: name, ref: `heads/${branch}`, sha: commit.data.sha, force: false });

      // 8) Open PR against default branch
      const repoInfo = await octokit.rest.repos.get({ owner, repo: name });
      const baseBranch = repoInfo.data.default_branch || 'main';
      const pr = await octokit.rest.pulls.create({
        owner, repo: name,
        title: isBootstrap ? 'Add analytics bootstrap (auto)' : 'Add analytics instrumentation (auto)',
        head: branch, base: baseBranch,
        body: [
          `Automated analytics ${isBootstrap ? 'bootstrap' : 'instrumentation'} for commit \`${commit_sha}\`.`,
          `Files added/updated:`, ...files.map(f=>`- \`${f.path}\``),
          `\nGenerated by ${process.env.GH_APP_SLUG || 'analytics-automation-bot'}.`
        ].join('\n')
      });

      return reply.send({
        status: 'created',
        mode: isBootstrap ? 'bootstrap' : 'delta',
        pr_number: pr.data.number,
        pr_url: pr.data.html_url,
        branch,
        head_commit: commit.data.sha
      });
    } catch (e:any) {
      const status = Number(e?.status) || 500;
      return reply.code(status >= 400 && status < 600 ? status : 500).send({
        error: e.message || 'Unknown error creating PR',
        details: e?.response?.data
      });
    }
  });
}
