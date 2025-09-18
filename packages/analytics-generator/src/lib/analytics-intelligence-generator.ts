// packages/analytics-generator/src/lib/analytics-intelligence-generator.ts
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Check for required environment variables
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Missing ANTHROPIC_API_KEY in .env file');
}
if (!process.env.SUPABASE_URL) {
    console.error('❌ Missing SUPABASE_URL in .env file');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env file');
}

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'dummy-key-for-testing'
});

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://dummy.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-key',
    { auth: { persistSession: false } }
);

// Configuration
const CONFIG = {
    OUTPUTS_DIR: '/Users/oriolesinski/analytics-automation/packages/analytics-generator/src/utils/generated-outputs',
    EXAMPLES_DIR: '/Users/oriolesinski/analytics-automation/examples',
    MAX_FILES: 50,
    MAX_FILE_CONTENT_LENGTH: 5000,
    LLM_MAX_TOKENS: 4096
};

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

/**
 * Storage Service for cloud and local file management
 */
class StorageService {
    private bucketName = 'generated-analytics';
    private supabase: any;

    constructor(supabaseClient: any) {
        this.supabase = supabaseClient;
        this.initializeBucket();
    }

    private async initializeBucket() {
        try {
            const { data: buckets } = await this.supabase.storage.listBuckets();
            if (!buckets?.find((b: any) => b.name === this.bucketName)) {
                await this.supabase.storage.createBucket(this.bucketName, {
                    public: false,
                    allowedMimeTypes: ['application/json', 'application/javascript', 'text/javascript', 'text/markdown', 'text/plain']
                });
                console.log('✅ Created storage bucket:', this.bucketName);
            }
        } catch (error) {
            console.error('⚠️ Storage bucket initialization error:', error);
        }
    }

    async saveToCloud(repoId: string, fileName: string, content: string, contentType = 'application/json'): Promise<{ path: string; url: string | null }> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const cloudPath = `${repoId}/${timestamp}/${fileName}`;

        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .upload(cloudPath, content, {
                    contentType,
                    upsert: false
                });

            if (error) throw error;

            await this.supabase.from('generated_outputs').insert({
                repo_id: repoId,
                output_type: fileName.replace(/\.(js|json|tsx|ts|md)$/, ''),
                file_path: cloudPath,
                metadata: {
                    size: content.length,
                    contentType
                },
                created_at: new Date().toISOString()
            });

            const url = await this.getSignedUrl(cloudPath);
            console.log(`☁️ Saved to cloud: ${fileName}`);
            return { path: cloudPath, url };
        } catch (error) {
            console.error(`⚠️ Cloud save failed for ${fileName}:`, error);
            return { path: cloudPath, url: null };
        }
    }

    async saveToLocal(outputPath: string, fileName: string, content: string): Promise<void> {
        const filePath = path.join(outputPath, fileName);
        await fs.writeFile(filePath, content, { encoding: 'utf8' });
        console.log(`💾 Saved locally: ${fileName}`);
    }

    private async getSignedUrl(filePath: string, expiresIn = 3600): Promise<string | null> {
        try {
            const { data } = await this.supabase.storage
                .from(this.bucketName)
                .createSignedUrl(filePath, expiresIn);
            return data?.signedUrl || null;
        } catch (error) {
            console.error('Failed to generate signed URL:', error);
            return null;
        }
    }
}

export class AnalyticsIntelligenceGenerator {
    private anthropic: Anthropic;
    private supabase: any;
    private storageService: StorageService;

    constructor() {
        this.anthropic = anthropic;
        this.supabase = supabase;
        this.storageService = new StorageService(supabase);
    }

    /**
     * Generate the complete analytics implementation
     */
    async generate(input: GeneratorInput): Promise<GeneratorOutput> {
        console.log('🔍 Starting generation for:', input.appKey);

        // Step 1: Load files
        const repoFiles = await this.loadRepositoryFiles(input.repoId);
        if (repoFiles.length > 0) {
            console.log(`📁 Loaded ${repoFiles.length} files`);
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

        // Step 6: Save to both cloud and local storage
        await this.saveOutput(output, input.repoId, input.appKey);

        return output;
    }

    /**
     * Load actual files from the repository or examples directory
     */
    public async loadRepositoryFiles(repoId: string): Promise<FileContent[]> {
        const files: FileContent[] = [];

        // First, check if it's an app from examples directory
        const examplesPath = path.join(CONFIG.EXAMPLES_DIR, repoId);
        try {
            const stat = await fs.stat(examplesPath);
            if (stat.isDirectory()) {
                console.log(`✅ Found app in examples: ${repoId}`);
                const relevantFiles = await this.findRelevantFiles(examplesPath);

                for (const filePath of relevantFiles.slice(0, CONFIG.MAX_FILES)) {
                    try {
                        const content = await fs.readFile(filePath, 'utf-8');
                        const relativePath = path.relative(examplesPath, filePath);
                        const truncatedContent = content.length > CONFIG.MAX_FILE_CONTENT_LENGTH
                            ? content.slice(0, CONFIG.MAX_FILE_CONTENT_LENGTH) + '\n// ... truncated for analysis ...'
                            : content;
                        files.push({ path: relativePath, content: truncatedContent });
                    } catch (error) {
                        console.error(`Failed to read file ${filePath}:`, error);
                    }
                }
                return files;
            }
        } catch {
            // Not in examples, try database
        }

        // If not in examples, try to get from database
        try {
            const { data: repo } = await this.supabase
                .from('repos')
                .select('owner, name')
                .eq('id', repoId)
                .single();

            if (!repo) {
                console.log('❌ Repository not found in database');
                return files;
            }

            const repoPath = await this.getRepositoryPath(repo.owner, repo.name);
            if (repoPath) {
                const relevantFiles = await this.findRelevantFiles(repoPath);

                for (const filePath of relevantFiles.slice(0, CONFIG.MAX_FILES)) {
                    try {
                        const content = await fs.readFile(filePath, 'utf-8');
                        const relativePath = path.relative(repoPath, filePath);
                        const truncatedContent = content.length > CONFIG.MAX_FILE_CONTENT_LENGTH
                            ? content.slice(0, CONFIG.MAX_FILE_CONTENT_LENGTH) + '\n// ... truncated for analysis ...'
                            : content;
                        files.push({ path: relativePath, content: truncatedContent });
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
                    files.push(...run.summary.files.slice(0, CONFIG.MAX_FILES));
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
        const possiblePaths = [
            path.join(CONFIG.EXAMPLES_DIR, name),
            path.join(CONFIG.EXAMPLES_DIR, `${owner}-${name}`),
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
        const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'out', 'backend'];

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
        return files;
    }

    /**
     * Extract routes from file system structure - FIXED to exclude page.tsx
     */
    private extractRoutesFromFiles(files: FileContent[]): string[] {
        const routes = new Set<string>();
        routes.add('/'); // Always include home

        for (const file of files) {
            // Skip root page.tsx files that aren't part of a route structure
            if (file.path === 'page.tsx' ||
                file.path === './page.tsx' ||
                file.path === 'src/page.tsx' ||
                file.path === 'app/page.tsx') {  // Add this line
                continue;
            }

            // Next.js App Router
            if (file.path.includes('app/') && file.path.endsWith('page.tsx')) {
                const route = '/' + file.path
                    .replace(/^.*?app\//, '')
                    .replace(/\/page\.(tsx|jsx|js)$/, '')
                    .replace(/\[.*?\]/g, ':param');

                // Don't add if it results in just '/' from app/page.tsx
                if (route !== '/' || file.path === 'app/page.tsx') {
                    routes.add(route === '/' ? '/' : route);
                }
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
     * ENHANCED: Generate schema by analyzing actual code content with better LLM guidance
     */
    private async generateSchemaFromCode(input: GeneratorInput): Promise<SchemaWithGraph> {
        if (!input.files || input.files.length === 0) {
            console.log('⚠️ No files to analyze, using default schema');
            const defaultEvents = this.getDefaultAutoTrackedEvents();
            return {
                events: defaultEvents,
                uiGraph: this.generateDefaultUIGraph(input, defaultEvents)
            };
        }

        console.log(`📊 Generating schema with ${input.files.length} files and ${input.routes?.length || 0} routes`);

        // Prepare code content for LLM analysis
        const codeContent = input.files.slice(0, 15).map((f: FileContent) =>
            `=== File: ${f.path} ===\n${f.content.slice(0, 2000)}\n`
        ).join('\n').slice(0, 30000);

        const systemPrompt = `You are an expert analytics architect analyzing application code.
Generate a JSON schema for analytics events based on the code.

ANALYSIS INSTRUCTIONS:
1. First, scan the code for UI elements and interactions
2. For each UI element type found, include the corresponding event
3. Look for ACTUAL elements in the code, not theoretical ones
4. Include an event ONLY if you find evidence of that element type

IMPORTANT: Return ONLY valid JSON, no explanations or markdown.`;

        const userPrompt = `Analyze this code and return a JSON object with events and UI graph.

Application: ${input.appKey}
Routes: ${JSON.stringify(input.routes || [])}

CODE:
${codeContent}

DETECTION GUIDE - Include these events ONLY if you find the corresponding elements:

UI ELEMENTS TO DETECT:
- <button>, <Button>, type="submit", role="button" → include "button_click" event
- <a>, <Link>, href=, to= → include "link_click" event  
- <form>, <Form>, onSubmit, handleSubmit → include "form_started" and "form_submitted" events
- validation, error messages, invalid states → include "form_error" event
- modal, dialog, popup, overlay, role="dialog" → include "modal_opened" and "modal_closed" events
- Long content, overflow, pagination → include "scroll_depth" event
- Search inputs, filter controls → include "search_performed" event

ANALYSIS STEPS:
1. Read through the code files
2. Identify which UI elements actually exist
3. For each element type found, include its corresponding events
4. For the UI graph, create a page entry for EACH route provided
5. Extract actual values (button texts, form names) when visible in code

Return this EXACT JSON structure:
{
  "events": [
    {
      "name": "page_view",
      "required": ["app_key", "session_id", "user_id", "ts", "page_url"],
      "optional": ["page_title", "referrer", "query_params", "hash"],
      "properties": {
        "page_url": "string",
        "page_title": "string",
        "referrer": "string",
        "query_params": "string",
        "hash": "string"
      },
      "possible_values": {
        "page_url": ${JSON.stringify(input.routes || [])}
      }
    },
    // ADD ONLY events for UI elements you actually found in the code
    // Each event MUST have: name, required, optional, properties, possible_values
  ],
  "uiGraph": {
    "app_key": "${input.appKey}",
    "relationships": [],
    "pages": {
      // CREATE AN ENTRY FOR EACH ROUTE - don't skip any!
      // Use route path to generate page names (/ = "home", /products = "products", etc.)
    }
  }
}

CRITICAL RULES:
- Include page_view event always
- Add other events ONLY if you found their UI elements in the code
- Every route MUST have a page entry in the UI graph
- Don't make up events - only include what you can verify exists
- If you see 10+ buttons in the code, include button_click
- If you see forms with input fields, include form events
- If you see navigation links, include link_click`;

        try {
            console.log('🤖 Sending code to LLM for analysis...');
            const response = await this.anthropic.messages.create({
                model: "claude-3-haiku-20240307",
                max_tokens: CONFIG.LLM_MAX_TOKENS,
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
                const jsonStart = content.indexOf('{');
                const jsonEnd = content.lastIndexOf('}') + 1;
                if (jsonStart >= 0 && jsonEnd > jsonStart) {
                    parsed = JSON.parse(content.slice(jsonStart, jsonEnd));
                } else {
                    throw new Error('No valid JSON found in LLM response');
                }
            }

            // Validate events have required structure
            parsed.events = this.validateAndFixEventSchema(parsed.events || []);

            // FIXED: Better duplicate prevention when ensuring all routes are in UI graph
            if (parsed.uiGraph && parsed.uiGraph.pages) {
                const existingPageRoutes = new Set(
                    Object.values(parsed.uiGraph.pages)
                        .map((p: any) => p.route || p.path)
                        .filter(Boolean)
                );

                (input.routes || []).forEach((route: string) => {
                    if (!existingPageRoutes.has(route)) {
                        const pageName = this.routeToPageName(route);
                        // Only add if page name doesn't already exist
                        if (!parsed.uiGraph.pages[pageName]) {
                            console.log(`Adding missing page to graph: ${pageName} (${route})`);
                            parsed.uiGraph.pages[pageName] = {
                                route,
                                components: ['header', 'main', 'footer'],
                                can_navigate_to: [],
                                events: parsed.events.map((e: EventSchema) => e.name)
                            };
                        }
                    }
                });
                parsed.uiGraph.app_key = input.appKey;
            } else {
                console.log('⚠️ LLM did not generate proper UI graph, creating default');
                parsed.uiGraph = this.generateDefaultUIGraph(input, parsed.events);
            }

            console.log('✅ Successfully analyzed code');
            console.log(`   Found ${parsed.events?.length || 0} relevant event types`);
            console.log(`   Generated UI graph with ${Object.keys(parsed.uiGraph?.pages || {}).length} pages`);

            return {
                events: parsed.events.length > 0 ? parsed.events : this.getDefaultAutoTrackedEvents(),
                uiGraph: parsed.uiGraph
            };

        } catch (error) {
            console.error('❌ LLM analysis failed, using defaults:', error);
            const defaultEvents = this.getDefaultAutoTrackedEvents();
            return {
                events: defaultEvents,
                uiGraph: this.generateDefaultUIGraph(input, defaultEvents)
            };
        }
    }

    /**
     * Validate and ensure required fields in events
     */
    private validateAndFixEventSchema(events: any[]): EventSchema[] {
        return events
            .filter((event: any) => {
                if (!event || !event.name || typeof event.name !== 'string') {
                    console.warn('⚠️ Skipping invalid event:', event);
                    return false;
                }
                return true;
            })
            .map((event: any): EventSchema => {
                const requiredSet = new Set([...REQUIRED_FIELDS, ...(event.required || [])]);
                return {
                    name: event.name,
                    required: Array.from(requiredSet),
                    optional: event.optional || [],
                    properties: event.properties || {},
                    possible_values: event.possible_values || {}
                };
            });
    }

    /**
     * Get default auto-tracked events schema
     */
    private getDefaultAutoTrackedEvents(): EventSchema[] {
        return [
            {
                name: 'page_view',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'page_url'],
                optional: ['page_title', 'referrer', 'query_params', 'hash'],
                properties: {
                    page_url: 'string',
                    page_title: 'string',
                    referrer: 'string',
                    query_params: 'string',
                    hash: 'string'
                },
                possible_values: {}
            },
            {
                name: 'button_click',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'button_text', 'page_title'],
                optional: ['button_id', 'button_location', 'button_class', 'page_url'],
                properties: {
                    button_text: 'string',
                    button_id: 'string',
                    button_location: 'string',
                    button_class: 'string',
                    page_title: 'string',
                    page_url: 'string'
                },
                possible_values: {
                    button_location: ['header', 'main', 'footer', 'aside', 'nav', 'section', 'unknown']
                }
            },
            {
                name: 'link_click',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'link_text', 'link_href', 'page_title'],
                optional: ['link_location', 'is_external', 'page_url'],
                properties: {
                    link_text: 'string',
                    link_href: 'string',
                    link_location: 'string',
                    is_external: 'boolean',
                    page_title: 'string',
                    page_url: 'string'
                },
                possible_values: {
                    link_location: ['header', 'main', 'footer', 'aside', 'nav', 'section', 'unknown']
                }
            },
            {
                name: 'form_started',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'form_name', 'page_title'],
                optional: ['form_id', 'first_field_focused', 'page_url'],
                properties: {
                    form_name: 'string',
                    form_id: 'string',
                    first_field_focused: 'string',
                    page_title: 'string',
                    page_url: 'string'
                },
                possible_values: {}
            },
            {
                name: 'form_submitted',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'form_name', 'success', 'page_title'],
                optional: ['form_id', 'error_message', 'duration_seconds', 'fields_interacted', 'page_url'],
                properties: {
                    form_name: 'string',
                    form_id: 'string',
                    success: 'boolean',
                    duration_seconds: 'number',
                    fields_interacted: 'number',
                    error_message: 'string',
                    page_title: 'string',
                    page_url: 'string'
                },
                possible_values: {}
            },
            {
                name: 'form_error',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'form_name', 'field_name'],
                optional: ['error_message', 'page_title', 'page_url'],
                properties: {
                    form_name: 'string',
                    field_name: 'string',
                    error_message: 'string',
                    page_title: 'string',
                    page_url: 'string'
                },
                possible_values: {}
            },
            {
                name: 'modal_opened',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'modal_name', 'page_title'],
                optional: ['modal_id', 'trigger_element', 'page_url'],
                properties: {
                    modal_name: 'string',
                    modal_id: 'string',
                    trigger_element: 'string',
                    page_title: 'string',
                    page_url: 'string'
                },
                possible_values: {}
            },
            {
                name: 'modal_closed',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'modal_name', 'close_method', 'page_title'],
                optional: ['modal_id', 'page_url'],
                properties: {
                    modal_name: 'string',
                    modal_id: 'string',
                    close_method: 'string',
                    page_title: 'string',
                    page_url: 'string'
                },
                possible_values: {
                    close_method: ['close_button', 'removed_from_dom', 'backdrop_click', 'escape_key']
                }
            },
            {
                name: 'scroll_depth',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'depth_percent', 'page_title'],
                optional: ['page_height', 'viewport_height', 'time_on_page_seconds', 'page_url'],
                properties: {
                    depth_percent: 'number',
                    page_height: 'number',
                    viewport_height: 'number',
                    time_on_page_seconds: 'number',
                    page_title: 'string',
                    page_url: 'string'
                },
                possible_values: {}
            }
        ];
    }

    /**
     * Generate default UI graph when LLM fails or no analysis possible
     */
    private generateDefaultUIGraph(input: GeneratorInput, events: EventSchema[]): any {
        const routes = input.routes || ['/'];
        const pages: any = {};

        console.log('🔍 Generating default UI graph for routes:', routes);

        routes.forEach((route: string) => {
            const pageName = this.routeToPageName(route);
            pages[pageName] = {
                route,
                components: ['header', 'main', 'footer'],
                can_navigate_to: routes.filter((r: string) => r !== route).map((r: string) => this.routeToPageName(r)),
                events: events.map(e => e.name)
            };
        });

        if (Object.keys(pages).length === 0) {
            console.warn('⚠️ No pages generated, adding default home page');
            pages['home'] = {
                route: '/',
                components: ['header', 'main', 'footer'],
                can_navigate_to: [],
                events: events.map(e => e.name)
            };
        }

        return {
            app_key: input.appKey,
            relationships: [],
            pages
        };
    }

    /**
     * Convert route to valid page name
     */
    private routeToPageName(route: string): string {
        if (route === '/') return 'home';

        return route
            .replace(/^\//, '')
            .replace(/\//g, '_')
            .replace(/[^\w_]/g, '')
            .replace(/:param/g, 'dynamic')
            .toLowerCase() || 'home';
    }

    /**
     * Ensure required fields in all events
     */
    private ensureRequiredFields(events: EventSchema[]): EventSchema[] {
        return events.map(event => ({
            ...event,
            required: Array.from(new Set([...REQUIRED_FIELDS, ...(event.required || [])]))
        }));
    }

    /**
     * Generate all implementation files
     */
    private async generateImplementation(
        input: GeneratorInput,
        events: EventSchema[],
        uiGraph: any
    ): Promise<GeneratorOutput> {
        const backend = input.backendUrl || 'http://localhost:8082/ingest/analytics';

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

    /**
     * ENHANCED: Save output with proper UTF-8 encoding
     */
    private async saveOutput(output: GeneratorOutput, repoId: string, appKey: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const localOutputPath = path.join(CONFIG.OUTPUTS_DIR, 'unified', repoId, timestamp);

        const keepLocal = process.env.KEEP_LOCAL_COPY !== 'false';
        if (keepLocal) {
            await fs.mkdir(localOutputPath, { recursive: true });
        }

        const fileMap = [
            { name: 'tracker.js', content: output['tracker.js'], type: 'application/javascript' },
            { name: 'events-schema.json', content: JSON.stringify(output['events-schema.json'], null, 2), type: 'application/json' },
            { name: 'ui-graph.json', content: JSON.stringify(output['ui-graph.json'], null, 2), type: 'application/json' },
            { name: 'analytics-provider.tsx', content: output['analytics-provider.tsx'], type: 'text/plain' },
            { name: 'analytics.types.ts', content: output['analytics.types.ts'], type: 'text/plain' },
            { name: 'integration-guide.md', content: output['integration-guide.md'], type: 'text/markdown' },
            { name: 'metadata.json', content: JSON.stringify(output.metadata, null, 2), type: 'application/json' }
        ];

        const cloudUrls: Record<string, string> = {};

        for (const file of fileMap) {
            const { url } = await this.storageService.saveToCloud(repoId, file.name, file.content, file.type);
            if (url) {
                cloudUrls[file.name] = url;
            }

            if (keepLocal) {
                await this.storageService.saveToLocal(localOutputPath, file.name, file.content);
            }
        }

        await this.supabase.from('events').insert({
            source: 'ai',
            repo_id: repoId,
            commit_sha: null,
            actor: 'analytics_intelligence_generator',
            ts: new Date().toISOString(),
            verb: 'analytics_implementation',
            metadata: {
                app_key: appKey,
                output_path: localOutputPath,
                cloud_urls: cloudUrls,
                storage_mode: keepLocal ? 'hybrid' : 'cloud_only',
                ...output.metadata,
                files: Object.keys(output).filter(k => k !== 'metadata')
            }
        });

        console.log('✅ Analytics implementation generated successfully');
        console.log(`📊 Events: ${output.metadata.eventCount}`);
        console.log(`🗺️ Pages: ${Object.keys(output['ui-graph.json'].pages || {}).length}`);
        console.log(`☁️ Cloud: ${Object.keys(cloudUrls).length} files uploaded`);
        if (keepLocal) {
            console.log(`💾 Local: ${localOutputPath}`);
        }

        return localOutputPath;
    }

    /**
     * Generate the complete tracker.js implementation
     */
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
      this.pageLoadTime = Date.now();
      this.maxScrollDepth = 0;
      this.formTracking = new WeakMap();
      
      if (typeof window !== 'undefined') {
        this.setupListeners();
        this.startFlushTimer();
        this.initAutoTracking(); // Initialize auto-tracking
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

    // ============ AUTO-TRACKING METHODS ============
    initAutoTracking() {
      console.log('🎯 Analytics auto-tracking initialized for ${appKey}');
      
      // Track initial page view
      this.trackPageView();
      
      // Setup all automatic tracking
      this.trackButtonClicks();
      this.trackLinkClicks();
      this.trackFormInteractions();
      this.trackModals();
      this.trackScrollDepth();
      this.trackRouteChanges();
    }

    trackButtonClicks() {
      document.addEventListener('click', (e) => {
        const button = e.target.closest('button, [role="button"], input[type="submit"], input[type="button"]');
        if (button) {
          const buttonText = (button.innerText || button.value || button.getAttribute('aria-label') || 'Unknown').trim();
          const buttonId = button.id || null;
          const buttonClass = button.className || null;
          
          // Find parent section for context
          const section = button.closest('header, main, footer, aside, nav, section, [role="navigation"], [role="main"]');
          const buttonLocation = section ? (section.tagName.toLowerCase() || section.getAttribute('role')) : 'unknown';
          
          this.trackEvent('button_click', {
            button_text: buttonText.slice(0, 100),
            button_id: buttonId,
            button_class: buttonClass,
            button_location: buttonLocation,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      }, true);
    }

    trackLinkClicks() {
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && !link.closest('button')) {
          const linkText = (link.innerText || link.getAttribute('aria-label') || 'Unknown').trim();
          const linkHref = link.getAttribute('href') || '';
          const isExternal = linkHref.startsWith('http') && !linkHref.includes(window.location.hostname);
          
          const section = link.closest('header, main, footer, aside, nav, section');
          const linkLocation = section ? section.tagName.toLowerCase() : 'unknown';
          
          this.trackEvent('link_click', {
            link_text: linkText.slice(0, 100),
            link_href: linkHref,
            link_location: linkLocation,
            is_external: isExternal,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      }, true);
    }

    trackFormInteractions() {
      // Track form starts
      document.addEventListener('focusin', (e) => {
        const field = e.target;
        const form = field.closest('form');
        
        if (form && !this.formTracking.has(form)) {
          this.formTracking.set(form, {
            started: true,
            startTime: Date.now(),
            fieldsInteracted: new Set()
          });
          
          const formName = this.getFormName(form);
          
          this.trackEvent('form_started', {
            form_name: formName,
            form_id: form.id || null,
            first_field_focused: field.name || field.id || field.type,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
        
        // Track field interactions
        if (form && this.formTracking.has(form)) {
          const tracking = this.formTracking.get(form);
          tracking.fieldsInteracted.add(field.name || field.id || field.type);
        }
      });

      // Track form submissions
      document.addEventListener('submit', (e) => {
        const form = e.target;
        const formName = this.getFormName(form);
        const tracking = this.formTracking.get(form);
        
        this.trackEvent('form_submitted', {
          form_name: formName,
          form_id: form.id || null,
          success: true,
          duration_seconds: tracking ? Math.round((Date.now() - tracking.startTime) / 1000) : null,
          fields_interacted: tracking ? tracking.fieldsInteracted.size : null,
          page_title: document.title,
          page_url: window.location.pathname
        });
        
        // Clear tracking for this form
        this.formTracking.delete(form);
      });

      // Track form errors (validation failures)
      document.addEventListener('invalid', (e) => {
        const field = e.target;
        const form = field.closest('form');
        if (form) {
          const formName = this.getFormName(form);
          this.trackEvent('form_error', {
            form_name: formName,
            field_name: field.name || field.id || field.type,
            error_message: field.validationMessage,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      }, true);
    }

    getFormName(form) {
      // Try to intelligently determine form name
      const formName = form.getAttribute('name') || 
                      form.getAttribute('aria-label') ||
                      form.id;
      
      if (formName) return formName;
      
      // Guess from content
      const formText = form.innerText.toLowerCase();
      const formHTML = form.innerHTML.toLowerCase();
      
      if (formHTML.includes('password') && formHTML.includes('email')) {
        return formText.includes('sign up') || formText.includes('register') ? 'register' : 'login';
      }
      if (formHTML.includes('email') && formText.includes('subscribe')) return 'subscribe';
      if (formHTML.includes('search')) return 'search';
      if (formText.includes('checkout')) return 'checkout';
      if (formText.includes('payment')) return 'payment';
      if (formText.includes('shipping')) return 'shipping';
      if (formText.includes('contact')) return 'contact';
      if (formText.includes('feedback')) return 'feedback';
      
      return 'form';
    }

    trackModals() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              // Check for modal patterns
              const isModal = node.matches && (
                node.matches('[role="dialog"], [role="alertdialog"], .modal, .popup, [class*="modal"], [class*="dialog"], [data-modal]') ||
                node.querySelector('[role="dialog"], [role="alertdialog"]')
              );
              
              if (isModal) {
                const modalName = node.getAttribute('aria-label') || 
                                 node.getAttribute('title') ||
                                 node.id ||
                                 node.querySelector('h1, h2, h3')?.innerText ||
                                 'modal';
                
                this.trackEvent('modal_opened', {
                  modal_name: modalName,
                  modal_id: node.id || null,
                  trigger_element: document.activeElement?.tagName || 'unknown',
                  page_title: document.title,
                  page_url: window.location.pathname
                });

                // Track modal close
                this.observeModalClose(node, modalName);
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    observeModalClose(modalElement, modalName) {
      const closeObserver = new MutationObserver(() => {
        if (!document.contains(modalElement)) {
          this.trackEvent('modal_closed', {
            modal_name: modalName,
            modal_id: modalElement.id || null,
            close_method: 'removed_from_dom',
            page_title: document.title,
            page_url: window.location.pathname
          });
          closeObserver.disconnect();
        }
      });
      
      if (modalElement.parentNode) {
        closeObserver.observe(modalElement.parentNode, { childList: true });
      }
      
      // Also track close button clicks within modal
      modalElement.addEventListener('click', (e) => {
        const closeButton = e.target.closest('[aria-label*="close"], [class*="close"], [data-dismiss], button[type="button"]');
        if (closeButton) {
          this.trackEvent('modal_closed', {
            modal_name: modalName,
            modal_id: modalElement.id || null,
            close_method: 'close_button',
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      });
    }

    trackScrollDepth() {
      let scrollTimer;
      
      const checkScrollDepth = () => {
        const scrollPercent = Math.round(
          (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100
        );
        
        // Track milestones: 25%, 50%, 75%, 100%
        const milestones = [25, 50, 75, 100];
        const milestone = milestones.find(m => m <= scrollPercent && m > this.maxScrollDepth);
        
        if (milestone) {
          this.maxScrollDepth = milestone;
          this.trackEvent('scroll_depth', {
            depth_percent: milestone,
            page_height: document.body.scrollHeight,
            viewport_height: window.innerHeight,
            time_on_page_seconds: Math.round((Date.now() - this.pageLoadTime) / 1000),
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      };
      
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(checkScrollDepth, 500);
      });
      
      // Also check on page unload
      window.addEventListener('beforeunload', checkScrollDepth);
    }

    trackRouteChanges() {
      // For SPAs - track History API changes
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        setTimeout(() => this.trackPageView(), 0);
      };
      
      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        setTimeout(() => this.trackPageView(), 0);
      };
      
      window.addEventListener('popstate', () => {
        this.trackPageView();
      });
      
      // Track hash changes
      window.addEventListener('hashchange', () => {
        this.trackPageView();
      });
    }

    // ============ CORE TRACKING METHODS ============
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
      // Reset scroll depth for new page
      this.maxScrollDepth = 0;
      this.pageLoadTime = Date.now();
      
      this.trackEvent('page_view', {
        page_url: page?.url || window.location.href,
        page_title: page?.title || document.title,
        referrer: document.referrer,
        query_params: window.location.search,
        hash: window.location.hash
      });
    }

    identify(userId, traits = {}) {
      this.userId = userId;
      this.trackEvent('identify', { user_id: userId, traits });
    }

    flush() {
      if (this.eventQueue.length === 0) return;
      
      const batch = [...this.eventQueue];
      this.eventQueue = [];
      
      fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_key: this.config.appKey,
          events: batch
        }),
        keepalive: true
      }).catch(err => {
        console.error('Analytics flush error:', err);
        // Re-add events to queue for retry
        this.eventQueue.unshift(...batch);
      });
    }
  }

  // Auto-initialize
  if (typeof window !== 'undefined' && !window.analytics) {
    window.analytics = new AnalyticsTracker();
    console.log('✅ Analytics tracker initialized with auto-tracking enabled');
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
    try {
      let sid = sessionStorage.getItem('analytics_session_id');
      if (!sid) {
        sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('analytics_session_id', sid);
      }
      setSessionId(sid);
    } catch {
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
        const validEvents = events.filter(e => e && e.name && typeof e.name === 'string');

        if (validEvents.length === 0) {
            console.warn('⚠️ No valid events to generate types for');
            return `export type AnalyticsEvent = never;

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

        const eventInterfaces = validEvents.map(e => {
            const properties = Object.entries(e.properties || {})
                .map(([key, type]) => {
                    const isOptional = e.optional?.includes(key);
                    const possibleValues = e.possible_values?.[key];

                    if (possibleValues && possibleValues.length > 0 && type === 'string') {
                        const valueType = possibleValues.map(v => typeof v === 'string' ? `'${v}'` : v).join(' | ');
                        return `  ${key}${isOptional ? '?' : ''}: ${valueType};`;
                    }

                    return `  ${key}${isOptional ? '?' : ''}: ${type};`;
                })
                .join('\n');

            const eventName = e.name.split('_').map((part) =>
                part ? part.charAt(0).toUpperCase() + part.slice(1) : ''
            ).filter(p => p).join('');

            if (!eventName) {
                console.error('Could not generate type name for event:', e.name);
                return '';
            }

            return `export interface ${eventName}Event {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
${properties}
}`;
        }).filter(i => i);

        const eventUnion = validEvents.map(e => {
            const eventName = e.name.split('_').map((part) =>
                part ? part.charAt(0).toUpperCase() + part.slice(1) : ''
            ).filter(p => p).join('');
            return eventName ? `${eventName}Event` : null;
        }).filter(n => n).join(' | ');

        return `// Auto-generated analytics types
${eventInterfaces.join('\n\n')}

export type AnalyticsEvent = ${eventUnion || 'never'};

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
        return `# Analytics Integration Guide for ${appKey}

## 🚀 One-Line Setup - Zero Configuration Required!

Just add this single line to your HTML:

\`\`\`html
<script src="/tracker.js"></script>
\`\`\`

**That's it!** Analytics automatically tracks everything:

## ✨ Auto-Tracked Events (No Code Required)

The tracker automatically captures ALL of these events without any manual integration:

### 📊 User Interactions
- **button_click** - Every button click with context (text, location, page)
- **link_click** - All link navigation with external/internal detection
- **form_started** - When users begin filling forms
- **form_submitted** - Successful form submissions with duration
- **form_error** - Form validation failures

### 📱 Page & Navigation
- **page_view** - Initial load and SPA route changes
- **scroll_depth** - Engagement milestones (25%, 50%, 75%, 100%)

### 🎭 UI Components
- **modal_opened** - Modal/dialog appearances
- **modal_closed** - How modals are dismissed

## 📈 Complete Event Details

${events.map(e => {
            const mainProps = e.required.filter(r => !REQUIRED_FIELDS.includes(r as any));
            const optionalProps = e.optional || [];
            return `### ${e.name}
**Auto-captured:** ${mainProps.join(', ')}
${optionalProps.length > 0 ? `**Additional:** ${optionalProps.join(', ')}` : ''}`;
        }).join('\n\n')}

## 🧪 Testing Your Integration

1. **Open Browser Console**
   - Look for: "✅ Analytics auto-tracking initialized"

2. **Interact With Your App**
   - Click any button → see \`button_click\` events
   - Start typing in a form → see \`form_started\` events
   - Navigate pages → see \`page_view\` events
   - Scroll the page → see \`scroll_depth\` at 25/50/75/100%

3. **Check Network Tab**
   - Filter by: \`/ingest/analytics\`
   - Events batch every 10 interactions or 30 seconds

## 🔧 Optional: React/Next.js Context Provider

For user identification, add the Analytics Provider:

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

## 📝 Manual Tracking (If Needed)

While auto-tracking covers most use cases, you can still track custom events:

\`\`\`javascript
// Custom event tracking
window.analytics.trackEvent('custom_event', {
  custom_property: 'value'
});

// Identify users
window.analytics.identify('user123', {
  email: 'user@example.com',
  plan: 'premium'
});
\`\`\`

## 🎯 What Makes This Special?

- **Zero Integration** - Just add the script tag
- **Framework Agnostic** - Works with React, Vue, Angular, vanilla JS
- **SPA Ready** - Tracks client-side routing automatically
- **Performance Optimized** - Batching, debouncing, minimal overhead
- **Privacy Friendly** - No PII collected by default
- **Complete Coverage** - Captures 90% of analytics needs automatically

## 📊 Default Tracked Properties

Every event includes:
- \`app_key\`: "${appKey}"
- \`session_id\`: Auto-generated per session
- \`user_id\`: From context (can be null)
- \`ts\`: ISO timestamp
- \`page_title\`: Current page title
- \`page_url\`: Current URL path

---

**Generated:** ${new Date().toISOString()}`;
    }
}

// Export singleton instance
export const analyticsGenerator = new AnalyticsIntelligenceGenerator();