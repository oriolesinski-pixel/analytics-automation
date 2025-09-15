#!/usr/bin/env tsx
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { createClient } from '@supabase/supabase-js';
import { detectFrameworks } from '../src/lib/detectFrameworks';
import crypto from 'node:crypto';

type Args = Record<string, string | boolean | undefined>;
function parseArgs(): Args {
    const a: Args = {};
    for (const arg of process.argv.slice(2)) {
        const m = arg.match(/^--([^=]+)=(.+)$/);
        if (m) a[m[1]] = m[2];
        else if (arg.startsWith('--')) a[arg.slice(2)] = true;
    }
    return a;
}

const SUPABASE = createClient(
    process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

function readPrivateKey(): string {
    if (process.env.GITHUB_PRIVATE_KEY) return process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n');
    const p = process.env.GITHUB_PRIVATE_KEY_PATH;
    if (p) return fs.readFileSync(path.isAbsolute(p) ? p : path.join(process.cwd(), p), 'utf8');
    throw new Error('Missing GitHub private key env');
}

async function getRepoRow(full: string) {
    const [owner, name] = full.split('/');
    const { data, error } = await SUPABASE
        .from('repos')
        .select('id, installation_id, default_branch')
        .eq('provider', 'github').eq('owner', owner).eq('name', name)
        .single();
    if (error || !data) throw new Error('Repo not found in DB. Ensure it exists / installed.');
    return { owner, name, ...data } as {
        owner: string; name: string;
        id: string; installation_id: number; default_branch: string | null;
    };
}

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

async function getHeadAndBase(octo: Octokit, owner: string, repo: string, branch: string) {
    const head = await octo.rest.repos.getBranch({ owner, repo, branch });
    const headSha = head.data.commit.sha;
    // try parent of head as base
    const c = await octo.rest.git.getCommit({ owner, repo, commit_sha: headSha });
    const baseSha = (c.data.parents && c.data.parents[0]?.sha) || headSha;
    return { headSha, baseSha };
}

async function getTreePaths(octo: Octokit, owner: string, repo: string, ref: string): Promise<string[]> {
    const t = await octo.rest.git.getTree({ owner, repo, tree_sha: ref, recursive: 'true' as any });
    const files = (t.data.tree || [])
        .filter((e: any) => e.type === 'blob' && typeof e.path === 'string')
        .map((e: any) => e.path as string);
    return files;
}

async function readJsonAt<T = any>(octo: Octokit, owner: string, repo: string, ref: string, filePath: string): Promise<T | null> {
    try {
        const r = await octo.rest.repos.getContent({ owner, repo, path: filePath, ref });
        if (!Array.isArray(r.data) && 'content' in r.data) {
            const b64 = (r.data as any).content;
            const txt = Buffer.from(b64, 'base64').toString('utf8');
            return JSON.parse(txt);
        }
        return null;
    } catch (e: any) {
        if (e.status === 404) return null;
        throw e;
    }
}

async function openAIProposeSchema(input: {
    owner: string; repo: string; headSha: string; baseSha: string;
    detected: { frameworks: string[]; signals: any };
    paths: string[];
}) {
    // Very small, deterministic prompt for JSON-mode models
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const system = `You are a code analyzer that proposes analytics event schemas and minimal instrumentation code.
Return strict JSON.`;

    const user = {
        repo: `${input.owner}/${input.repo}`,
        head_sha: input.headSha,
        base_sha: input.baseSha,
        frameworks: input.detected.frameworks,
        signals: input.detected.signals,
        files_sample: input.paths.slice(0, 200), // avoid huge payloads
        requirement: {
            schema: [
                "page_view(required: page_url; optional: referrer, route, title)",
                "button_click(required: button_id; optional: surface, container_id, text)",
                "form_submit(required: form_id, success; optional: error_count)",
                "modal_open(required: modal_id; optional: source)",
                "modal_close(required: modal_id; optional: duration_ms)",
                "search_query(required: query; optional: results_count, source)"
            ],
            snippets: "Provide small files to add: src/aa/{fire.ts,adapter.ts,tracker.ts} and .analytics/{contract.json,adapter.map.json,README.md}"
        }
    };

    // we’ll call the API via fetch to keep deps minimal
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: JSON.stringify(user) }
            ],
            temperature: 0.2
        })
    });

    if (!res.ok) {
        const t = await res.text();
        throw new Error(`OpenAI call failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    let parsed: any = null;
    try { parsed = JSON.parse(content); } catch { parsed = null; }

    // Ensure shape: { frameworks, events[], snippets[], adapterMap? }
    if (!parsed || !Array.isArray(parsed?.events) || !Array.isArray(parsed?.snippets)) {
        // fallback: minimal bootstrap
        parsed = {
            frameworks: input.detected.frameworks,
            events: [
                { name: 'page_view', required: ['page_url'], optional: ['referrer', 'route', 'title'] },
                { name: 'button_click', required: ['button_id'], optional: ['surface', 'container_id', 'text'] }
            ],
            snippets: [],
            adapterMap: { routes: [], buttons: [], forms: [], modals: [], search: [] }
        };
    }
    return parsed;
}

async function writeEventSchema({
    repoId, commitSha, owner, actor, suggested
}: {
    repoId: string; commitSha: string; owner: string; actor: string | null;
    suggested: any;
}) {
    const row = {
        id: crypto.randomUUID(),
        source: 'github',
        repo_id: repoId,
        commit_sha: commitSha,
        actor: actor ?? owner,
        ts: new Date().toISOString(),
        verb: 'schema',
        metadata: { suggested }
    };
    const { error } = await SUPABASE.from('events').insert(row);
    if (error) throw new Error(error.message);
    return row.id;
}

async function writeEventAnalysis({
    repoId, commitSha, owner, actor, compareUrl, baseSha, headSha, analysis
}: {
    repoId: string; commitSha: string; owner: string; actor: string | null;
    compareUrl: string; baseSha: string; headSha: string; analysis: any;
}) {
    const row = {
        id: crypto.randomUUID(),
        source: 'github',
        repo_id: repoId,
        commit_sha: commitSha,
        actor: actor ?? owner,
        ts: new Date().toISOString(),
        verb: 'analysis',
        metadata: { compare: compareUrl, analysis, base_sha: baseSha, head_sha: headSha }
    };

    // Try insert; if duplicate, ignore and continue (idempotent)
    const { error } = await SUPABASE.from('events').insert(row);

    if (error) {
        // Postgres duplicate key = 23505; Supabase surfaces as message containing 'duplicate key'
        if (String(error.message || '').toLowerCase().includes('duplicate key')) {
            // already written for this repo_id+commit_sha+verb → not fatal
            return null;
        }
        throw new Error(error.message);
    }
    return row.id;
}


async function main() {
    const args = parseArgs();
    const full = String(args['full'] || '');
    const branch = String(args['branch'] || 'main');
    const doWrite = !!args['write'];
    const pathPrefix = (args['path'] as string | undefined)?.replace(/^\/+/, '');

    if (!full.includes('/')) throw new Error('Pass --full=<owner>/<repo>');

    const { owner, name, id: repoId, installation_id, default_branch } = await getRepoRow(full);
    const octo = makeInstallationOctokit(installation_id);

    // Resolve base/head
    const { headSha, baseSha } = await getHeadAndBase(octo, owner, name, branch || default_branch || 'main');
    const compareUrl = `https://github.com/${owner}/${name}/compare/${baseSha.slice(0, 7)}...${headSha.slice(0, 7)}`;

    // List tree at HEAD
    let allPaths = await getTreePaths(octo, owner, name, headSha);
    if (pathPrefix) allPaths = allPaths.filter(p => p.startsWith(pathPrefix + '/'));

    // Load package.json if present
    const pkg = await readJsonAt(octo, owner, name, headSha, 'package.json');

    // Detect frameworks/signals
    const detected = detectFrameworks(pkg, allPaths);
    const hasFrontendSignals =
        detected.frameworks.length > 0 ||
        detected.signals.hasSpaEntrypoint ||
        detected.signals.hasHtml;

    // Always write an 'analysis' row (like before)
    const analysis = {
        summary: hasFrontendSignals
            ? `Detected frontend signals (${detected.frameworks.join(', ') || 'signals only'})`
            : 'No clear frontend framework detected; may be backend or static HTML only.',
        risk: 'low',
        areas: hasFrontendSignals ? ['frontend'] : ['backend'],
        breaking_changes: false,
        tests_recommended: false,
        key_files: pkg ? ['package.json'] : (detected.signals.hasHtml ? ['index.html'] : [])
    };
    await writeEventAnalysis({
        repoId,
        commitSha: headSha,
        owner,
        actor: null,
        compareUrl,
        baseSha,
        headSha,
        analysis
    });

    // If no frontend signals → finish (keeps your original skip behavior)
    if (!hasFrontendSignals) {
        console.log(JSON.stringify({
            repo: full, base_sha: baseSha, head_sha: headSha, compare: compareUrl,
            analysis,
            detected
        }, null, 2));
        return;
    }

    // We have frontend → propose schema + snippets
    const suggested = await openAIProposeSchema({
        owner, repo: name, headSha, baseSha,
        detected, paths: allPaths
    });

    const out = {
        repo: full,
        base_sha: baseSha,
        head_sha: headSha,
        compare: compareUrl,
        detected,
        suggested
    };
    console.log(JSON.stringify(out, null, 2));

    if (doWrite) {
        const id = await writeEventSchema({
            repoId, commitSha: headSha, owner, actor: null, suggested
        });
        console.error(`Wrote schema event: ${id}`);
    } else {
        console.error(`(dry-run) not writing schema event; re-run with --write`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
