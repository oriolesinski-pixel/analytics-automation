// src/routes/schema.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'node:fs';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { createClient } from '@supabase/supabase-js';

// ---------- Supabase ----------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------- Schemas ----------
const FullRepo = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
const FileSpec = z.object({ path: z.string().min(1), content: z.string().default('') });
const ApproveBody = z.object({
  full: FullRepo,
  commit_sha: z.string().min(7),
  files: z.array(FileSpec).optional(),
  force: z.boolean().optional(),
  auto_inject: z.boolean().optional().default(true),
});

// ---------- Helpers ----------
function parseFull(full: string) {
  const [owner, name] = full.split('/');
  return { owner, name };
}
function b64(s: string) {
  return Buffer.from(s, 'utf8').toString('base64');
}
function sanitizePath(pth: string) {
  if (pth.startsWith('/') || pth.includes('..')) throw new Error(`Unsafe path "${pth}"`);
  return pth;
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

async function latestSchemaEvent(repoId: string) {
  const { data } = await supabase
    .from('events')
    .select('commit_sha, ts, metadata')
    .eq('repo_id', repoId)
    .eq('verb', 'schema')
    .order('ts', { ascending: false })
    .limit(1).maybeSingle();
  return data ?? null;
}

function safeIncludes(hay: string | null | undefined, needle: string) {
  return typeof hay === 'string' && hay.includes(needle);
}
function injectOnce(src: string, beforeNeedle: string, snippet: string) {
  if (src.includes(snippet.trim())) return src; // idempotent
  const idx = src.indexOf(beforeNeedle);
  if (idx === -1) return src; // can't inject safely
  return src.slice(0, idx) + snippet + src.slice(idx);
}
function prependOnce(src: string, snippet: string) {
  if (src.includes(snippet.trim())) return src; // idempotent
  return snippet + src;
}
async function tryGetText(octokit: Octokit, owner: string, repo: string, path: string, ref: string): Promise<string | null> {
  try {
    const r = await octokit.rest.repos.getContent({ owner, repo, path, ref });
    // @ts-ignore
    if (r?.data?.type === 'file' && r?.data?.content) {
      // @ts-ignore
      const buf = Buffer.from(r.data.content, r.data.encoding || 'base64').toString('utf8');
      return buf;
    }
    return null;
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
}

// Write/create a file on a branch, handling existing sha + force
async function upsertFile(octokit: Octokit, opts: {
  owner: string; repo: string; branch: string;
  path: string; content: string; message: string; force: boolean;
}) {
  const { owner, repo, branch, path, content, message, force } = opts;

  // Check if exists on the branch to get sha
  let existingSha: string | null = null;
  try {
    const get = await octokit.rest.repos.getContent({
      owner, repo, path, ref: `heads/${branch}`,
    });
    if (!Array.isArray(get.data) && get.data && 'sha' in get.data) {
      existingSha = (get.data as any).sha || null;
    }
  } catch (e: any) {
    if (e?.status !== 404) throw e; // 404 == not found; ok to create
  }

  if (existingSha && !force) {
    const err: any = new Error(`Refusing to overwrite existing file ${path} without force=true`);
    err.status = 409;
    err.collisions = [path];
    throw err;
  }

  return await octokit.rest.repos.createOrUpdateFileContents({
    owner, repo, path,
    message,
    content: b64(content),
    branch,
    sha: existingSha || undefined,
  });
}

export default async function schemaRoutes(app: FastifyInstance) {
  // GET /schema/latest?full=owner/name
  app.get('/schema/latest', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const full = (req.query as any)?.full;
      const ok = FullRepo.safeParse(full);
      if (!ok.success) return reply.code(400).send({ error: 'Provide ?full=owner/name' });
      const { owner, name } = parseFull(full);
      const repo = await getRepoRow(owner, name);
      const ev = await latestSchemaEvent(repo.id);
      if (!ev) return reply.code(404).send({ error: 'No schema suggestions yet' });
      const suggested = (ev.metadata as any)?.suggested ?? null;
      return reply.send({ full, commit_sha: ev.commit_sha, ts: ev.ts, suggested });
    } catch (e:any) {
      return reply.code(500).send({ error: e.message || 'Unknown error' });
    }
  });

  // POST /schema/approve
  app.post('/schema/approve', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = ApproveBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() });

    const { full, commit_sha, files: inputFiles, force = false, auto_inject = true } = parsed.data;
    const { owner, name } = parseFull(full);

    // ---- Templates ----
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

**Wire-up**: imports are auto-injected by the bot for common frameworks (Next.js, CRA/Vite).
If something wasn't wired, you can manually add:
\`\`\`ts
import './aa/tracker'
import './aa/adapter'
\`\`\`
`;

    const FIRE_TS = `export function aaFire(name: string, props: Record<string, any> = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aa:track', { detail: { name, props } }));
  }
}\n`;

    const ADAPTER_TS = `import { aaFire } from './fire';
function delegateClick(sel:string, h:(el:Element,e:MouseEvent)=>void){ document.addEventListener('click',ev=>{const t=ev.target as Element|null; const el=t?.closest?.(sel); if(el) h(el, ev as MouseEvent);}); }
export function initAAAdapter(){
  delegateClick('[data-aa-id]', el => {
    const id=(el as HTMLElement).getAttribute('data-aa-id')||'unknown';
    const text=(el.textContent||'').trim().slice(0,80);
    aaFire('button_click',{button_id:id,surface:'auto',text});
  });
  aaFire('page_view',{ page_url: location.href, referrer: document.referrer || null });
}
if(typeof window!=='undefined'){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>initAAAdapter()); else initAAAdapter(); }\n`;

    const TRACKER_TS = `type AAPayload={name:string;props:Record<string,any>}; const ENDPOINT=(window as any).__AA_ENDPOINT__||(process?.env?.AA_ENDPOINT??'/ingest');
function valid(p:AAPayload){ return !!p?.name && typeof p.name==='string'; }
async function send(p:AAPayload){ try{ await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({full:(window as any).__AA_FULL__||'',source:'web',ts:Date.now(),verb:p.name,metadata:p.props}),keepalive:true}); }catch{} }
(function(){ if(typeof window==='undefined') return; window.addEventListener('aa:track',(ev:Event)=>{ const d=(ev as CustomEvent).detail as AAPayload; valid(d)&&send(d); }); })();\n`;

    const AAPROVIDER_TSX = `"use client";
import { useEffect } from 'react';
export default function AAProvider(){
  useEffect(()=>{ if(typeof window!=='undefined'){ const fire=(name:string,props:any={})=>window.dispatchEvent(new CustomEvent('aa:track',{detail:{name,props}}));
    fire('page_view',{ route: location.pathname, page_url: location.href }); }},[]);
  return null;
}
`;

    try {
      // ---- Installation-scoped Octokit ----
      const repoRow = await getRepoRow(owner, name);
      const instOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: Number(process.env.GITHUB_APP_ID),
          privateKey: readPrivateKey(),
          installationId: repoRow.installation_id,
        },
      });

      // ---- Bootstrap detection ----
      let isBootstrap = false;
      try { await instOctokit.rest.repos.getContent({ owner, repo: name, path: '.analytics/contract.json', ref: commit_sha }); }
      catch (e:any) { if (e.status === 404) isBootstrap = true; else throw e; }

      // ---- Collect files (from input or from suggestion) ----
      const files: Array<{ path: string; content: string }> = [];
      if (inputFiles?.length) {
        inputFiles.forEach((f) => files.push({ path: sanitizePath(f.path), content: f.content ?? '' }));
      } else {
        const { data: ev } = await supabase
          .from('events').select('metadata')
          .eq('repo_id', repoRow.id).eq('verb','schema').eq('commit_sha', commit_sha)
          .maybeSingle();
        const sugg = (ev?.metadata as any)?.suggested;
        (sugg?.snippets ?? []).forEach((s:any)=> files.push({ path: sanitizePath(s.path), content: s.content ?? '' }));
      }

      // Ensure runtime files
      const addCore = () => {
        files.push(
          { path: 'src/aa/fire.ts',    content: FIRE_TS },
          { path: 'src/aa/adapter.ts', content: ADAPTER_TS },
          { path: 'src/aa/tracker.ts', content: TRACKER_TS },
        );
      };

      if (isBootstrap) {
        let adapterMap = `{"routes":[],"buttons":[],"forms":[],"modals":[],"search":[]}\n`;
        try {
          const { data: ev2 } = await supabase
            .from('events').select('metadata')
            .eq('repo_id', repoRow.id).eq('verb','schema').eq('commit_sha', commit_sha)
            .maybeSingle();
          const m = (ev2?.metadata as any)?.suggested?.adapterMap;
          if (m) adapterMap = JSON.stringify(m, null, 2) + '\n';
        } catch {}
        files.push(
          { path: '.analytics/contract.json',    content: CONTRACT_JSON },
          { path: '.analytics/adapter.map.json', content: adapterMap },
          { path: '.analytics/README.md',        content: README_MD },
        );
        addCore();
      } else {
        addCore();
      }

      // ---- Auto-injection (framework patch) ----
      type PatchTarget = { path: string, kind: 'next-app' | 'next-pages' | 'react-vite' | 'vanilla' };
      const candidates: PatchTarget[] = [
        { path: 'src/app/layout.tsx', kind: 'next-app' },
        { path: 'app/layout.tsx',     kind: 'next-app' },
        { path: 'src/pages/_app.tsx', kind: 'next-pages' },
        { path: 'pages/_app.tsx',     kind: 'next-pages' },
        { path: 'src/main.tsx',       kind: 'react-vite' },
        { path: 'index.html',         kind: 'vanilla' },
        { path: 'public/index.html',  kind: 'vanilla' },
      ];

      let injectedAt: string | null = null;
      if (auto_inject) {
        for (const c of candidates) {
          const text = await tryGetText(instOctokit, owner, name, c.path, commit_sha);
          if (!text) continue;

          let updated = text;

          if (c.kind === 'next-app') {
            const aaProvPath = 'src/app/AAProvider.tsx';
            const haveProv = await tryGetText(instOctokit, owner, name, aaProvPath, commit_sha);
            if (!haveProv) files.push({ path: aaProvPath, content: AAPROVIDER_TSX });

            if (!safeIncludes(updated, "import '../aa/adapter'") && !safeIncludes(updated, 'import "../aa/adapter"')) {
              updated = prependOnce(updated, `import "../aa/adapter";\n`);
            }
            if (!updated.includes('<AAProvider />')) {
              if (updated.includes('</body>')) {
                updated = updated.replace('</body>', '        <AAProvider />\n      </body>');
              } else if (updated.includes('<body')) {
                updated = injectOnce(updated, '>', '\n        <AAProvider />\n');
              }
            }
            files.push({ path: c.path, content: updated });
            injectedAt = c.path;
            break;
          }

          if (c.kind === 'next-pages') {
            let patched = updated;
            if (!safeIncludes(patched, "import '../aa/adapter'") && !safeIncludes(patched, 'import "../aa/adapter"')) {
              patched = prependOnce(patched, `import "../aa/adapter";\n`);
            }
            if (!/function\s+AAProvider|const\s+AAProvider/.test(patched)) {
              patched = prependOnce(patched,
                `import { useEffect } from "react";\nfunction AAProvider(){ useEffect(()=>{ if(typeof window!=="undefined"){ window.dispatchEvent(new CustomEvent("aa:track",{detail:{name:"page_view",props:{route:location.pathname,page_url:location.href}}})) }},[]); return null }\n`
              );
            }
            if (!patched.includes('<AAProvider />')) {
              patched = patched.replace(/return\s*\(/, 'return (\n      <AAProvider />\n');
            }
            files.push({ path: c.path, content: patched });
            injectedAt = c.path;
            break;
          }

          if (c.kind === 'react-vite') {
            let patched = updated;
            if (!safeIncludes(patched, "import './aa/adapter'") && !safeIncludes(patched, "import './aa/adapter.ts'")) {
              patched = prependOnce(patched, `import "./aa/adapter";\n`);
            }
            files.push({ path: c.path, content: patched });
            injectedAt = c.path;
            break;
          }

          if (c.kind === 'vanilla') {
            if (!updated.includes('src="/src/aa/adapter.ts"') && !updated.includes("src='/src/aa/adapter.ts'")) {
              const tag = `<script type="module" src="/src/aa/adapter.ts"></script>`;
              if (updated.includes('</body>')) {
                updated = updated.replace('</body>', `  ${tag}\n</body>`);
              } else if (updated.includes('</head>')) {
                updated = updated.replace('</head>', `  ${tag}\n</head>`);
              } else {
                updated = updated + `\n${tag}\n`;
              }
            }
            files.push({ path: c.path, content: updated });
            injectedAt = c.path;
            break;
          }
        }
      }

      // ---- Ensure branch exists from the provided commit_sha ----
      const branch = branchNameFromCommit(commit_sha);
      const refName = `heads/${branch}`;

      try {
        await instOctokit.rest.git.getRef({ owner, repo: name, ref: refName });
      } catch (e:any) {
        if (e?.status === 404) {
          await instOctokit.rest.git.createRef({
            owner, repo: name,
            ref: `refs/${refName}`,
            sha: commit_sha
          });
        } else {
          throw e;
        }
      }

      // If an open PR for this branch already exists, return it (idempotent)
      const existing = await instOctokit.rest.pulls.list({
        owner, repo: name, state: 'open', head: `${owner}:${branch}`
      });
      if (existing.data.length) {
        const pr = existing.data[0];
        return reply.send({ status: 'exists', pr_number: pr.number, pr_url: pr.html_url, branch, injectedAt });
      }

      // ---- Write files via Contents API (handles sha + force per file) ----
      const msg = commitMessage(commit_sha);
      for (const f of files) {
        await upsertFile(instOctokit, {
          owner, repo: name, branch,
          path: f.path, content: f.content, message: msg, force: !!force,
        });
      }

      // ---- Open PR
      const repoInfo = await instOctokit.rest.repos.get({ owner, repo: name });
      const baseBranch = repoInfo.data.default_branch || 'main';
      const pr = await instOctokit.rest.pulls.create({
        owner, repo: name,
        title: isBootstrap ? 'Add analytics bootstrap (auto)' : 'Add analytics instrumentation (auto)',
        head: branch, base: baseBranch,
        body: [
          `Automated analytics ${isBootstrap ? 'bootstrap' : 'instrumentation'} for commit \`${commit_sha}\`.`,
          `Files added/updated:`,
          ...files.map(f=>`- \`${f.path}\``),
          auto_inject ? `\nAuto-injected wiring into framework entry (if detected).` : '',
          `\nGenerated by ${process.env.GH_APP_SLUG || 'analytics-automation-bot'}.`
        ].join('\n')
      });

      return reply.send({
        status: 'created',
        mode: isBootstrap ? 'bootstrap' : 'delta',
        pr_number: pr.data.number,
        pr_url: pr.data.html_url,
        branch,
        injectedAt
      });
    } catch (e:any) {
      const status = Number(e?.status) || 500;
      return reply.code(status >= 400 && status < 600 ? status : 500).send({ error: e.message || 'Unknown error creating PR', details: e?.response?.data });
    }
  });
}
