// File 1: packages/connector-service/src/lib/runtime-tracker-builder.ts
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface RuntimeTrackerSpec {
  appKey: string;
  apiEndpoint: string;
  events: Array<{
    name: string;
    required: string[];
    optional: string[];
  }>;
  routes: string[];
  frameworks: string[];
  domain: string;
}

export async function generateRuntimeTracker(spec: RuntimeTrackerSpec): Promise<{
  umdBundle: string;
  esmBundle: string;
  typeDefinitions: string;
}> {
  const trackerPrompt = `Generate UMD and ESM runtime tracker bundles for web analytics.

SPECIFICATION:
- App Key: ${spec.appKey}
- API Endpoint: ${spec.apiEndpoint}
- Domain: ${spec.domain}
- Frameworks: ${spec.frameworks.join(', ')}

EVENTS TO TRACK:
${spec.events.map(e => `- ${e.name}: required[${e.required.join(', ')}] optional[${e.optional.join(', ')}]`).join('\n')}

ROUTES:
${spec.routes.map(r => `- ${r}`).join('\n')}

Create both UMD and ESM bundles that:
1. Auto-track page views on route changes
2. Auto-track user interactions (clicks, forms)
3. Handle session/user management
4. Send events to ${spec.apiEndpoint}
5. Work without external dependencies
6. Include error handling and retry logic
7. Support both script tag injection and ES module import

Return JSON:
{
  "umd_bundle": "// Complete UMD bundle code",
  "esm_bundle": "// Complete ESM bundle code", 
  "type_definitions": "// TypeScript .d.ts content"
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Generate optimized, production-ready JavaScript bundles for analytics tracking."
      },
      {
        role: "user", 
        content: trackerPrompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 4000
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');
  
  return {
    umdBundle: result.umd_bundle || '',
    esmBundle: result.esm_bundle || '',
    typeDefinitions: result.type_definitions || ''
  };
}

export async function buildTrackerForApp(appKey: string): Promise<{
  umdPath: string;
  esmPath: string;
  typesPath: string;
}> {
  // Get app info
  const { data: app } = await supabase
    .from('apps')
    .select(`*, repos:repo_id (id, owner, name)`)
    .eq('app_key', appKey)
    .single();

  if (!app.data) {
    throw new Error(`App not found: ${appKey}`);
  }

  // Get latest schema
  const { data: schemaEvent } = await supabase
    .from('events')
    .select('metadata')
    .eq('repo_id', app.data.repo_id)
    .in('verb', ['schema', 'schema_override'])
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!schemaEvent?.metadata?.suggested?.events) {
    throw new Error('No schema found. Create schema first.');
  }

  const spec: RuntimeTrackerSpec = {
    appKey,
    apiEndpoint: '/ingest',
    domain: app.data.domain || 'localhost:3000',
    events: schemaEvent.metadata.suggested.events,
    routes: [],
    frameworks: schemaEvent.metadata.suggested.frameworks || ['nextjs']
  };

  // Generate bundles
  const tracker = await generateRuntimeTracker(spec);

  // Write to dist directory
  const outputDir = path.join(process.cwd(), 'dist', 'trackers');
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().slice(0, 10);
  const version = `${appKey}-${timestamp}`;
  
  const umdPath = path.join(outputDir, `tracker-${version}.umd.js`);
  const esmPath = path.join(outputDir, `tracker-${version}.esm.js`); 
  const typesPath = path.join(outputDir, `tracker-${version}.d.ts`);

  await Promise.all([
    fs.writeFile(umdPath, tracker.umdBundle, 'utf8'),
    fs.writeFile(esmPath, tracker.esmBundle, 'utf8'),
    fs.writeFile(typesPath, tracker.typeDefinitions, 'utf8')
  ]);

  // Log build event
  await supabase.from('events').insert({
    source: 'build_system',
    repo_id: app.data.repo_id,
    commit_sha: null,
    actor: 'runtime_builder',
    ts: new Date().toISOString(),
    verb: 'tracker_built',
    metadata: { app_key: appKey, version, files: { umdPath, esmPath, typesPath } },
    app_key: appKey
  });

  return { umdPath, esmPath, typesPath };
}

export function addRuntimeTrackerEndpoints(app: any) {
  // Build runtime tracker
  app.post('/tracker/build-runtime', async (req: any, reply: any) => {
    try {
      const { app_key } = req.body;
      if (!app_key) return reply.code(400).send({ error: 'app_key required' });

      const result = await buildTrackerForApp(app_key);
      return reply.send({ success: true, files: result, app_key });
    } catch (error: any) {
      return reply.code(500).send({ error: 'Build failed', message: error.message });
    }
  });

  // Serve tracker files
  app.get('/tracker/serve/:filename', async (req: any, reply: any) => {
    try {
      const { filename } = req.params;
      if (!filename.match(/^tracker-.*\.(umd|esm)\.js$|^tracker-.*\.d\.ts$/)) {
        return reply.code(404).send({ error: 'File not found' });
      }

      const trackerDir = path.join(process.cwd(), 'dist', 'trackers');
      const filePath = path.join(trackerDir, filename);
      const content = await fs.readFile(filePath, 'utf8');
      
      const contentType = filename.endsWith('.js') ? 'application/javascript' : 'text/plain';
      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=3600')
        .send(content);
    } catch (error: any) {
      return reply.code(404).send({ error: 'File not found' });
    }
  });

  // List builds
  app.get('/tracker/builds/:app_key', async (req: any, reply: any) => {
    try {
      const { app_key } = req.params;
      const { data: builds } = await supabase
        .from('events')
        .select('ts, metadata')
        .eq('verb', 'tracker_built')
        .eq('app_key', app_key)
        .order('ts', { ascending: false })
        .limit(10);

      return reply.send({
        success: true,
        app_key,
        builds: builds?.map(b => ({
          built_at: b.ts,
          version: b.metadata?.version,
          files: b.metadata?.files
        })) || []
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'Failed to list builds', message: error.message });
    }
  });
}