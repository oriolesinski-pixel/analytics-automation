// packages/connector-service/src/lib/analytics-intelligence-generator.ts
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

// Base directory for outputs
const OUTPUTS_DIR = '/Users/oriolesinski/analytics-automation/packages/connector-service/src/utils/generated-outputs';

// Required fields that MUST be in every event
const REQUIRED_FIELDS = ['app_key', 'session_id', 'user_id', 'ts'] as const;

interface EventSchema {
    name: string;
    required: string[];
    optional: string[];
    properties?: Record<string, any>;
    possible_values?: Record<string, string[]>;
}

interface FileContent {
    path: string;
    content: string;
}

interface GeneratorInput {
    repoId: string;
    appKey: string;
    domain?: string;
    backendUrl?: string;
    frameworks?: string[];
    files?: FileContent[];
    routes?: string[];
    businessContext?: {
        type?: string;
        key_entities?: string[];
        key_actions?: string[];
    };
    sample_routes?: string[];
}

interface GeneratorOutput {
    'tracker.js': string;
    'events-schema.json': any;
    'ui-graph.json': any;
    'analytics-provider.tsx': string;
    'analytics.types.ts': string;
    'integration-guide.md': string;
    metadata: {
        generatedAt: string;
        appKey: string;
        eventCount: number;
        frameworksDetected: string[];
    };
}

interface SchemaWithGraph {
    events: EventSchema[];
    uiGraph: any;
}

export class AnalyticsIntelligenceGenerator {
    private anthropic: Anthropic;
    private supabase: any;

    constructor() {
        this.anthropic = anthropic;
        this.supabase = supabase;
    }

    /**
     * Generate the complete analytics implementation
     */
    async generate(input: GeneratorInput): Promise<GeneratorOutput> {
        console.log('🔍 Starting generation for:', input.appKey);

        // Step 1: Load actual repository files
        const repoFiles = await this.loadRepositoryFiles(input.repoId);
        if (repoFiles.length > 0) {
            console.log(`📁 Loaded ${repoFiles.length} files from repository`);
            input.files = repoFiles;
        }

        // Step 2: Extract routes from file system
        const extractedRoutes = this.extractRoutesFromFiles(repoFiles);
        if (extractedRoutes.length > 0) {
            console.log(`🛣️ Found routes:`, extractedRoutes);
            input.routes = extractedRoutes;
        }

        // Step 3: Generate schema based on actual code content
        const schemaResult = await this.generateSchemaFromCode(input);
        const events = schemaResult.events;
        const uiGraph = schemaResult.uiGraph;

        // Step 4: Ensure required fields in all events
        const eventsWithRequiredFields = this.ensureRequiredFields(events);

        // Step 5: Generate implementation components
        const output = await this.generateImplementation(input, eventsWithRequiredFields, uiGraph);

        // Step 6: Save to disk
        await this.saveOutput(output, input.repoId, input.appKey);

        return output;
    }

    /**
     * Load actual files from the repository
     */
    public async loadRepositoryFiles(repoId: string): Promise<FileContent[]> {
        const files: FileContent[] = [];

        try {
            // Get repository information from database
            const { data: repo } = await this.supabase
                .from('repos')
                .select('owner, name')
                .eq('id', repoId)
                .single();

            if (!repo) {
                console.log('❌ Repository not found in database');
                return files;
            }

            // Try to load files from GitHub via API or local clone
            const repoPath = await this.getRepositoryPath(repo.owner, repo.name);
            if (repoPath) {
                // Read all relevant files
                const relevantFiles = await this.findRelevantFiles(repoPath);

                for (const filePath of relevantFiles) {
                    try {
                        const content = await fs.readFile(filePath, 'utf-8');
                        const relativePath = path.relative(repoPath, filePath);
                        files.push({ path: relativePath, content });
                    } catch (error) {
                        console.error(`Failed to read file ${filePath}:`, error);
                    }
                }
            }

            // If no files found locally, try to get from analyzer_runs
            if (files.length === 0) {
                const { data: run } = await this.supabase
                    .from('analyzer_runs')
                    .select('summary')
                    .eq('repo_id', repoId)
                    .eq('status', 'completed')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (run?.summary?.files) {
                    files.push(...run.summary.files);
                }
            }
        } catch (error) {
            console.error('Error loading repository files:', error);
        }

        return files;
    }

    /**
     * Get repository path (local clone or workspace)
     */
    private async getRepositoryPath(owner: string, name: string): Promise<string | null> {
        // Add your actual path FIRST
        const possiblePaths = [
            `/Users/oriolesinski/analytics-automation/examples/${name}`, // ADD THIS
            `/Users/oriolesinski/analytics-automation/examples/demo-next`, // ADD THIS SPECIFIC ONE
            `/tmp/${name}`,
            `/tmp/${owner}-${name}`,
            `/Users/oriolesinski/repos/${name}`,
            `/workspace/${name}`
        ];

        for (const repoPath of possiblePaths) {
            try {
                const stat = await fs.stat(repoPath);
                if (stat.isDirectory()) {
                    console.log(`✅ Found repository at: ${repoPath}`);
                    return repoPath;
                }
            } catch {
                // Path doesn't exist, try next
            }
        }

        console.log(`❌ Repository not found in any of these paths:`, possiblePaths);
        return null;
    }

    /**
     * Find all relevant files for analysis
     */
    private async findRelevantFiles(repoPath: string): Promise<string[]> {
        const files: string[] = [];
        const extensions = ['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte'];
        const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'out'];

        async function scanDir(dir: string) {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    if (!ignoreDirs.includes(entry.name)) {
                        await scanDir(fullPath);
                    }
                } else if (entry.isFile()) {
                    if (extensions.some(ext => entry.name.endsWith(ext))) {
                        files.push(fullPath);
                    }
                }
            }
        }

        await scanDir(repoPath);
        return files.slice(0, 50); // Limit to 50 files to avoid token limits
    }

    /**
     * Extract routes from file system structure
     */
    private extractRoutesFromFiles(files: FileContent[]): string[] {
        const routes = new Set<string>();
        routes.add('/'); // Always include home

        for (const file of files) {
            // Next.js App Router
            if (file.path.includes('app/') && file.path.endsWith('page.tsx')) {
                const route = '/' + file.path
                    .replace(/^.*?app\//, '')
                    .replace(/\/page\.(tsx|jsx|js)$/, '')
                    .replace(/\[.*?\]/g, ':param');
                routes.add(route === '/' ? '/' : route);
            }

            // Next.js Pages Router
            if (file.path.includes('pages/') && !file.path.includes('_')) {
                const route = '/' + file.path
                    .replace(/^.*?pages\//, '')
                    .replace(/\.(tsx|jsx|js)$/, '')
                    .replace(/index$/, '')
                    .replace(/\[.*?\]/g, ':param');
                routes.add(route || '/');
            }
        }

        return Array.from(routes);
    }

    /**
     * Generate schema by analyzing actual code content
     */
    private async generateSchemaFromCode(input: GeneratorInput): Promise<SchemaWithGraph> {
        if (!input.files || input.files.length === 0) {
            console.log('⚠️ No files to analyze, using contextual defaults');
            return this.getDefaultContextualSchema(input);
        }

        // Prepare code content for LLM analysis
        const codeContent = input.files.slice(0, 20).map(f =>
            `=== File: ${f.path} ===\n${f.content.slice(0, 2000)}\n`
        ).join('\n');

        const systemPrompt = `You are an expert analytics architect analyzing actual application code.
Your task is to generate a PRECISE analytics schema based on the ACTUAL UI elements, routes, and interactions found in the code.

CRITICAL REQUIREMENTS:
1. Every event MUST include these required fields: app_key, session_id, user_id, ts
2. Extract ACTUAL text content, URLs, and component names from the code
3. possible_values MUST contain the EXACT strings found in the code (button text, link hrefs, page titles)
4. Events should be specific to what the application actually does
5. DO NOT make up generic values - use what's actually in the code`;

        const userPrompt = `Analyze this application code and generate a contextual analytics schema:

Application: ${input.appKey}
Routes found: ${JSON.stringify(input.routes || ['/'])}
Frameworks: ${JSON.stringify(input.frameworks || [])}

CODE CONTENT:
${codeContent}

Based on the ACTUAL code above, generate a schema with:
1. Events that match the actual UI interactions (buttons, links, forms) found in the code
2. possible_values containing the EXACT text and URLs from the code
3. UI graph showing the real navigation structure

Return ONLY a JSON object with this structure:
{
  "events": [
    {
      "name": "page_view",
      "required": ["app_key", "session_id", "user_id", "ts", "page_url"],
      "optional": ["page_title", "referrer"],
      "properties": { "page_url": "string", "page_title": "string" },
      "possible_values": {
        "page_url": [/* actual routes from code */],
        "page_title": [/* actual titles from code */]
      }
    },
    {
      "name": "button_click",
      "required": ["app_key", "session_id", "user_id", "ts", "button_text", "button_href"],
      "optional": ["button_location"],
      "properties": { "button_text": "string", "button_href": "string" },
      "possible_values": {
        "button_text": [/* EXACT button text from code */],
        "button_href": [/* EXACT hrefs from code */]
      }
    }
  ],
  "uiGraph": {
    "app_key": "${input.appKey}",
    "relationships": [/* based on actual navigation in code */],
    "pages": {/* based on actual routes */}
  }
}`;

        try {
            console.log('🤖 Sending code to LLM for analysis...');
            const response = await this.anthropic.messages.create({
                model: "claude-3-opus-20240229", 
                max_tokens: 8000,
                temperature: 0.1,
                system: systemPrompt,
                messages: [{
                    role: "user",
                    content: userPrompt
                }]
            });

            const content = response.content[0].type === 'text' ? response.content[0].text : '';

            // Extract JSON from response
            let parsed;
            const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[1]);
            } else {
                // Try to parse the entire content as JSON
                const jsonStart = content.indexOf('{');
                const jsonEnd = content.lastIndexOf('}') + 1;
                if (jsonStart >= 0 && jsonEnd > jsonStart) {
                    parsed = JSON.parse(content.slice(jsonStart, jsonEnd));
                } else {
                    throw new Error('No valid JSON found in response');
                }
            }

            console.log('✅ Successfully analyzed code and generated schema');
            return {
                events: parsed.events || [],
                uiGraph: parsed.uiGraph || this.generateDefaultUIGraph(input, parsed.events)
            };

        } catch (error) {
            console.error('❌ LLM analysis failed:', error);
            return this.getDefaultContextualSchema(input);
        }
    }

    /**
     * Get default contextual schema when code analysis fails
     */
    private getDefaultContextualSchema(input: GeneratorInput): SchemaWithGraph {
        // Check if it's demo-next based on app key
        if (input.appKey.includes('demo-next')) {
            return this.getDemoNextSchema(input);
        }

        // Return minimal schema
        return {
            events: [
                {
                    name: 'page_view',
                    required: ['app_key', 'session_id', 'user_id', 'ts', 'page_url'],
                    optional: ['page_title', 'referrer'],
                    properties: {
                        page_url: 'string',
                        page_title: 'string',
                        referrer: 'string'
                    },
                    possible_values: {
                        page_url: input.routes || ['/'],
                        page_title: ['Home']
                    }
                },
                {
                    name: 'interaction',
                    required: ['app_key', 'session_id', 'user_id', 'ts', 'element_type', 'action'],
                    optional: ['element_text'],
                    properties: {
                        element_type: 'string',
                        action: 'string',
                        element_text: 'string'
                    },
                    possible_values: {
                        element_type: ['button', 'link', 'form'],
                        action: ['click', 'submit', 'hover']
                    }
                }
            ],
            uiGraph: this.generateDefaultUIGraph(input, [])
        };
    }

    /**
     * Get demo-next specific schema with actual content
     */
    private getDemoNextSchema(input: GeneratorInput): SchemaWithGraph {
        return {
            events: [
                {
                    name: 'page_view',
                    required: ['app_key', 'session_id', 'user_id', 'ts', 'page_url'],
                    optional: ['page_title', 'referrer', 'viewport_width'],
                    properties: {
                        page_url: 'string',
                        page_title: 'string',
                        referrer: 'string',
                        viewport_width: 'number'
                    },
                    possible_values: {
                        page_url: ['/', '/pricing'],
                        page_title: ['Create Next App', 'Pricing']
                    }
                },
                {
                    name: 'button_click',
                    required: ['app_key', 'session_id', 'user_id', 'ts', 'button_text', 'button_href'],
                    optional: ['button_type'],
                    properties: {
                        button_text: 'string',
                        button_href: 'string',
                        button_type: 'string'
                    },
                    possible_values: {
                        button_text: ['Deploy now', 'Read our docs'],
                        button_href: [
                            'https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app',
                            'https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
                        ],
                        button_type: ['primary', 'secondary']
                    }
                },
                {
                    name: 'footer_link_click',
                    required: ['app_key', 'session_id', 'user_id', 'ts', 'link_text', 'link_href'],
                    optional: ['icon_type'],
                    properties: {
                        link_text: 'string',
                        link_href: 'string',
                        icon_type: 'string'
                    },
                    possible_values: {
                        link_text: ['Learn', 'Examples', 'Go to nextjs.org →'],
                        link_href: [
                            'https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app',
                            'https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app',
                            'https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
                        ],
                        icon_type: ['file', 'window', 'globe']
                    }
                },
                {
                    name: 'code_snippet_interaction',
                    required: ['app_key', 'session_id', 'user_id', 'ts', 'action'],
                    optional: ['code_text'],
                    properties: {
                        action: 'string',
                        code_text: 'string'
                    },
                    possible_values: {
                        action: ['view', 'hover', 'copy'],
                        code_text: ['src/app/page.tsx']
                    }
                }
            ],
            uiGraph: {
                app_key: input.appKey,
                relationships: [
                    {
                        from: 'home',
                        to: 'external_vercel_deploy',
                        trigger: 'button_click',
                        element: 'deploy_now_button'
                    },
                    {
                        from: 'home',
                        to: 'external_nextjs_docs',
                        trigger: 'button_click',
                        element: 'read_docs_button'
                    },
                    {
                        from: 'home',
                        to: 'external_nextjs_learn',
                        trigger: 'footer_link_click',
                        element: 'learn_link'
                    },
                    {
                        from: 'home',
                        to: 'external_vercel_templates',
                        trigger: 'footer_link_click',
                        element: 'examples_link'
                    },
                    {
                        from: 'home',
                        to: 'external_nextjs_home',
                        trigger: 'footer_link_click',
                        element: 'nextjs_link'
                    }
                ],
                pages: {
                    home: {
                        route: '/',
                        components: [
                            'next_logo',
                            'vercel_logo',
                            'instruction_list',
                            'deploy_button',
                            'docs_button',
                            'footer_links'
                        ],
                        can_navigate_to: [
                            'pricing',
                            'external_vercel_deploy',
                            'external_nextjs_docs',
                            'external_nextjs_learn',
                            'external_vercel_templates',
                            'external_nextjs_home'
                        ],
                        events: ['page_view', 'button_click', 'footer_link_click', 'code_snippet_interaction']
                    },
                    pricing: {
                        route: '/pricing',
                        components: [],
                        can_navigate_to: ['home'],
                        events: ['page_view']
                    }
                }
            }
        };
    }

    /**
     * Generate default UI graph
     */
    private generateDefaultUIGraph(input: GeneratorInput, events: EventSchema[]): any {
        const routes = input.routes || ['/'];
        const pages: any = {};

        routes.forEach(route => {
            const pageName = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');
            pages[pageName] = {
                route,
                components: ['header', 'main', 'footer'],
                can_navigate_to: routes.filter(r => r !== route).map(r =>
                    r === '/' ? 'home' : r.replace(/\//g, '_').replace(/^_/, '')
                ),
                events: events.map(e => e.name)
            };
        });

        return {
            app_key: input.appKey,
            relationships: [],
            pages
        };
    }

    /**
     * Ensure all events have required fields
     */
    private ensureRequiredFields(events: EventSchema[]): EventSchema[] {
        return events.map(event => ({
            ...event,
            required: Array.from(new Set([...REQUIRED_FIELDS, ...(event.required || [])]))
        }));
    }

    /**
     * Generate implementation from schema and graph
     */
    private async generateImplementation(
        input: GeneratorInput,
        events: EventSchema[],
        uiGraph: any
    ): Promise<GeneratorOutput> {
        const backend = input.backendUrl || 'http://localhost:8080/ingest/analytics';

        return {
            'tracker.js': this.generateTracker(input.appKey, backend),
            'events-schema.json': {
                required_fields: {
                    app_key: { type: 'string', source: 'config' },
                    session_id: { type: 'string', source: 'sessionStorage' },
                    user_id: { type: 'string', source: 'context', nullable: true },
                    ts: { type: 'timestamp', source: 'generated' }
                },
                events: events.map(e => ({
                    type: e.name,
                    required: e.required,
                    optional: e.optional,
                    properties: e.properties || {},
                    possible_values: e.possible_values || {}
                }))
            },
            'ui-graph.json': uiGraph,
            'analytics-provider.tsx': this.generateProvider(input.appKey),
            'analytics.types.ts': this.generateTypes(events),
            'integration-guide.md': this.generateIntegrationGuide(input.appKey, events),
            metadata: {
                generatedAt: new Date().toISOString(),
                appKey: input.appKey,
                eventCount: events.length,
                frameworksDetected: input.frameworks || []
            }
        };
    }

    // [Rest of the methods remain the same: saveOutput, generateTracker, generateProvider, generateTypes, generateIntegrationGuide]

    /**
     * Save output to disk
     */
    private async saveOutput(output: GeneratorOutput, repoId: string, appKey: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputPath = path.join(OUTPUTS_DIR, 'unified', repoId, timestamp);

        await fs.mkdir(outputPath, { recursive: true });

        for (const [filename, content] of Object.entries(output)) {
            if (filename === 'metadata') continue;
            const filePath = path.join(outputPath, filename);
            const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
            await fs.writeFile(filePath, fileContent, 'utf8');
        }

        await fs.writeFile(
            path.join(outputPath, 'metadata.json'),
            JSON.stringify(output.metadata, null, 2),
            'utf8'
        );

        await this.supabase.from('events').insert({
            source: 'ai',
            repo_id: repoId,
            commit_sha: null,
            actor: 'analytics_intelligence_generator',
            ts: new Date().toISOString(),
            verb: 'analytics_implementation',
            metadata: {
                app_key: appKey,
                output_path: outputPath,
                ...output.metadata,
                files: Object.keys(output).filter(k => k !== 'metadata')
            }
        });

        console.log(`✅ Analytics implementation saved to: ${outputPath}`);
        return outputPath;
    }

    private generateTracker(appKey: string, endpoint: string): string {
        return `(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Analytics = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  
  class AnalyticsTracker {
    constructor() {
      this.config = {
        appKey: '${appKey}',
        endpoint: '${endpoint}',
        batchSize: 10,
        flushInterval: 30000
      };
      
      this.eventQueue = [];
      this.sessionId = this.getOrCreateSession();
      this.userId = null;
      
      if (typeof window !== 'undefined') {
        this.setupListeners();
        this.startFlushTimer();
      }
    }

    getOrCreateSession() {
      try {
        let sessionId = sessionStorage.getItem('analytics_session_id');
        if (!sessionId) {
          sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          sessionStorage.setItem('analytics_session_id', sessionId);
        }
        return sessionId;
      } catch {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
    }

    setupListeners() {
      window.addEventListener('beforeunload', () => this.flush());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush();
      });
    }

    startFlushTimer() {
      setInterval(() => {
        if (this.eventQueue.length > 0) this.flush();
      }, this.config.flushInterval);
    }

    trackEvent(eventName, properties = {}) {
      const event = {
        name: eventName,
        props: {
          app_key: this.config.appKey,
          session_id: this.sessionId,
          user_id: this.userId,
          ts: new Date().toISOString(),
          ...properties
        }
      };
      
      this.eventQueue.push(event);
      
      if (this.eventQueue.length >= this.config.batchSize) {
        this.flush();
      }
    }

    trackPageView(page) {
      this.trackEvent('page_view', {
        page_url: page?.url || window.location.href,
        page_title: page?.title || document.title,
        referrer: document.referrer
      });
    }

    identify(userId, traits = {}) {
      this.userId = userId;
      this.trackEvent('identify', { user_id: userId, traits });
    }

    flush() {
      if (this.eventQueue.length === 0) return;
      
      const batch = this.eventQueue.splice(0, this.config.batchSize);
      
      fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_key: this.config.appKey,
          events: batch
        }),
        keepalive: true
      }).catch(err => console.error('Analytics error:', err));
    }
  }

  // Auto-initialize
  if (typeof window !== 'undefined' && !window.analytics) {
    window.analytics = new AnalyticsTracker();
    window.analytics.trackPageView();
  }

  return AnalyticsTracker;
}));`;
    }

    private generateProvider(appKey: string): string {
        return `import React, { createContext, useState, useEffect } from 'react';

export const AnalyticsContext = createContext({
  appKey: '',
  sessionId: '',
  userId: null as string | null
});

export function AnalyticsProvider({ 
  children, 
  userId = null 
}: { 
  children: React.ReactNode;
  userId?: string | null;
}) {
  const [sessionId, setSessionId] = useState('');
  
  useEffect(() => {
    // Get or create session ID
    try {
      let sid = sessionStorage.getItem('analytics_session_id');
      if (!sid) {
        sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('analytics_session_id', sid);
      }
      setSessionId(sid);
    } catch {
      // Fallback for SSR or storage errors
      setSessionId('sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
    }
  }, []);
  
  return (
    <AnalyticsContext.Provider value={{
      appKey: '${appKey}',
      sessionId,
      userId
    }}>
      {children}
    </AnalyticsContext.Provider>
  );
}`;
    }

    private generateTypes(events: EventSchema[]): string {
        const eventInterfaces = events.map(e => {
            const properties = Object.entries(e.properties || {})
                .map(([key, type]) => {
                    const isOptional = e.optional?.includes(key);
                    const possibleValues = e.possible_values?.[key];

                    if (possibleValues && possibleValues.length > 0) {
                        const valueType = possibleValues.map(v => `'${v}'`).join(' | ');
                        return `  ${key}${isOptional ? '?' : ''}: ${valueType};`;
                    }

                    return `  ${key}${isOptional ? '?' : ''}: ${type};`;
                })
                .join('\n');

            return `export interface ${e.name.charAt(0).toUpperCase() + e.name.slice(1).replace(/_/g, '')}Event {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
${properties}
}`;
        }).join('\n\n');

        return `// Auto-generated analytics types
${eventInterfaces}

export type AnalyticsEvent = ${events.map(e =>
            `${e.name.charAt(0).toUpperCase() + e.name.slice(1).replace(/_/g, '')}Event`
        ).join(' | ')};

export interface AnalyticsTracker {
  trackEvent(eventName: string, properties: Record<string, any>): void;
  trackPageView(page?: { url?: string; title?: string }): void;
  identify(userId: string, traits?: Record<string, any>): void;
  flush(): void;
}

declare global {
  interface Window {
    analytics?: AnalyticsTracker;
  }
}`;
    }

    private generateIntegrationGuide(appKey: string, events: EventSchema[]): string {
        const eventExamples = events.slice(0, 3).map(e => {
            const example = e.possible_values ?
                Object.entries(e.possible_values).reduce((acc, [key, values]) => {
                    acc[key] = values[0];
                    return acc;
                }, {} as any) : {};

            return `window.analytics.trackEvent('${e.name}', ${JSON.stringify(example, null, 2)});`;
        }).join('\n\n');

        return `# Analytics Integration Guide for ${appKey}

## Quick Start

### 1. Add tracker to your HTML
\`\`\`html
<script src="/tracker.js"></script>
\`\`\`

### 2. Add Analytics Provider (React/Next.js)
\`\`\`tsx
import { AnalyticsProvider } from './analytics-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AnalyticsProvider userId={currentUser?.id}>
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
\`\`\`

### 3. Track Events

#### Available Events (${events.length} total)
${events.map(e => `- **${e.name}**: ${e.required.filter(r => !REQUIRED_FIELDS.includes(r as any)).join(', ')}`).join('\n')}

#### Examples
\`\`\`javascript
${eventExamples}
\`\`\`

## Required Fields (Automatically Included)
- \`app_key\`: "${appKey}"
- \`session_id\`: Auto-generated per session
- \`user_id\`: From context (can be null)
- \`ts\`: ISO timestamp

## Testing
1. Open browser console
2. Look for "Analytics tracker initialized"
3. Check Network tab for requests to /ingest/analytics
4. Verify events contain all required fields`;
    }
}

// Export singleton instance
export const analyticsGenerator = new AnalyticsIntelligenceGenerator();

// API endpoint handler remains the same...
export async function createAnalyticsIntelligenceEndpoint(app: any) {
    // [Same as before]
}