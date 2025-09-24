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

// Required base fields that MUST be in every event
const REQUIRED_BASE_FIELDS = ['id', 'ts', 'app_key', 'session_id', 'user_id', 'event_type'] as const;

interface EventSchema {
  event_type: string;
  data_fields: {
    required: string[];
  };
  properties?: Record<string, any>;
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
  'entry-point.js'?: string;
  metadata: {
    generatedAt: string;
    appKey: string;
    eventCount: number;
    frameworksDetected: string[];
    entryPointFile?: string;
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

    // Step 4: Generate implementation with AI insights
    const output = await this.generateImplementation(input, analysis.events, analysis);

    // Step 5: Save to both cloud and local storage
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
   * Extract the main entry point file content
   */
  private async extractEntryPoint(input: GeneratorInput): Promise<{ filename: string; content: string } | null> {
    if (!input.files || input.files.length === 0) {
      return null;
    }

    // Priority order for finding entry point
    const entryPatterns = [
      /^app\.(tsx?|jsx?)$/,
      /^index\.(tsx?|jsx?)$/,
      /^main\.(tsx?|jsx?)$/,
      /^pages\/index\.(tsx?|jsx?)$/,
      /^src\/app\.(tsx?|jsx?)$/,
      /^src\/index\.(tsx?|jsx?)$/,
      /^app\/page\.(tsx?|jsx?)$/,
      /^pages\/home\.(tsx?|jsx?)$/
    ];

    for (const pattern of entryPatterns) {
      const entryFile = input.files.find(f => pattern.test(f.path));
      if (entryFile) {
        console.log(`📄 Found entry point: ${entryFile.path}`);
        return {
          filename: entryFile.path,
          content: entryFile.content
        };
      }
    }

    // Fallback: find first JSX/TSX file with React import
    const reactFile = input.files.find(f =>
      f.path.match(/\.(tsx?|jsx?)$/) &&
      f.content.includes('React') &&
      (f.content.includes('export default') || f.content.includes('ReactDOM'))
    );

    if (reactFile) {
      console.log(`📄 Found React entry point (fallback): ${reactFile.path}`);
      return {
        filename: reactFile.path,
        content: reactFile.content
      };
    }

    console.log('⚠️ No entry point file found');
    return null;
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
   * Generate events schema from AI analysis with new format
   */
  private async generateEventsFromAnalysis(
    discovery: ComponentDiscovery,
    behaviors: BehaviorAnalysis
  ): Promise<EventSchema[]> {
    const events: EventSchema[] = [
      {
        event_type: 'PAGE_VIEW',
        data_fields: {
          required: ['url', 'path', 'title', 'referrer', 'is_first_view', 'entry_type']
        },
        properties: {
          url: 'string',
          path: 'string',
          title: 'string',
          referrer: 'string | null',
          is_first_view: 'boolean',
          entry_type: '"navigation" | "reload" | "back_forward" | "spa_transition"'
        }
      },
      {
        event_type: 'BUTTON_CLICK',
        data_fields: {
          required: ['element_text', 'element_id', 'element_type', 'surface', 'page_path', 'is_primary_cta', 'cta_category']
        },
        properties: {
          element_text: 'string',
          element_id: 'string | null',
          element_type: '"button" | "link" | "icon" | "tab"',
          surface: 'string',
          page_path: 'string',
          is_primary_cta: 'boolean',
          cta_category: '"conversion" | "navigation" | "engagement"'
        }
      },
      {
        event_type: 'FORM_INTERACTION',
        data_fields: {
          required: ['action', 'form_name', 'form_id', 'form_type', 'surface', 'page_path', 'fields_total', 'fields_completed']
        },
        properties: {
          action: '"started" | "submitted" | "abandoned"',
          form_name: 'string',
          form_id: 'string | null',
          form_type: '"contact" | "signup" | "login" | "checkout" | "newsletter" | "other"',
          surface: 'string',
          page_path: 'string',
          fields_total: 'number',
          fields_completed: 'number'
        }
      },
      {
        event_type: 'ELEMENT_VISIBILITY',
        data_fields: {
          required: ['action', 'element_type', 'element_name', 'element_id', 'trigger_source', 'page_path', 'has_cta']
        },
        properties: {
          action: '"shown" | "hidden" | "dismissed"',
          element_type: '"modal" | "popup" | "drawer" | "tooltip" | "dropdown" | "toast" | "unknown"',
          element_name: 'string',
          element_id: 'string | null',
          trigger_source: '"button_click" | "auto_trigger" | "scroll_trigger" | "unknown"',
          page_path: 'string',
          has_cta: 'boolean'
        }
      },
      {
        event_type: 'SCROLL_INTERACTION',
        data_fields: {
          required: ['action', 'depth_percentage', 'milestone', 'page_path', 'direction']
        },
        properties: {
          action: '"depth_reached"',
          depth_percentage: 'number',
          milestone: '"25%" | "50%" | "75%" | "90%" | "100%" | "none"',
          page_path: 'string',
          direction: '"up" | "down"'
        }
      }
    ];

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
        events: ['PAGE_VIEW', 'BUTTON_CLICK', 'FORM_INTERACTION', 'SCROLL_INTERACTION'],
        ai_insights: {
          framework: discovery.framework,
          interaction_types: Array.from(new Set(discovery.components.map((c: any) => c.interaction_type))),
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

    discovery.components.forEach((comp: any) => {
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

    discovery.components.forEach((comp: any) => {
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

    // Extract entry point file
    const entryPoint = await this.extractEntryPoint(input);

    const output: GeneratorOutput = {
      'tracker.js': this.generateAIEnhancedTracker(input.appKey, backend, analysis),
      'events-schema.json': {
        base_fields: {
          id: { type: 'string', format: 'uuid', source: 'generated' },
          ts: { type: 'number', format: 'unix_timestamp', source: 'generated' },
          app_key: { type: 'string', source: 'config' },
          session_id: { type: 'string', source: 'sessionStorage' },
          user_id: { type: 'string', source: 'persistent_storage', description: '8-10 digit string' },
          event_type: { type: 'string', source: 'code' }
        },
        events: events.map(e => ({
          event_type: e.event_type,
          data_fields: e.data_fields.required,
          properties: e.properties || {}
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

    // Add entry point if found
    if (entryPoint) {
      output['entry-point.js'] = entryPoint.content;
      output.metadata.entryPointFile = entryPoint.filename;
      console.log(`✅ Added entry point: ${entryPoint.filename}`);
    }

    return output;
  }

  /**
   * Generate AI-enhanced tracker with user ID management and new event schema
   */
  private generateAIEnhancedTracker(
    appKey: string,
    endpoint: string,
    analysis: ProgressiveAnalysis
  ): string {
    // Generate component detectors from AI analysis
    const componentDetectors = analysis.discovery.components.map((comp: any) => {
      const pattern = analysis.behaviors.patterns.find((p: any) => p.component === comp.name);
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
      this.hasViewedPage = false;
      this.scrollDirection = 'down';
      this.lastScrollY = 0;
      this.reachedMilestones = new Set();
      this.formTracking = new WeakMap();
      this.clickedElements = new WeakSet();
      this.visibleElements = new WeakMap();
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
      this.trackFormInteractions();
      this.trackScrollDepth();
      this.trackRouteChanges();
      this.trackElementVisibility();
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

    // Enhanced click tracking with new BUTTON_CLICK event
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
          
          this.trackEvent('BUTTON_CLICK', {
            element_text: this.getElementText(element).slice(0, 100),
            element_id: element.id || null,
            element_type: this.getButtonType(element),
            surface: this.getSurface(element),
            page_path: window.location.pathname,
            is_primary_cta: this.isPrimaryCTA(element),
            cta_category: this.getCTACategory(element, componentInfo)
          });
        }
      }, true);
    }

    trackFormInteractions() {
      document.addEventListener('focusin', (e) => {
        const field = e.target;
        const form = field.closest('form');
        
        if (form && !this.formTracking.has(form)) {
          this.formTracking.set(form, {
            started: true,
            startTime: Date.now(),
            fieldsInteracted: new Set()
          });
          
          this.trackEvent('FORM_INTERACTION', {
            action: 'started',
            form_name: this.getFormName(form),
            form_id: form.id || null,
            form_type: this.getFormType(form),
            surface: this.getSurface(form),
            page_path: window.location.pathname,
            fields_total: form.elements ? form.elements.length : 0,
            fields_completed: 0
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
        
        this.trackEvent('FORM_INTERACTION', {
          action: 'submitted',
          form_name: this.getFormName(form),
          form_id: form.id || null,
          form_type: this.getFormType(form),
          surface: this.getSurface(form),
          page_path: window.location.pathname,
          fields_total: form.elements ? form.elements.length : 0,
          fields_completed: tracking ? tracking.fieldsInteracted.size : 0
        });
        
        this.formTracking.delete(form);
      });

      // Track form abandonment
      window.addEventListener('beforeunload', () => {
        this.formTracking.forEach((tracking, form) => {
          if (tracking.started && Date.now() - tracking.startTime > 1000) {
            this.trackEvent('FORM_INTERACTION', {
              action: 'abandoned',
              form_name: this.getFormName(form),
              form_id: form.id || null,
              form_type: this.getFormType(form),
              surface: this.getSurface(form),
              page_path: window.location.pathname,
              fields_total: form.elements ? form.elements.length : 0,
              fields_completed: tracking.fieldsInteracted.size
            });
          }
        });
      });
    }

    trackElementVisibility() {
      // Track modal/popup/dialog visibility
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'class' || 
               mutation.attributeName === 'style' || 
               mutation.attributeName === 'aria-hidden')) {
            
            const element = mutation.target;
            const isOverlay = this.isOverlayElement(element);
            
            if (isOverlay) {
              const isVisible = this.isElementVisible(element);
              const wasVisible = this.visibleElements.get(element);
              
              if (isVisible && !wasVisible) {
                this.visibleElements.set(element, true);
                this.trackEvent('ELEMENT_VISIBILITY', {
                  action: 'shown',
                  element_type: this.getOverlayType(element),
                  element_name: this.getElementName(element),
                  element_id: element.id || null,
                  trigger_source: 'auto_trigger',
                  page_path: window.location.pathname,
                  has_cta: this.hasCallToAction(element)
                });
              } else if (!isVisible && wasVisible) {
                this.visibleElements.set(element, false);
                this.trackEvent('ELEMENT_VISIBILITY', {
                  action: 'hidden',
                  element_type: this.getOverlayType(element),
                  element_name: this.getElementName(element),
                  element_id: element.id || null,
                  trigger_source: 'button_click',
                  page_path: window.location.pathname,
                  has_cta: this.hasCallToAction(element)
                });
              }
            }
          }
        });
      });

      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'style', 'aria-hidden']
      });
    }

    trackScrollDepth() {
      let scrollTimer;
      
      const checkScrollDepth = () => {
        const currentY = window.scrollY;
        this.scrollDirection = currentY > this.lastScrollY ? 'down' : 'up';
        this.lastScrollY = currentY;
        
        const scrollPercent = Math.round(
          (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100
        );
        
        const milestones = [25, 50, 75, 90, 100];
        const milestone = milestones.find(m => 
          m <= scrollPercent && !this.reachedMilestones.has(m)
        );
        
        if (milestone) {
          this.reachedMilestones.add(milestone);
          this.trackEvent('SCROLL_INTERACTION', {
            action: 'depth_reached',
            depth_percentage: milestone,
            milestone: milestone + '%',
            page_path: window.location.pathname,
            direction: this.scrollDirection
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
          this.reachedMilestones.clear();
          this.trackPageView();
        }, 0);
      };
      
      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        setTimeout(() => {
          this.pageContext = {};
          this.reachedMilestones.clear();
          this.trackPageView();
        }, 0);
      };
      
      window.addEventListener('popstate', () => {
        this.pageContext = {};
        this.reachedMilestones.clear();
        this.trackPageView();
      });
    }

    // ============ HELPER METHODS ============
    getElementText(element) {
      return element.innerText || 
             element.textContent ||
             element.value ||
             element.getAttribute('aria-label') ||
             element.getAttribute('title') ||
             'Unknown';
    }

    getElementName(element) {
      return element.getAttribute('aria-label') ||
             element.getAttribute('title') ||
             element.dataset.name ||
             element.id ||
             'unnamed';
    }

    getFormName(form) {
      return form.getAttribute('name') || 
             form.getAttribute('aria-label') ||
             form.id ||
             'form';
    }

    getEntryType() {
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const navType = performance.getEntriesByType('navigation')[0];
        if (navType && navType.type) {
          switch(navType.type) {
            case 'reload': return 'reload';
            case 'back_forward': return 'back_forward';
            default: return 'navigation';
          }
        }
      }
      return 'navigation';
    }

    getSurface(element) {
      const section = element.closest('header, nav, main, footer, aside, section[data-component], [data-surface]');
      if (section) {
        return section.dataset.surface || 
               section.dataset.component ||
               section.tagName.toLowerCase();
      }
      return 'unknown';
    }

    getButtonType(element) {
      if (element.tagName === 'A') return 'link';
      if (element.querySelector('svg') || (element.className && element.className.toString().includes('icon'))) return 'icon';
      if (element.getAttribute('role') === 'tab') return 'tab';
      return 'button';
    }

    isPrimaryCTA(element) {
      const classes = (element.className || '').toString().toLowerCase();
      return classes.includes('primary') || 
             classes.includes('cta') ||
             classes.includes('hero') ||
             element.dataset.primary === 'true';
    }

    getCTACategory(element, componentInfo) {
      const text = this.getElementText(element).toLowerCase();
      const purpose = componentInfo?.purpose || '';
      
      if (text.match(/buy|purchase|checkout|cart|order/)) return 'conversion';
      if (text.match(/learn|view|browse|explore|next|previous/)) return 'navigation';
      return 'engagement';
    }

    getFormType(form) {
      const formId = (form.id || '').toLowerCase();
      const formName = (form.name || '').toLowerCase();
      const inputs = form.elements ? Array.from(form.elements) : [];
      
      if (formId.includes('checkout') || formName.includes('checkout')) return 'checkout';
      if (formId.includes('login') || formName.includes('login')) return 'login';
      if (formId.includes('signup') || formName.includes('signup')) return 'signup';
      if (formId.includes('newsletter') || inputs.length === 1) return 'newsletter';
      if (formId.includes('contact') || formName.includes('contact')) return 'contact';
      
      return 'other';
    }

    getOverlayType(element) {
      const role = element.getAttribute('role');
      const classes = (element.className || '').toString().toLowerCase();
      
      if (role === 'dialog' || classes.includes('modal')) return 'modal';
      if (classes.includes('popup')) return 'popup';
      if (classes.includes('drawer')) return 'drawer';
      if (classes.includes('tooltip')) return 'tooltip';
      if (classes.includes('dropdown')) return 'dropdown';
      if (classes.includes('toast')) return 'toast';
      
      return 'unknown';
    }

    isOverlayElement(element) {
      const role = element.getAttribute('role');
      const classes = (element.className || '').toString().toLowerCase();
      
      return role === 'dialog' ||
             classes.includes('modal') ||
             classes.includes('popup') ||
             classes.includes('drawer') ||
             classes.includes('overlay') ||
             classes.includes('tooltip') ||
             classes.includes('dropdown') ||
             classes.includes('toast');
    }

    isElementVisible(element) {
      const style = window.getComputedStyle(element);
      const ariaHidden = element.getAttribute('aria-hidden');
      
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0' &&
             ariaHidden !== 'true' &&
             element.offsetParent !== null;
    }

    hasCallToAction(element) {
      return element.querySelector('button, a[href], [role="button"]') !== null;
    }

    // ============ CORE METHODS WITH NEW SCHEMA ============
    generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    trackEvent(eventType, data = {}) {
      // All 6 base fields are REQUIRED and NEVER null
      const event = {
        id: this.generateUUID(),                  // Always generated, never null
        ts: Math.floor(Date.now() / 1000),       // Unix timestamp, never null
        app_key: this.config.appKey,             // From config, never null
        session_id: this.sessionId,              // Generated on init, never null
        user_id: this.userId,                    // Generated/retrieved on init, never null
        event_type: eventType,                   // Passed parameter, never null
        data: data                               // Event-specific data object
      };
      
      this.eventQueue.push(event);
      
      if (this.eventQueue.length >= this.config.batchSize) {
        this.flush();
      }
    }

    trackPageView(page) {
      this.maxScrollDepth = 0;
      this.pageLoadTime = Date.now();
      
      this.trackEvent('PAGE_VIEW', {
        url: page?.url || window.location.href,
        path: window.location.pathname,
        title: page?.title || document.title,
        referrer: document.referrer || null,
        is_first_view: !this.hasViewedPage,
        entry_type: this.getEntryType()
      });
      
      this.hasViewedPage = true;
    }

    identify(userId, traits = {}) {
      // Update the user ID if explicitly identified
      if (userId) {
        this.userId = userId;
        this.userIdGenerator.saveToStorage(userId);
      }
      // Note: identify events are not part of the new schema, 
      // but keeping for backwards compatibility
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
    console.log('✅ AI-Enhanced Analytics tracker with new event schema initialized');
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
  /**
  * Load actual files from the repository or examples directory
  */
  public async loadRepositoryFiles(repoId: string): Promise<FileContent[]> {
    const files: FileContent[] = [];

    // First check if repoId is a file path from cloned repo
    if (repoId.startsWith('/')) {
      try {
        const stat = await fs.stat(repoId);
        if (stat.isDirectory()) {
          console.log(`📁 Loading files from cloned repository: ${repoId}`);
          const relevantFiles = await this.findRelevantFiles(repoId);

          console.log(`📂 Found ${relevantFiles.length} relevant files to analyze`);

          for (const filePath of relevantFiles.slice(0, CONFIG.MAX_FILES)) {
            try {
              const content = await fs.readFile(filePath, 'utf-8');
              const relativePath = path.relative(repoId, filePath);
              const truncatedContent = content.length > CONFIG.MAX_FILE_CONTENT_LENGTH
                ? content.slice(0, CONFIG.MAX_FILE_CONTENT_LENGTH) + '\n// ... truncated for analysis ...'
                : content;
              files.push({
                path: relativePath,
                content: truncatedContent
              });
            } catch (error) {
              console.error(`Failed to read file ${filePath}:`, error);
            }
          }

          console.log(`✅ Successfully loaded ${files.length} files from cloned repository`);

          // Log some sample files for debugging
          if (files.length > 0) {
            console.log(`📋 Sample files:`, files.slice(0, 5).map(f => f.path));
          }

          return files;
        }
      } catch (error) {
        console.log(`⚠️ ${repoId} is not a valid directory:`, error);
      }
    }

    // Then check if it's in examples directory
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

    // Add entry-point.js if it exists
    if (output['entry-point.js']) {
      fileMap.push({ name: 'entry-point.js', content: output['entry-point.js'], type: 'application/javascript' });
    }

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
    return `// Auto-generated analytics types with new event schema
export interface BaseEvent {
  id: string;
  ts: number;
  app_key: string;
  session_id: string;
  user_id: string;
  event_type: string;
  data: Record<string, any>;
}

export interface PageViewEvent extends BaseEvent {
  event_type: 'PAGE_VIEW';
  data: {
    url: string;
    path: string;
    title: string;
    referrer: string | null;
    is_first_view: boolean;
    entry_type: 'navigation' | 'reload' | 'back_forward' | 'spa_transition';
  };
}

export interface ButtonClickEvent extends BaseEvent {
  event_type: 'BUTTON_CLICK';
  data: {
    element_text: string;
    element_id: string | null;
    element_type: 'button' | 'link' | 'icon' | 'tab';
    surface: string;
    page_path: string;
    is_primary_cta: boolean;
    cta_category: 'conversion' | 'navigation' | 'engagement';
  };
}

export interface FormInteractionEvent extends BaseEvent {
  event_type: 'FORM_INTERACTION';
  data: {
    action: 'started' | 'submitted' | 'abandoned';
    form_name: string;
    form_id: string | null;
    form_type: 'contact' | 'signup' | 'login' | 'checkout' | 'newsletter' | 'other';
    surface: string;
    page_path: string;
    fields_total: number;
    fields_completed: number;
  };
}

export interface ElementVisibilityEvent extends BaseEvent {
  event_type: 'ELEMENT_VISIBILITY';
  data: {
    action: 'shown' | 'hidden' | 'dismissed';
    element_type: 'modal' | 'popup' | 'drawer' | 'tooltip' | 'dropdown' | 'toast' | 'unknown';
    element_name: string;
    element_id: string | null;
    trigger_source: 'button_click' | 'auto_trigger' | 'scroll_trigger' | 'unknown';
    page_path: string;
    has_cta: boolean;
  };
}

export interface ScrollInteractionEvent extends BaseEvent {
  event_type: 'SCROLL_INTERACTION';
  data: {
    action: 'depth_reached';
    depth_percentage: number;
    milestone: '25%' | '50%' | '75%' | '90%' | '100%' | 'none';
    page_path: string;
    direction: 'up' | 'down';
  };
}

export type AnalyticsEvent = 
  | PageViewEvent 
  | ButtonClickEvent 
  | FormInteractionEvent 
  | ElementVisibilityEvent 
  | ScrollInteractionEvent;

export interface AnalyticsTracker {
  trackEvent(eventType: string, data: Record<string, any>): void;
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

## 🤖 New Event Schema

All events now follow a consistent structure with exactly 7 fields:
- **id**: UUID (generated)
- **ts**: Unix timestamp (generated)  
- **app_key**: Your application key
- **session_id**: Session identifier
- **user_id**: 8-10 digit persistent user ID
- **event_type**: UPPERCASE event name
- **data**: Event-specific data object

## 📊 Event Types

### PAGE_VIEW
Tracks page loads and navigation with fields: url, path, title, referrer, is_first_view, entry_type

### BUTTON_CLICK  
Tracks all clickable elements with fields: element_text, element_id, element_type, surface, page_path, is_primary_cta, cta_category

### FORM_INTERACTION
Tracks form interactions with fields: action, form_name, form_id, form_type, surface, page_path, fields_total, fields_completed

### ELEMENT_VISIBILITY
Tracks modal/popup visibility with fields: action, element_type, element_name, element_id, trigger_source, page_path, has_cta

### SCROLL_INTERACTION
Tracks scroll depth with fields: action, depth_percentage, milestone, page_path, direction

## 🚀 One-Line Setup

Just add this single line to your HTML:

\`\`\`html
<script src="/tracker.js"></script>
\`\`\`

**That's it!** The AI-enhanced tracker automatically adapts to your components.

## 🔑 User ID System

The tracker automatically generates and persists user IDs:
- **Format:** 8-10 digit string (e.g., "87654321")
- **Persistence:** 1-2 years across sessions
- **Storage:** localStorage, cookies, and sessionStorage for resilience
- **Privacy:** No personal information, just anonymous integers

## 🤖 AI-Discovered Components

The AI analyzed your application and found:
- **Framework:** ${analysis.discovery.framework}
- **Interactive Components:** ${analysis.discovery.components.length}
- **Behavior Patterns:** ${analysis.behaviors.patterns.length}

### Discovered Components:
${analysis.discovery.components.map((c: any) => `- **${c.name}** (${c.type}): ${c.likely_purpose}`).join('\n')}

## 🧪 Testing Your Integration

1. **Open Browser Console**
   - Look for: "🤖 AI-Enhanced Analytics initialized"
   - Check: "📊 Tracking X discovered components"
   - See: "🔑 User ID: [8-10 digit number]"

2. **Monitor Network**
   - Filter by: \`/ingest/analytics\`
   - Verify event structure with base fields + data object

3. **Check Event Format**
   - All events have the same 7 base fields
   - Data field structure is consistent per event_type

## 🎯 What Makes This Special?

- **Consistent Schema** - All events follow the same structure
- **AI-Powered** - Understands your specific components
- **Zero Configuration** - Just add the script
- **Smart User Tracking** - Persistent 8-10 digit user IDs
- **Framework Aware** - Optimized for ${analysis.discovery.framework}

---

**Generated:** ${new Date().toISOString()}
**AI Model:** Claude 3 Haiku`;
  }
}

// Export singleton instance
export const analyticsGenerator = new AnalyticsIntelligenceGenerator();