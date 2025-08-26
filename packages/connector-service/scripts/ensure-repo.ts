// scripts/ensure-repo.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

type Args = {
  provider: 'github';
  full: string;                 // e.g. "acme/widgets"
  installation?: string | null; // e.g. "82565801"
  defaultBranch?: string | null;// e.g. "main"
  projectId?: string | null;    // optional uuid
};

function parseArgv(): Args {
  const m = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.replace(/^--/, '').split('=');
      if (v !== undefined) m.set(k, v);
      else if (i + 1 < process.argv.length && !process.argv[i + 1].startsWith('--')) {
        m.set(k, process.argv[++i]);
      } else {
        m.set(k, 'true');
      }
    }
  }
  const full = m.get('full');
  const provider = (m.get('provider') || 'github') as 'github';
  if (!full || !full.includes('/')) {
    console.error('Usage: tsx scripts/ensure-repo.ts --provider github --full owner/name [--installation 82565801] [--default-branch main] [--project-id <uuid>]');
    process.exit(1);
  }
  return {
    provider,
    full,
    installation: m.get('installation') ?? null,
    defaultBranch: m.get('default-branch') ?? null,
    projectId: m.get('project-id') ?? null,
  };
}

function splitFullName(full: string) {
  const [owner, name] = full.split('/');
  return { owner, name };
}

async function main() {
  const args = parseArgv();
  const { owner, name } = splitFullName(args.full);

  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Try to find existing by unique natural key (provider, owner, name)
  const existing = await supabase
    .from('repos')
    .select('*')
    .eq('provider', args.provider)
    .eq('owner', owner)
    .eq('name', name)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    console.error('Select error:', existing.error.message);
    process.exit(1);
  }

  if (existing.data) {
    // Update mutable fields if provided
    const update: Record<string, any> = {};
    if (args.defaultBranch !== null) update.default_branch = args.defaultBranch;
    if (args.installation !== null) update.installation_id = args.installation;
    if (args.projectId !== null) update.project_id = args.projectId;

    if (Object.keys(update).length > 0) {
      const upd = await supabase.from('repos').update(update).eq('id', existing.data.id).select().single();
      if (upd.error) {
        console.error('Update error:', upd.error.message);
        process.exit(1);
      }
      console.log(JSON.stringify({ action: 'updated', repo: upd.data }, null, 2));
    } else {
      console.log(JSON.stringify({ action: 'found', repo: existing.data }, null, 2));
    }
    return;
  }

  // Insert new (id is uuid in your schema, so we generate)
  const id = crypto.randomUUID();
  const ins = await supabase
  .from('repos')
  .insert({
    id,
    provider: args.provider,
    owner,
    name,
    default_branch: args.defaultBranch ?? "main",   // 👈 default instead of null
    installation_id: args.installation ?? null,
    project_id: args.projectId ?? null,
  })
  .select()
  .single();


  if (ins.error) {
    console.error('Insert error:', ins.error.message);
    process.exit(1);
  }
  console.log(JSON.stringify({ action: 'inserted', repo: ins.data }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

