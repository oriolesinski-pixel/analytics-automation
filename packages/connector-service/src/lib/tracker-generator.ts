// packages/connector-service/src/lib/tracker-generator.ts
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { detectFrameworks, type Detected } from './detectFrameworks';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Base directory for saving generated files
const GENERATED_OUTPUTS_DIR = '/Users/oriolesinski/analytics-automation/packages/connector-service/src/utils/generated-outputs/parsed-results';

interface TrackerGenerationInput {
  repoId: string;
  appKey: string;
  frameworks: string[];
  routes: string[];
  schema: {
    events: Array<{
      name: string;
      required: string[];
      optional: string[];
    }>;
  };
  graph?: {
    nodes: Array<{ id: string; pattern: string; }>;
    edges: Array<{ from: string; to: string; }>;
  };
  domain?: string;
  generateRuntime?: boolean;
  frameworkDetection?: Detected;
  allPaths?: string[];
  packageJson?: any;
}

// Create production-ready bundles
function createProductionBundles(
  jsCode: string,
  appKey: string,
  domain: string
): {
  tracker_js: string;
  analytics_component: string;
  type_definitions: string;
  integration_guide: string;
} {
  // Ensure domain has protocol
  const fullDomain = domain.startsWith('http') ? domain : `http://${domain}`;

  // Wrap in UMD for browser use
  const tracker_js = `(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Analytics = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  ${jsCode}
  
  // Auto-initialize
  if (typeof window !== 'undefined' && !window.analytics) {
    var tracker = new AnalyticsTracker();
    window.analytics = tracker;
    
    // Auto-track page loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        tracker.trackPageView();
      });
    } else {
      tracker.trackPageView();
    }
  }
  
  return AnalyticsTracker;
}));`;

  const analytics_component = `'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    analytics?: {
      trackPageView(page?: string): void;
      trackEvent(eventName: string, properties?: any): void;
      identify(userId: string, traits?: any): void;
      flush(): void;
    };
  }
}

export default function Analytics() {
  const pathname = usePathname();
  
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/tracker.js';
    script.async = true;
    document.body.appendChild(script);
    
    script.onload = () => {
      if (window.analytics) {
        console.log('Analytics tracker initialized');
        window.analytics.trackPageView();
      }
    };
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);
  
  useEffect(() => {
    if (window.analytics) {
      window.analytics.trackPageView(pathname);
    }
  }, [pathname]);
  
  return null;
}`;

  const type_definitions = `interface Window {
  analytics?: {
    trackPageView(page?: string): void;
    trackEvent(eventName: string, properties?: any): void;
    identify(userId: string, traits?: any): void;
    flush(): void;
  };
}`;

  const integration_guide = `# Quick Integration

## Files to copy:
- \`tracker.js\` → \`public/tracker.js\`
- \`Analytics.tsx\` → \`components/Analytics.tsx\`

## Add to layout.tsx:
\`\`\`tsx
import Analytics from '@/components/Analytics';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
\`\`\`

## Test:
Open console for "Analytics tracker initialized"

## Track custom events:
\`\`\`javascript
window.analytics.trackEvent('button_click', {
  button: 'cta',
  page: 'homepage'
});
\`\`\``;

  return {
    tracker_js,
    analytics_component,
    type_definitions,
    integration_guide
  };
}

// Save files
async function saveFilesToLocal(
  files: Array<{ path: string; content: string; description: string; type?: string; }>,
  repoId: string,
  repoName: string = 'unknown-repo'
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(GENERATED_OUTPUTS_DIR, repoId, timestamp);
  const readyPath = path.join(outputPath, 'ready-to-deploy');

  await fs.mkdir(readyPath, { recursive: true });
  console.log(`💾 Saving files to: ${outputPath}`);

  for (const file of files) {
    const targetPath = file.path.startsWith('ready-to-deploy/') ? readyPath : outputPath;
    const fileName = path.basename(file.path);
    const filePath = path.join(targetPath, fileName);

    await fs.writeFile(filePath, file.content, 'utf8');
    console.log(`   ✅ Saved: ${fileName}`);
  }

  const metadata = {
    generated_at: timestamp,
    repo_id: repoId,
    repo_name: repoName,
    ready_to_deploy: readyPath,
    integration_steps: [
      `1. Copy ${readyPath}/tracker.js to public/tracker.js`,
      `2. Copy ${readyPath}/Analytics.tsx to components/Analytics.tsx`,
      `3. Add <Analytics /> to your layout.tsx`,
      `4. Test in browser console`
    ]
  };

  await fs.writeFile(
    path.join(outputPath, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log(`📁 Ready to deploy: ${readyPath}`);
  return outputPath;
}

// Enhanced JavaScript prompt with all requirements
function createJavaScriptPrompt(input: TrackerGenerationInput): string {
  const fullDomain = input.domain?.startsWith('http') ? input.domain : `http://${input.domain || 'localhost:3000'}`;

  return `Generate a browser-compatible JavaScript analytics tracker class.

CRITICAL REQUIREMENTS:
- Pure JavaScript (ES6 classes OK, but NO TypeScript)
- Class named AnalyticsTracker
- No constructor parameters
- Config as property: this.config = { appKey: '${input.appKey}', endpoint: '${fullDomain}/ingest/app', batchSize: 10, flushInterval: 30000, maxRetries: 3 }

METHODS REQUIRED:
- trackPageView(page) - tracks page views with url, path, title, referrer
- trackEvent(name, props) - tracks custom events
- identify(userId, traits) - identifies users
- flush() - sends queued events

DATA TO INCLUDE IN EVERY EVENT:
- timestamp: new Date().toISOString()
- session_id: unique session ID stored in localStorage (try/catch for private browsing)
- user_agent: navigator.userAgent
- page_url: current URL
- page_title: document.title
- referrer: document.referrer
- viewport_width: window.innerWidth
- viewport_height: window.innerHeight

FEATURES:
- Session management with localStorage (generate UUID, handle private browsing)
- Event batching (send when batch size reached OR after flushInterval ms)
- Retry logic with exponential backoff BUT limit to maxRetries (3)
- Check typeof window !== 'undefined' for browser safety
- IMPORTANT: When sending events, body must be JSON.stringify({ app_key: this.config.appKey, events: batch })

Return ONLY JavaScript code, no markdown, no comments about the code.`;
}

// Complete fallback JavaScript with all features
function createFallbackTracker(appKey: string, domain: string): string {
  const fullDomain = domain.startsWith('http') ? domain : `http://${domain}`;

  return `class AnalyticsTracker {
  constructor() {
    this.config = {
      appKey: '${appKey}',
      endpoint: '${fullDomain}/ingest/app',
      batchSize: 10,
      flushInterval: 30000,
      maxRetries: 3
    };
    
    this.eventQueue = [];
    this.isSending = false;
    this.sessionId = null;
    this.retryCount = 0;
    this.flushTimer = null;
    
    if (typeof window !== 'undefined') {
      this.initSession();
      this.setupListeners();
      this.startFlushTimer();
    }
  }

  initSession() {
    try {
      this.sessionId = sessionStorage.getItem('analytics_session_id');
      if (!this.sessionId) {
        this.sessionId = this.generateUUID();
        sessionStorage.setItem('analytics_session_id', this.sessionId);
      }
    } catch (e) {
      // Private browsing or storage disabled
      this.sessionId = this.generateUUID();
    }
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  setupListeners() {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }

  startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.sendEvents();
      }
    }, this.config.flushInterval);
  }

  getPageMetadata() {
    if (typeof window === 'undefined') return {};
    
    return {
      page_url: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      screen_width: window.screen.width,
      screen_height: window.screen.height
    };
  }

  trackPageView(page) {
    if (typeof window === 'undefined') return;
    
    const pageData = this.getPageMetadata();
    pageData.page_url = page || pageData.page_url;
    
    this.trackEvent('page_view', pageData);
  }

  trackEvent(eventName, properties) {
    const eventData = {
      event: eventName,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      properties: properties || {},
      metadata: this.getPageMetadata()
    };

    this.eventQueue.push(eventData);

    if (this.eventQueue.length >= this.config.batchSize) {
      this.sendEvents();
    }
  }

  identify(userId, traits) {
    this.trackEvent('identify', {
      user_id: userId,
      traits: traits || {}
    });
  }

  flush() {
    if (this.eventQueue.length > 0) {
      this.sendEvents();
    }
  }

  async sendEvents() {
    if (this.isSending || this.eventQueue.length === 0) return;

    this.isSending = true;
    const batch = this.eventQueue.splice(0, this.config.batchSize);

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          app_key: this.config.appKey,
          events: batch 
        }),
        keepalive: true
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      this.retryCount = 0;
      console.log('Analytics: sent ' + batch.length + ' events');

    } catch (error) {
      console.error('Analytics error:', error);
      
      if (this.retryCount < this.config.maxRetries) {
        // Put events back and retry
        this.eventQueue.unshift(...batch);
        this.retryCount++;
        
        // Exponential backoff with max delay of 30 seconds
        const delay = Math.min(Math.pow(2, this.retryCount) * 1000, 30000);
        
        setTimeout(() => {
          this.isSending = false;
          this.sendEvents();
        }, delay);
        
        return; // Exit early to prevent resetting isSending
      } else {
        // Max retries reached, drop the events
        console.error('Analytics: dropped ' + batch.length + ' events after ' + this.config.maxRetries + ' retries');
        this.retryCount = 0;
      }
    }
    
    this.isSending = false;
  }
}`;
}

// Main generation function
export async function generateTrackerImplementation(input: TrackerGenerationInput): Promise<{
  implementation: string;
  deployment_plan: string;
  integration_guide: string;
  files: Array<{ path: string; content: string; description: string; type?: string; }>;
  runtime_bundles?: {
    umd_bundle: string;
    esm_bundle: string;
    type_definitions: string;
    cdn_snippet?: string;
  };
  savedPath?: string;
}> {
  const domain = input.domain || 'localhost:3000';
  const files = [];
  let jsCode: string;

  try {
    console.log('🤖 Requesting JavaScript from Claude...');

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      temperature: 0.1,
      system: `You are a JavaScript expert. Generate pure JavaScript code only. No TypeScript. 
Include session management, page metadata, and timestamps in all events. 
The request body must include app_key when sending events.
Limit retries to prevent infinite loops.`,
      messages: [{
        role: "user",
        content: createJavaScriptPrompt(input)
      }]
    });

    if (response.content[0].type === 'text') {
      jsCode = response.content[0].text;
      // Clean any markdown if Claude added it
      jsCode = jsCode.replace(/```(?:javascript|js)?\n?/g, '').replace(/```\n?/g, '').trim();
      console.log('✅ JavaScript generated successfully');
    } else {
      throw new Error('No text response from Claude');
    }
  } catch (error: any) {
    console.error('❌ Claude API error:', error?.message);
    console.log('🔄 Using fallback JavaScript');
    jsCode = createFallbackTracker(input.appKey, domain);
  }

  // Create production bundles
  const bundles = createProductionBundles(jsCode, input.appKey, domain);

  // Ready-to-deploy files
  files.push({
    path: 'ready-to-deploy/tracker.js',
    type: "production",
    content: bundles.tracker_js,
    description: "Copy to public/tracker.js"
  });

  files.push({
    path: 'ready-to-deploy/Analytics.tsx',
    type: "component",
    content: bundles.analytics_component,
    description: "Copy to components/Analytics.tsx"
  });

  files.push({
    path: 'ready-to-deploy/window.d.ts',
    type: "types",
    content: bundles.type_definitions,
    description: "Copy to types/window.d.ts (optional)"
  });

  files.push({
    path: 'ready-to-deploy/README.md',
    type: "docs",
    content: bundles.integration_guide,
    description: "Integration instructions"
  });

  // Save files
  const savedPath = await saveFilesToLocal(files, input.repoId, input.appKey);

  return {
    implementation: jsCode,
    deployment_plan: `Files ready in: ${savedPath}/ready-to-deploy/`,
    integration_guide: bundles.integration_guide,
    files: files,
    runtime_bundles: {
      umd_bundle: bundles.tracker_js,
      esm_bundle: jsCode,
      type_definitions: bundles.type_definitions,
      cdn_snippet: `<script src="/tracker.js"></script>`
    },
    savedPath: savedPath
  };
}

// Keep all your existing functions below unchanged
export async function generateTrackerForCompletedAnalysis(runId: string, options: { generateRuntime?: boolean } = {}): Promise<void> {
  console.log('🚀 Starting tracker generation for run:', runId);

  const { data: run, error: runError } = await supabase
    .from('analyzer_runs')
    .select('*')
    .eq('id', runId)
    .eq('status', 'completed')
    .single();

  if (runError || !run) {
    throw new Error('Analyzer run not found or not completed');
  }

  const { data: repo, error: repoError } = await supabase
    .from('repos')
    .select('*')
    .eq('id', run.repo_id)
    .single();

  if (repoError || !repo) {
    throw new Error('Repository not found');
  }

  const { data: app } = await supabase
    .from('apps')
    .select('*')
    .eq('repo_id', run.repo_id)
    .maybeSingle();

  const { data: schemaEvent } = await supabase
    .from('events')
    .select('metadata')
    .eq('repo_id', run.repo_id)
    .eq('verb', 'schema')
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!schemaEvent?.metadata?.suggested?.events) {
    console.log('No schema available for tracker generation');
    return;
  }

  let frameworkDetection: Detected | undefined;
  let allPaths: string[] = [];
  let packageJson: any = null;

  if (run.summary?.files) {
    allPaths = run.summary.files.map((f: any) => f.path || f.name);
  }

  if (run.summary?.package_json) {
    packageJson = run.summary.package_json;
  }

  if (allPaths.length > 0) {
    frameworkDetection = detectFrameworks(packageJson, allPaths);
    console.log('🔧 Framework detection:', frameworkDetection);
  }

  const frameworks = frameworkDetection?.frameworks || run.summary?.schema?.frameworks || [];
  const routes = run.summary?.routes_sample || [];
  const appKey = app?.app_key || `${repo.owner}-${repo.name}`;
  const domain = app?.domain || 'localhost:3000';

  const trackerInput: TrackerGenerationInput = {
    repoId: run.repo_id,
    appKey,
    frameworks,
    routes,
    schema: schemaEvent.metadata.suggested,
    domain,
    generateRuntime: options.generateRuntime !== false,
    frameworkDetection,
    allPaths,
    packageJson
  };

  const trackerResult = await generateTrackerImplementation(trackerInput);

  await supabase.from('events').insert({
    source: 'ai',
    repo_id: run.repo_id,
    commit_sha: run.commit_sha,
    actor: 'claude_tracker_generator_v2',
    ts: new Date().toISOString(),
    verb: 'tracker_implementation',
    metadata: {
      app_key: appKey,
      frameworks,
      enhanced_framework_detection: frameworkDetection,
      implementation: trackerResult.implementation,
      deployment_plan: trackerResult.deployment_plan,
      integration_guide: trackerResult.integration_guide,
      files: trackerResult.files,
      runtime_bundles: trackerResult.runtime_bundles,
      generated_at: new Date().toISOString(),
      generator: 'claude-javascript',
      saved_path: trackerResult.savedPath
    }
  });

  console.log(`✅ Generated tracker for ${repo.owner}/${repo.name}`);
  console.log(`📁 Ready at: ${trackerResult.savedPath}/ready-to-deploy/`);
}

export async function createTrackerEndpoint(app: any) {
  app.post('/tracker/generate-from-analysis', async (req: any, reply: any) => {
    try {
      const { repo_id, app_key, generate_runtime } = req.body;

      if (!repo_id) {
        return reply.code(400).send({ error: 'repo_id required' });
      }

      console.log('📨 Tracker generation request for repo:', repo_id);

      const { data: latestRun } = await supabase
        .from('analyzer_runs')
        .select('*')
        .eq('repo_id', repo_id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestRun) {
        return reply.code(404).send({ error: 'No completed analysis found' });
      }

      await generateTrackerForCompletedAnalysis(latestRun.id, {
        generateRuntime: generate_runtime !== false
      });

      const { data: trackerEvent } = await supabase
        .from('events')
        .select('metadata')
        .eq('repo_id', repo_id)
        .eq('verb', 'tracker_implementation')
        .order('ts', { ascending: false })
        .limit(1)
        .single();

      return reply.send({
        success: true,
        tracker: trackerEvent?.metadata || null,
        files: trackerEvent?.metadata?.files || [],
        runtime_bundles: trackerEvent?.metadata?.runtime_bundles || null,
        saved_path: trackerEvent?.metadata?.saved_path,
        ready_to_deploy: `${trackerEvent?.metadata?.saved_path}/ready-to-deploy/`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error:', errorMessage);
      return reply.code(500).send({
        error: 'Failed to generate tracker',
        message: errorMessage
      });
    }
  });

  app.get('/tracker/latest/:repo_id', async (req: any, reply: any) => {
    try {
      const { repo_id } = req.params;

      const { data: trackerEvent, error } = await supabase
        .from('events')
        .select('metadata, ts')
        .eq('repo_id', repo_id)
        .eq('verb', 'tracker_implementation')
        .order('ts', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !trackerEvent) {
        return reply.code(404).send({ error: 'No tracker found' });
      }

      return reply.send({
        success: true,
        generated_at: trackerEvent.ts,
        files: trackerEvent.metadata?.files || [],
        runtime_bundles: trackerEvent.metadata?.runtime_bundles || null,
        saved_path: trackerEvent.metadata?.saved_path,
        ready_to_deploy: `${trackerEvent.metadata?.saved_path}/ready-to-deploy/`,
        ...trackerEvent.metadata
      });

    } catch (error) {
      return reply.code(500).send({ error: 'Failed to get tracker' });
    }
  });

  app.get('/tracker/file/:repo_id/*', async (req: any, reply: any) => {
    try {
      const { repo_id } = req.params;
      const file_path = req.params['*'];

      const { data: trackerEvent } = await supabase
        .from('events')
        .select('metadata')
        .eq('repo_id', repo_id)
        .eq('verb', 'tracker_implementation')
        .order('ts', { ascending: false })
        .limit(1)
        .maybeSingle();

      const files = trackerEvent?.metadata?.files || [];
      const requestedFile = files.find((f: any) => f.path === file_path);

      if (!requestedFile) {
        return reply.code(404).send({ error: 'File not found' });
      }

      return reply.send({ success: true, file: requestedFile });

    } catch (error) {
      return reply.code(500).send({ error: 'Failed to get file' });
    }
  });
}