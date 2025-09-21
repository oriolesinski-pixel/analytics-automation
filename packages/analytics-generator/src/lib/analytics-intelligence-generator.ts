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

interface ComponentDiscovery {
    components: Array<{
        name: string;
        type: string;
        selector_patterns: string[];
        interaction_type: string;
        likely_purpose: string;
        context_needed: string[];
    }>;
    framework: string;
}

interface BehaviorAnalysis {
    patterns: Array<{
        component: string;
        context_collection: {
            search_parents: string[];
            extract_fields: string[];
            sibling_context: string[];
        };
        state_changes: string[];
    }>;
}

interface ProgressiveAnalysis {
    discovery: ComponentDiscovery;
    behaviors: BehaviorAnalysis;
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
     * Generate the complete analytics implementation with AI-driven analysis
     */
    async generate(input: GeneratorInput): Promise<GeneratorOutput> {
        console.log('🚀 Starting AI-powered generation for:', input.appKey);

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

        // Step 3: Progressive AI Analysis
        const analysis = await this.performProgressiveAnalysis(input);

        // Step 4: Ensure required fields in all events
        const eventsWithRequiredFields = this.ensureRequiredFields(analysis.events);

        // Step 5: Generate implementation with AI insights
        const output = await this.generateImplementation(input, eventsWithRequiredFields, analysis);

        // Step 6: Save to both cloud and local storage
        await this.saveOutput(output, input.repoId, input.appKey);

        return output;
    }

    /**
     * Perform progressive AI analysis of components and behaviors
     */
    private async performProgressiveAnalysis(input: GeneratorInput): Promise<ProgressiveAnalysis> {
        console.log('🤖 Starting progressive AI analysis...');

        // Phase 1: Discover components
        const discovery = await this.discoverComponentsWithAI(input);
        console.log(`📊 Discovered ${discovery.components.length} interactive components`);

        // Phase 2: Analyze behaviors
        const behaviors = await this.analyzeBehaviorsWithAI(input, discovery);
        console.log(`🔍 Analyzed ${behaviors.patterns.length} behavior patterns`);

        // Phase 3: Generate optimized events schema
        const events = await this.generateEventsFromAnalysis(discovery, behaviors);

        // Phase 4: Create UI graph
        const uiGraph = await this.generateUIGraphWithAI(input, discovery, behaviors);

        return {
            discovery,
            behaviors,
            events,
            uiGraph
        };
    }

    /**
     * AI-driven component discovery with intelligent pattern recognition
     */
    private async discoverComponentsWithAI(input: GeneratorInput): Promise<ComponentDiscovery> {
        if (!input.files || input.files.length === 0) {
            return { components: [], framework: 'unknown' };
        }

        const codeContent = input.files.slice(0, 20).map((f: FileContent) =>
            `=== File: ${f.path} ===\n${f.content.slice(0, 3000)}\n`
        ).join('\n').slice(0, 40000);

        const systemPrompt = `You are an expert UI component analyzer. 
Analyze code to identify ALL interactive components, not just standard HTML elements.
Use context clues from the code to understand component purposes.
Focus on understanding the actual implementation, not theoretical possibilities.
Return ONLY valid JSON.`;

        const userPrompt = `Analyze this code and identify ALL interactive UI components.

INTELLIGENT DETECTION INSTRUCTIONS:
Look at the actual values and context in the code to understand component purposes. These are EXAMPLES, not a complete list:

1. **Infer selector types from their values:**
   - If you see options like "red", "blue", "#FF5733" → likely a color selector
   - If you see "S", "M", "L", "XL", "small", "large" → likely a size selector  
   - If you see "1", "2", "3" or +/- buttons with numbers → likely quantity control
   - If you see "cotton", "polyester", "silk" → likely material selector
   - If you see dates, times, calendars → likely date/time picker
   - Use your understanding to categorize any other value patterns you find

2. **Understand purpose from handler names:**
   - onClick={handleAddToCart} → cart functionality
   - onClick={toggleWishlist} → wishlist functionality
   - onChange={updateQuantity} → quantity control
   - onSubmit={processPayment} → payment processing
   - The function name usually describes what it does

3. **Use context clues from classes and IDs:**
   - className="product-card__wishlist-btn" → wishlist button for products
   - id="size-selector-modal" → size selection in a modal
   - className="nav-menu-toggle" → navigation menu control
   - Look for descriptive naming patterns in the code

4. **Check surrounding elements for context:**
   - A heart icon near product info → likely wishlist
   - Plus/minus buttons near a number → likely quantity
   - Swatches near product images → likely color selection
   - Stars near text → likely rating system

5. **Look for aria-labels and data attributes:**
   - aria-label="Add to shopping cart" → clear purpose
   - data-action="remove-item" → describes the action
   - data-product-id="123" → shows what context is available

6. **Identify patterns in component composition:**
   - Multiple similar buttons in a row → likely option selectors
   - Form with email/password → likely authentication
   - Grid of cards with images/prices → likely product listing

Remember: These are just examples. Use your understanding to identify ANY interactive pattern you find in the code, even if it's not listed here.

COMPREHENSIVE DETECTION GUIDE:

STANDARD CLICKABLE ELEMENTS:
- HTML: <button>, <a>, <input type="submit">, <input type="button">
- React/Vue: <Button>, <Link>, <IconButton>, <ActionButton>
- Attributes: onClick, @click, v-on:click, (click), ng-click
- Role attributes: role="button", role="link", tabindex="0" with onClick
- Custom components: Any component with "Button", "Btn", "Link" in name
- Icons with handlers: <svg onClick>, <Icon onClick>, any icon component
- Divs/Spans: <div onClick>, <span onClick>, elements with cursor:pointer
- Special classes: class containing "clickable", "btn", "button", "link"

CUSTOM COMPONENTS TO IDENTIFY:
- Framework components (Button, Link, IconButton, Card)
- Custom components with click/change handlers
- Icon components (HeartIcon, CartIcon, WishlistIcon, etc.)
- Styled components with interactions
- HOCs and wrapper components
- Components with cursor:pointer or interactive styling

SELECTION ELEMENTS:
- Color/size/variant selectors (ColorPicker, SizeSelector, VariantButtons)
- Radio buttons, checkboxes for options
- Dropdown selects for choices
- Quantity inputs (QuantitySelector, NumberInput)
- Any element that represents a user choice/selection

FORM ELEMENTS:
- HTML: <form>, <input>, <select>, <textarea>
- React: <Form>, controlled inputs with onChange/value
- Vue: v-model, @submit, v-on:submit
- Custom form components (FormField, InputField, TextInput)
- Validation: error states, validation messages, required fields

UI COMPONENTS:
- Modals/Dialogs: Modal, Dialog, Popup, Overlay, role="dialog"
- Tabs: Tab, TabPanel, role="tab"
- Accordions: Accordion, Collapsible, expand/collapse
- Dropdowns: Select, Dropdown, Combobox
- Search: SearchBar, SearchInput, SearchBox
- Filters: FilterPanel, filter controls, FilterButton
- Pagination: Pagination, "next", "previous", PageNumbers

NAVIGATION PATTERNS:
- Router links: Link, NavLink, RouterLink
- Menu items: MenuItem, NavItem, NavigationItem
- Back buttons: history.back(), BackButton, ReturnButton

For each component found:
1. Create SPECIFIC selectors that won't match everything (use classes, IDs, data attributes)
2. Look at the actual onClick handler name to understand purpose
3. Check the actual values/options to categorize
4. Use parent element context to create more specific selectors
5. Only include components that actually appear in the code

CODE:
${codeContent}

Return this EXACT JSON structure:
{
  "framework": "react|vue|angular|vanilla|unknown",
  "components": [
    {
      "name": "component_name_from_code",
      "type": "button|link|icon|form_input|toggle|selector|custom",
      "selector_patterns": ["SPECIFIC CSS selectors - use classes, IDs, not just tag names"],
      "interaction_type": "click|change|toggle|submit|hover",
      "likely_purpose": "Be specific based on handler names and context",
      "context_needed": ["product_id", "selected_state", "form_data", "etc"],
      "code_patterns": ["Actual patterns found in the code"],
      "actual_values": ["Actual option values if it's a selector (colors, sizes, etc.)"]
    }
  ]
}

Include ALL interactive elements found, both standard HTML and custom components.
Make selectors SPECIFIC to avoid matching everything.`;

        try {
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
            const parsed = this.extractJSON(content);

            return parsed as ComponentDiscovery;
        } catch (error) {
            console.error('❌ Component discovery failed:', error);
            return { components: [], framework: 'unknown' };
        }
    }

    /**
     * AI-driven behavior analysis
     */
    private async analyzeBehaviorsWithAI(
        input: GeneratorInput,
        discovery: ComponentDiscovery
    ): Promise<BehaviorAnalysis> {
        if (!input.files || discovery.components.length === 0) {
            return { patterns: [] };
        }

        const codeContent = input.files.slice(0, 15).map((f: FileContent) =>
            `=== File: ${f.path} ===\n${f.content.slice(0, 2000)}\n`
        ).join('\n').slice(0, 30000);

        const systemPrompt = `You are an expert in understanding UI component behaviors and data flow.
Analyze how components interact and what context they need.
Return ONLY valid JSON.`;

        const userPrompt = `Given these discovered components:
${JSON.stringify(discovery.components, null, 2)}

Analyze the code to understand:
1. What data each component needs from its context
2. Where to find that context (parent elements, siblings, data attributes)
3. What state changes occur on interaction
4. Component relationships and dependencies

CODE:
${codeContent}

Return behavior patterns as JSON:
{
  "patterns": [
    {
      "component": "component_name_from_discovery",
      "context_collection": {
        "search_parents": [".product-card", "[data-product]", "form"],
        "extract_fields": ["product-id", "price", "selected-color"],
        "sibling_context": ["input[name='size']", ".color-selector.active"],
        "data_attributes": ["data-product-id", "data-sku"]
      },
      "state_changes": ["toggles_class", "updates_cart", "navigates_to"],
      "triggers_events": ["form_submit", "api_call", "state_update"]
    }
  ]
}`;

        try {
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
            const parsed = this.extractJSON(content);

            return parsed as BehaviorAnalysis;
        } catch (error) {
            console.error('❌ Behavior analysis failed:', error);
            return { patterns: [] };
        }
    }

    /**
     * Generate events schema from AI analysis
     */
    private async generateEventsFromAnalysis(
        discovery: ComponentDiscovery,
        behaviors: BehaviorAnalysis
    ): Promise<EventSchema[]> {
        // Always include base events
        const events: EventSchema[] = [
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
                name: 'element_click',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'element_text', 'element_type'],
                optional: ['element_id', 'element_class', 'element_location', 'context', 'component_name', 'page_title', 'page_url'],
                properties: {
                    element_text: 'string',
                    element_type: 'string',
                    element_id: 'string',
                    element_class: 'string',
                    element_location: 'string',
                    component_name: 'string',
                    context: 'object',
                    page_title: 'string',
                    page_url: 'string'
                },
                possible_values: {
                    element_type: Array.from(new Set(discovery.components.map(c => c.type)))
                }
            },
            {
                name: 'selection_change',
                required: ['app_key', 'session_id', 'user_id', 'ts', 'selection_type', 'selection_value'],
                optional: ['selection_name', 'previous_value', 'component_name', 'page_title', 'page_url'],
                properties: {
                    selection_type: 'string',
                    selection_value: 'string',
                    selection_name: 'string',
                    previous_value: 'string',
                    component_name: 'string',
                    page_title: 'string',
                    page_url: 'string'
                },
                possible_values: {}
            }
        ];

        // Add discovered interaction-specific events
        const interactionTypes = new Set(discovery.components.map(c => c.interaction_type));

        if (interactionTypes.has('submit') || discovery.framework === 'react') {
            events.push(
                {
                    name: 'form_started',
                    required: ['app_key', 'session_id', 'user_id', 'ts', 'form_name', 'page_title'],
                    optional: ['form_id', 'first_field_focused', 'context', 'page_url'],
                    properties: {
                        form_name: 'string',
                        form_id: 'string',
                        first_field_focused: 'string',
                        context: 'object',
                        page_title: 'string',
                        page_url: 'string'
                    },
                    possible_values: {}
                },
                {
                    name: 'form_submitted',
                    required: ['app_key', 'session_id', 'user_id', 'ts', 'form_name', 'success', 'page_title'],
                    optional: ['form_id', 'error_message', 'duration_seconds', 'fields_interacted', 'context', 'page_url'],
                    properties: {
                        form_name: 'string',
                        form_id: 'string',
                        success: 'boolean',
                        duration_seconds: 'number',
                        fields_interacted: 'number',
                        error_message: 'string',
                        context: 'object',
                        page_title: 'string',
                        page_url: 'string'
                    },
                    possible_values: {}
                }
            );
        }

        // Always add scroll depth
        events.push({
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
        });

        return events;
    }

    /**
     * Generate UI graph with only pages, modals, routes, and widgets
     */
    private async generateUIGraphWithAI(
        input: GeneratorInput,
        discovery: ComponentDiscovery,
        behaviors: BehaviorAnalysis
    ): Promise<any> {
        const routes = input.routes || ['/'];
        const pages: any = {};

        // Create simplified page entries without component lists
        routes.forEach((route: string) => {
            const pageName = this.routeToPageName(route);

            // Determine which types of widgets/modals might be on this page based on route
            const pageType = this.determinePageType(route);

            pages[pageName] = {
                route,
                page_type: pageType,
                widgets: this.getWidgetsForPageType(pageType),
                modals: this.getModalsForPageType(pageType),
                can_navigate_to: routes.filter((r: string) => r !== route).map((r: string) => this.routeToPageName(r)),
                events: ['page_view', 'element_click', 'selection_change', 'scroll_depth'],
                ai_insights: {
                    framework: discovery.framework,
                    interaction_types: Array.from(new Set(discovery.components.map(c => c.interaction_type))),
                    has_forms: pageType.includes('auth') || pageType.includes('checkout'),
                    has_product_interactions: pageType.includes('product') || route === '/'
                }
            };
        });

        return {
            app_key: input.appKey,
            framework: discovery.framework,
            relationships: [],
            pages,
            widgets: this.identifyGlobalWidgets(discovery),
            modals: this.identifyModals(discovery)
        };
    }

    /**
     * Determine page type based on route
     */
    private determinePageType(route: string): string {
        if (route === '/') return 'home';
        if (route.includes('product')) return 'product_detail';
        if (route.includes('cart')) return 'cart';
        if (route.includes('checkout')) return 'checkout';
        if (route.includes('auth') || route.includes('login') || route.includes('register')) return 'auth';
        if (route.includes('wishlist')) return 'wishlist';
        if (route.includes('about') || route.includes('shipping') || route.includes('returns')) return 'info';
        return 'general';
    }

    /**
     * Get widgets that should appear on specific page types
     */
    private getWidgetsForPageType(pageType: string): string[] {
        const widgets: string[] = ['header', 'footer'];

        switch (pageType) {
            case 'home':
                widgets.push('product_carousel', 'featured_products', 'search_bar');
                break;
            case 'product_detail':
                widgets.push('product_gallery', 'product_options', 'add_to_cart', 'reviews');
                break;
            case 'cart':
                widgets.push('cart_items', 'cart_summary', 'checkout_button');
                break;
            case 'checkout':
                widgets.push('checkout_form', 'order_summary');
                break;
            case 'auth':
                widgets.push('auth_form');
                break;
            case 'wishlist':
                widgets.push('wishlist_grid');
                break;
        }

        return widgets;
    }

    /**
     * Get modals that might appear on specific page types
     */
    private getModalsForPageType(pageType: string): string[] {
        const modals: string[] = [];

        if (pageType === 'product_detail') {
            modals.push('size_guide', 'quick_view');
        }
        if (pageType === 'cart' || pageType === 'checkout') {
            modals.push('promo_code', 'shipping_info');
        }
        if (pageType === 'auth') {
            modals.push('forgot_password');
        }

        return modals;
    }

    /**
     * Identify global widgets from discovered components
     */
    private identifyGlobalWidgets(discovery: ComponentDiscovery): string[] {
        const widgets = new Set<string>();

        discovery.components.forEach(comp => {
            if (comp.name.toLowerCase().includes('header')) widgets.add('header');
            if (comp.name.toLowerCase().includes('footer')) widgets.add('footer');
            if (comp.name.toLowerCase().includes('nav')) widgets.add('navigation');
            if (comp.name.toLowerCase().includes('search')) widgets.add('search_bar');
            if (comp.name.toLowerCase().includes('cart') && comp.type === 'icon') widgets.add('cart_icon');
        });

        return Array.from(widgets);
    }

    /**
     * Identify modals from discovered components
     */
    private identifyModals(discovery: ComponentDiscovery): string[] {
        const modals = new Set<string>();

        discovery.components.forEach(comp => {
            if (comp.name.toLowerCase().includes('modal')) modals.add(comp.name);
            if (comp.name.toLowerCase().includes('dialog')) modals.add(comp.name);
            if (comp.name.toLowerCase().includes('popup')) modals.add(comp.name);
        });

        return Array.from(modals);
    }

    /**
     * Generate implementation with AI-driven insights
     */
    private async generateImplementation(
        input: GeneratorInput,
        events: EventSchema[],
        analysis: ProgressiveAnalysis
    ): Promise<GeneratorOutput> {
        const backend = input.backendUrl || 'http://localhost:8082/ingest/analytics';

        return {
            'tracker.js': this.generateAIEnhancedTracker(input.appKey, backend, analysis),
            'events-schema.json': {
                required_fields: {
                    app_key: { type: 'string', source: 'config' },
                    session_id: { type: 'string', source: 'sessionStorage' },
                    user_id: { type: 'string', source: 'context', nullable: false, description: '8-10 digit integer ID' },
                    ts: { type: 'timestamp', source: 'generated' }
                },
                events: events.map(e => ({
                    type: e.name,
                    required: e.required,
                    optional: e.optional,
                    properties: e.properties || {},
                    possible_values: e.possible_values || {}
                })),
                ai_components: analysis.discovery.components,
                ai_patterns: analysis.behaviors.patterns
            },
            'ui-graph.json': analysis.uiGraph,
            'analytics-provider.tsx': this.generateProvider(input.appKey),
            'analytics.types.ts': this.generateTypes(events),
            'integration-guide.md': this.generateIntegrationGuide(input.appKey, events, analysis),
            metadata: {
                generatedAt: new Date().toISOString(),
                appKey: input.appKey,
                eventCount: events.length,
                frameworksDetected: [analysis.discovery.framework]
            }
        };
    }

    /**
     * Generate AI-enhanced tracker with user ID management
     */
    private generateAIEnhancedTracker(
        appKey: string,
        endpoint: string,
        analysis: ProgressiveAnalysis
    ): string {
        // Generate component detectors from AI analysis
        const componentDetectors = analysis.discovery.components.map(comp => {
            const pattern = analysis.behaviors.patterns.find(p => p.component === comp.name);
            return `
        {
            name: '${comp.name}',
            type: '${comp.type}',
            selectors: ${JSON.stringify(comp.selector_patterns)},
            purpose: '${comp.likely_purpose}',
            contextNeeded: ${JSON.stringify(comp.context_needed)},
            contextCollection: ${pattern ? JSON.stringify(pattern.context_collection) : 'null'}
        }`;
        }).join(',\n');

        return `(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Analytics = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  
  // ============ USER ID GENERATOR ============
  class UserIdGenerator {
    constructor() {
      this.STORAGE_KEY = 'analytics_user_id';
      this.userId = null;
    }

    init() {
      this.userId = this.getOrCreateUserId();
      return this.userId;
    }

    getOrCreateUserId() {
      // Try to get existing user ID from storage
      let userId = this.getFromStorage();
      
      if (!userId) {
        // Generate new 8-10 digit integer ID
        userId = this.generateUserId();
        this.saveToStorage(userId);
      }
      
      return userId;
    }

generateUserId() {
      // Generate a random 8-10 digit integer
      const min = 10000000;   // 8 digits minimum
      const max = 9999999999;  // 10 digits maximum
      
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // Use crypto for better randomness
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        
        // Scale the random value to our range
        const randomNum = min + (array[0] % (max - min + 1));
        return Math.abs(randomNum).toString();
      }
      
      // Fallback for older browsers
      const randomNum = min + Math.floor(Math.random() * (max - min + 1));
      return randomNum.toString();
    }

    getFromStorage() {
      // Try multiple storage methods for resilience
      try {
        // Try localStorage first (most persistent)
        const localStorageId = localStorage.getItem(this.STORAGE_KEY);
        if (localStorageId) return localStorageId;
      } catch (e) {
        console.debug('localStorage not available');
      }
      
      try {
        // Try cookies
        const cookieMatch = document.cookie.match(new RegExp('(^| )' + this.STORAGE_KEY + '=([^;]+)'));
        if (cookieMatch) return cookieMatch[2];
      } catch (e) {
        console.debug('Cookies not available');
      }
      
      try {
        // Fallback to sessionStorage (least persistent)
        return sessionStorage.getItem(this.STORAGE_KEY);
      } catch (e) {
        return null;
      }
    }

    saveToStorage(userId) {
      // Save to multiple storage locations for resilience
      try {
        localStorage.setItem(this.STORAGE_KEY, userId);
        localStorage.setItem(this.STORAGE_KEY + '_created', new Date().toISOString());
      } catch (e) {
        console.debug('localStorage write failed');
      }
      
      try {
        // Set cookie with 1 year expiration
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        document.cookie = this.STORAGE_KEY + '=' + userId + '; expires=' + expires.toUTCString() + '; path=/; SameSite=Lax';
      } catch (e) {
        console.debug('Cookie write failed');
      }
      
      try {
        sessionStorage.setItem(this.STORAGE_KEY, userId);
      } catch (e) {
        console.debug('sessionStorage write failed');
      }
    }
  }
  
  // ============ MAIN ANALYTICS TRACKER ============
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
      this.userIdGenerator = new UserIdGenerator();
      this.userId = this.userIdGenerator.init();
      this.pageLoadTime = Date.now();
      this.maxScrollDepth = 0;
      this.formTracking = new WeakMap();
      this.clickedElements = new WeakSet();
      this.pageContext = {};
      
      // AI-discovered component patterns
      this.componentDetectors = [${componentDetectors}
      ];
      
      if (typeof window !== 'undefined') {
        this.setupListeners();
        this.startFlushTimer();
        this.initAutoTracking();
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

    // ============ AI-ENHANCED AUTO-TRACKING ============
    initAutoTracking() {
      console.log('🤖 AI-Enhanced Analytics initialized for ${appKey}');
      console.log('📊 Tracking ${analysis.discovery.components.length} discovered components');
      console.log('🔑 User ID:', this.userId);
      
      this.trackPageView();
      this.trackAllClicks();
      this.trackSelectionChanges();
      this.trackFormInteractions();
      this.trackScrollDepth();
      this.trackRouteChanges();
    }

    // Detect component using AI-discovered patterns
    detectComponent(element) {
      for (const detector of this.componentDetectors) {
        for (const selector of detector.selectors) {
          try {
            if (element.matches(selector) || element.closest(selector)) {
              return detector;
            }
          } catch (e) {
            // Invalid selector, skip
          }
        }
      }
      return null;
    }

    // Collect context using AI-discovered patterns
    collectContextWithAI(element, componentInfo) {
      const context = {};
      
      if (!componentInfo || !componentInfo.contextCollection) {
        return this.collectGenericContext(element);
      }
      
      const collection = componentInfo.contextCollection;
      
      // Search parent containers
      if (collection.search_parents) {
        for (const parentSelector of collection.search_parents) {
          const parent = element.closest(parentSelector);
          if (parent) {
            // Extract specified fields
            if (collection.extract_fields) {
              for (const field of collection.extract_fields) {
                const value = parent.dataset[field] || 
                             parent.querySelector(\`[data-\${field}]\`)?.dataset[field];
                if (value) context[field] = value;
              }
            }
            break;
          }
        }
      }
      
      // Get sibling context
      if (collection.sibling_context) {
        const container = element.closest('.product, .card, form, section') || document.body;
        for (const siblingSelector of collection.sibling_context) {
          const sibling = container.querySelector(siblingSelector);
          if (sibling) {
            const contextKey = siblingSelector.includes('color') ? 'color' :
                             siblingSelector.includes('size') ? 'size' :
                             siblingSelector.includes('quantity') ? 'quantity' : 'value';
            context[contextKey] = sibling.value || sibling.textContent || sibling.dataset.value;
          }
        }
      }
      
      return Object.keys(context).length > 0 ? context : null;
    }

    // Fallback to generic context collection
    collectGenericContext(element) {
      const context = {};
      const container = element.closest('.product, .product-card, .item, .card, form, section, article') || document.body;
      
      // Try common patterns
      const patterns = {
        color: ['[data-color].selected', 'input[name="color"]:checked', '[class*="color"][class*="active"]'],
        size: ['[data-size].selected', 'input[name="size"]:checked', 'select[name="size"]'],
        quantity: ['input[type="number"][name*="qty"]', 'input[type="number"][name*="quantity"]', 'select[name*="quantity"]'],
        product_id: ['[data-product-id]', '[data-sku]', '[data-item-id]'],
        price: ['[data-price]', '.price', '.product-price']
      };
      
      for (const [key, selectors] of Object.entries(patterns)) {
        for (const selector of selectors) {
          const el = container.querySelector(selector);
          if (el) {
            const value = el.value || el.dataset[key.replace('_', '-')] || el.textContent?.trim();
            if (value) {
              context[key] = key === 'price' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
              break;
            }
          }
        }
      }
      
      return Object.keys(context).length > 0 ? context : null;
    }

    // Enhanced click tracking with AI component detection
    trackAllClicks() {
      document.addEventListener('click', (e) => {
        const target = e.target;
        
        if (this.clickedElements.has(target)) return;
        this.clickedElements.add(target);
        setTimeout(() => this.clickedElements.delete(target), 100);
        
        // Try AI component detection first
        const componentInfo = this.detectComponent(target);
        
        // Find clickable element
        const clickable = target.closest(\`
          button, [role="button"], [onclick], input[type="submit"], input[type="button"],
          [class*="button"], [class*="btn"], svg, [class*="icon"], [data-clickable],
          [style*="cursor: pointer"], a
        \`);
        
        if (clickable || componentInfo) {
          const element = clickable || target;
          
          // Skip regular link handling if it's a link
          if (element.tagName === 'A' && element.href && !componentInfo) {
            this.trackLinkClick(element);
            return;
          }
          
          // Collect context with AI insights
          const context = componentInfo 
            ? this.collectContextWithAI(element, componentInfo)
            : this.collectGenericContext(element);
          
          this.trackEvent('element_click', {
            element_text: this.getElementText(element).slice(0, 100),
            element_type: componentInfo?.type || this.getElementType(element),
            component_name: componentInfo?.name || null,
            component_purpose: componentInfo?.purpose || null,
            element_id: element.id || null,
            element_class: element.className || null,
            element_location: this.getElementLocation(element),
            context: context,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      }, true);
    }

    trackSelectionChanges() {
      document.addEventListener('click', (e) => {
        const target = e.target;
        const componentInfo = this.detectComponent(target);
        
        const isSelection = target.matches(\`
          [data-color], [data-size], [data-variant], [data-option],
          input[type="radio"], input[type="checkbox"]
        \`) || componentInfo?.purpose === 'selection';
        
        if (isSelection) {
          const selectionType = this.getSelectionType(target);
          const selectionValue = this.getSelectionValue(target);
          const selectionName = target.name || target.dataset.optionName || selectionType;
          
          const previousValue = this.pageContext[selectionName] || null;
          this.pageContext[selectionName] = selectionValue;
          
          this.trackEvent('selection_change', {
            selection_type: selectionType,
            selection_value: selectionValue,
            selection_name: selectionName,
            previous_value: previousValue,
            component_name: componentInfo?.name || null,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      });
      
      document.addEventListener('change', (e) => {
        const target = e.target;
        const componentInfo = this.detectComponent(target);
        
        if (target.tagName === 'SELECT' || target.tagName === 'INPUT') {
          const selectionType = this.getSelectionType(target);
          const selectionValue = target.value;
          const selectionName = target.name || target.id || selectionType;
          
          const previousValue = this.pageContext[selectionName] || null;
          this.pageContext[selectionName] = selectionValue;
          
          this.trackEvent('selection_change', {
            selection_type: selectionType,
            selection_value: selectionValue,
            selection_name: selectionName,
            previous_value: previousValue,
            component_name: componentInfo?.name || null,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      });
    }

    trackLinkClick(link) {
      const linkText = (link.innerText || link.getAttribute('aria-label') || 'Unknown').trim();
      const linkHref = link.getAttribute('href') || '';
      const isExternal = linkHref.startsWith('http') && !linkHref.includes(window.location.hostname);
      const componentInfo = this.detectComponent(link);
      const context = componentInfo 
        ? this.collectContextWithAI(link, componentInfo)
        : this.collectGenericContext(link);
      
      this.trackEvent('element_click', {
        element_text: linkText.slice(0, 100),
        element_type: 'link',
        component_name: componentInfo?.name || null,
        element_id: link.id || null,
        element_class: link.className || null,
        element_location: this.getElementLocation(link),
        context: context,
        link_href: linkHref,
        is_external: isExternal,
        page_title: document.title,
        page_url: window.location.pathname
      });
    }

    getSelectionType(element) {
      if (element.dataset.color) return 'color';
      if (element.dataset.size) return 'size';
      if (element.dataset.variant) return 'variant';
      
      const name = (element.name || '').toLowerCase();
      if (name.includes('color')) return 'color';
      if (name.includes('size')) return 'size';
      if (name.includes('variant')) return 'variant';
      if (name.includes('quantity')) return 'quantity';
      
      return element.type === 'number' ? 'quantity' : 'other';
    }

    getSelectionValue(element) {
      return element.value || 
             element.dataset.value ||
             element.textContent?.trim() ||
             'unknown';
    }

    getElementText(element) {
      return element.innerText || 
             element.textContent ||
             element.value ||
             element.getAttribute('aria-label') ||
             element.getAttribute('title') ||
             'Unknown';
    }

    getElementType(element) {
      if (element.tagName === 'BUTTON') return 'button';
      if (element.tagName === 'A') return 'link';
      if (element.tagName === 'INPUT') return element.type || 'input';
      if (element.tagName === 'SVG' || element.querySelector('svg')) return 'icon';
      return element.tagName.toLowerCase();
    }

    getElementLocation(element) {
      const section = element.closest('header, main, footer, aside, nav, section');
      return section ? section.tagName.toLowerCase() : 'unknown';
    }

    trackFormInteractions() {
      document.addEventListener('focusin', (e) => {
        const field = e.target;
        const form = field.closest('form');
        
        if (form && !this.formTracking.has(form)) {
          const componentInfo = this.detectComponent(form);
          const context = componentInfo 
            ? this.collectContextWithAI(form, componentInfo)
            : this.collectGenericContext(form);
          
          this.formTracking.set(form, {
            started: true,
            startTime: Date.now(),
            fieldsInteracted: new Set()
          });
          
          this.trackEvent('form_started', {
            form_name: this.getFormName(form),
            form_id: form.id || null,
            first_field_focused: field.name || field.id || field.type,
            context: context,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
        
        if (form && this.formTracking.has(form)) {
          const tracking = this.formTracking.get(form);
          tracking.fieldsInteracted.add(field.name || field.id || field.type);
        }
      });

      document.addEventListener('submit', (e) => {
        const form = e.target;
        const tracking = this.formTracking.get(form);
        const componentInfo = this.detectComponent(form);
        const context = componentInfo 
          ? this.collectContextWithAI(form, componentInfo)
          : this.collectGenericContext(form);
        
        this.trackEvent('form_submitted', {
          form_name: this.getFormName(form),
          form_id: form.id || null,
          success: true,
          duration_seconds: tracking ? Math.round((Date.now() - tracking.startTime) / 1000) : null,
          fields_interacted: tracking ? tracking.fieldsInteracted.size : null,
          context: context,
          page_title: document.title,
          page_url: window.location.pathname
        });
        
        this.formTracking.delete(form);
      });
    }

    getFormName(form) {
      return form.getAttribute('name') || 
             form.getAttribute('aria-label') ||
             form.id ||
             'form';
    }

    trackScrollDepth() {
      let scrollTimer;
      
      const checkScrollDepth = () => {
        const scrollPercent = Math.round(
          (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100
        );
        
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
    }

    trackRouteChanges() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        setTimeout(() => {
          this.pageContext = {};
          this.trackPageView();
        }, 0);
      };
      
      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        setTimeout(() => {
          this.pageContext = {};
          this.trackPageView();
        }, 0);
      };
      
      window.addEventListener('popstate', () => {
        this.pageContext = {};
        this.trackPageView();
      });
    }

    // ============ CORE METHODS ============
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
      // Update the user ID if explicitly identified
      if (userId) {
        this.userId = userId;
        this.userIdGenerator.saveToStorage(userId);
      }
      this.trackEvent('identify', { user_id: this.userId, traits });
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
        this.eventQueue.unshift(...batch);
      });
    }
  }

  // Auto-initialize
  if (typeof window !== 'undefined' && !window.analytics) {
    window.analytics = new AnalyticsTracker();
    console.log('✅ AI-Enhanced Analytics tracker with User ID initialized');
  }

  return AnalyticsTracker;
}));`;
    }

    /**
     * Helper to extract JSON from LLM response
     */
    private extractJSON(content: string): any {
        // Try to find JSON in markdown code blocks
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1]);
        }

        // Try to find raw JSON
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}') + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
            return JSON.parse(content.slice(jsonStart, jsonEnd));
        }

        throw new Error('No valid JSON found in response');
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
     * Extract routes from file system structure
     */
    private extractRoutesFromFiles(files: FileContent[]): string[] {
        const routes = new Set<string>();
        routes.add('/');

        for (const file of files) {
            if (file.path === 'page.tsx' ||
                file.path === './page.tsx' ||
                file.path === 'src/page.tsx' ||
                file.path === 'app/page.tsx') {
                continue;
            }

            // Next.js App Router
            if (file.path.includes('app/') && file.path.endsWith('page.tsx')) {
                const route = '/' + file.path
                    .replace(/^.*?app\//, '')
                    .replace(/\/page\.(tsx|jsx|js)$/, '')
                    .replace(/\[.*?\]/g, ':param');

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
     * Save output with proper UTF-8 encoding
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
  user_id: string;
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

    private generateIntegrationGuide(
        appKey: string,
        events: EventSchema[],
        analysis: ProgressiveAnalysis
    ): string {
        return `# AI-Enhanced Analytics Integration Guide for ${appKey}

## 🤖 AI-Discovered Components

The AI analyzed your application and found:
- **Framework:** ${analysis.discovery.framework}
- **Interactive Components:** ${analysis.discovery.components.length}
- **Behavior Patterns:** ${analysis.behaviors.patterns.length}

### Discovered Components:
${analysis.discovery.components.map(c => `- **${c.name}** (${c.type}): ${c.likely_purpose}`).join('\n')}

## 🚀 One-Line Setup

Just add this single line to your HTML:

\`\`\`html
<script src="/tracker.js"></script>
\`\`\`

**That's it!** The AI-enhanced tracker automatically adapts to your components.

## 🔑 User ID System

The tracker automatically generates and persists user IDs:
- **Format:** 8-10 digit integer (e.g., 87654321)
- **Persistence:** 1-2 years across sessions
- **Storage:** localStorage, cookies, and sessionStorage for resilience
- **Privacy:** No personal information, just anonymous integers

## ✨ Auto-Tracked Events

### 📊 User Interactions
- **element_click** - All interactive elements with AI-detected context
- **selection_change** - Option selections with component awareness
- **form_started/submitted** - Form interactions with smart field detection

### 📱 Navigation & Engagement
- **page_view** - Page loads and route changes
- **scroll_depth** - User engagement tracking (25%, 50%, 75%, 100%)

## 📈 Event Details

${events.map(e => {
            const mainProps = e.required.filter(r => !REQUIRED_FIELDS.includes(r as any));
            const optionalProps = e.optional || [];
            return `### ${e.name}
**Required:** ${mainProps.join(', ')}
${optionalProps.length > 0 ? `**Optional:** ${optionalProps.join(', ')}` : ''}`;
        }).join('\n\n')}

## 🔑 AI-Powered Context Collection

The tracker uses AI-discovered patterns to collect relevant context:
${analysis.behaviors.patterns.slice(0, 3).map(p =>
            `- **${p.component}**: Collects ${p.context_collection.extract_fields?.join(', ') || 'contextual data'}`
        ).join('\n')}

## 🧪 Testing Your Integration

1. **Open Browser Console**
   - Look for: "🤖 AI-Enhanced Analytics initialized"
   - Check: "📊 Tracking X discovered components"
   - See: "🔑 User ID: [8-10 digit number]"

2. **Interact With Components**
   - The AI recognizes your specific components
   - Context is collected based on learned patterns

3. **Monitor Network**
   - Filter by: \`/ingest/analytics\`
   - See AI-enhanced event data with user IDs

## 🎯 What Makes This Special?

- **AI-Powered** - Understands your specific components
- **Zero Configuration** - Just add the script
- **Smart User Tracking** - Persistent 8-10 digit user IDs
- **Adaptive** - Learns from your code patterns
- **Framework Aware** - Optimized for ${analysis.discovery.framework}
- **Context Smart** - Collects relevant data automatically

---

**Generated:** ${new Date().toISOString()}
**AI Model:** Claude 3 Haiku`;
    }
}

// Export singleton instance
export const analyticsGenerator = new AnalyticsIntelligenceGenerator();