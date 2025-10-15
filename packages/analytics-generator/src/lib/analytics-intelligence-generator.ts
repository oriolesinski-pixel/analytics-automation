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
  OUTPUTS_DIR: '/Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-generator/src/utils/generated-outputs',
  EXAMPLES_DIR: '/Users/oriolesinski/analytics-automation/examples',
  MAX_FILES: 50,
  MAX_FILE_CONTENT_LENGTH: 5000,
  LLM_MAX_TOKENS: 64000,  // Claude Sonnet 4.5 MAXIMUM! (8x larger than Claude 3)
  DEFAULT_BACKEND_URL: process.env.ANALYTICS_BACKEND_URL || 'https://analytics-service-production-0f0c.up.railway.app/ingest/analytics'
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
  progressCallback?: string;
}

interface DeploymentPlan {
  framework: string;
  files: Array<{
    path: string;
    action: 'create' | 'modify';
    content: string;
    description: string;
  }>;
  instructions: string[];
}

interface DetectedImportPattern {
  prefix: string;
  componentsPath: string;
  providerImport: string;
}

interface GeneratorOutput {
  'tracker.js': string;
  'events-schema.json': any;
  'ui-graph.json': any;
  'analytics-provider.tsx': string;
  'analytics.types.ts': string;
  'integration-guide.md': string;
  'entry-point.js'?: string;
  deploymentPlan?: DeploymentPlan;
  metadata: {
    generatedAt: string;
    appKey: string;
    eventCount: number;
    frameworksDetected: string[];
    entryPointFile?: string;
  };
}

interface ContextField {
  field_name: string;
  selector: string;
  extraction_method: 'value' | 'checked' | 'textContent' | 'data-attribute' | 'aria-attribute' | 'class-state' | 'computed-style' | 'count';
  data_type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  attribute_name?: string;
  required?: boolean;
  description?: string;
}

interface StateTracking {
  track_previous_value?: boolean;
  track_change_delta?: boolean;
  track_timing?: boolean;
}

interface ComponentRelationships {
  triggers?: string[];
  affects?: string[];
  depends_on?: string[];
}

interface ContextCollection {
  strategy: 'form_state' | 'parent_data' | 'sibling_state' | 'modal_scope' | 'component_props' | 'global_context' | 'accumulated_state';
  scope_selector?: string;
  fields: ContextField[];
  state_tracking?: StateTracking;
  fallback_sources?: string[];
}

interface ComponentDiscovery {
  components: Array<{
    name: string;
    type: string;
    selector_patterns: string[];
    interaction_type: string;
    pattern_type?: string;
    likely_purpose: string;
    context_needed: string[];
    context_collection?: ContextCollection;
    relationships?: ComponentRelationships;
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
  private async sendProgress(callbackUrl: string | undefined, message: string) {
    console.log(message);
    if (callbackUrl) {
      try {
        console.log(`📤 Posting progress to: ${callbackUrl}`);
        const response = await fetch(callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'progress',
            message,
            timestamp: Date.now()
          })
        });
        console.log(`✅ Progress POST response: ${response.status}`);
      } catch (error) {
        console.error('❌ Failed to send progress update:', error);
      }
    } else {
      console.log('⚠️ No callback URL provided for progress');
    }
  }

  /**
   * Generate the complete analytics implementation with AI-driven analysis
   */
 async generate(input: GeneratorInput): Promise<GeneratorOutput> {
  await this.sendProgress(input.progressCallback, '🚀 Starting unified analytics generation');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Step 2: Cloning from GitHub
  await this.sendProgress(input.progressCallback, '📦 Cloning from GitHub');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const repoFiles = await this.loadRepositoryFiles(input.repoId);
  
  if (repoFiles.length > 0) {
    await this.sendProgress(input.progressCallback, `📁 Loading project files`);
    await new Promise(resolve => setTimeout(resolve, 800));
    input.files = repoFiles;
  }

  // Step 4: Scanning file structure
  await this.sendProgress(input.progressCallback, '🔍 Scanning file structure');
  await new Promise(resolve => setTimeout(resolve, 800));
  
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
  await this.saveOutput(output, input.repoId, input.appKey, input.progressCallback);
  
  return output;
}
  /**
   * Perform progressive AI analysis of components and behaviors
   */
  private async performProgressiveAnalysis(input: GeneratorInput): Promise<ProgressiveAnalysis> {
    // Step 5: Detecting framework
    await this.sendProgress(input.progressCallback, '🛠️ Detecting framework');
    await new Promise(resolve => setTimeout(resolve, 800));

    // Phase 1: Discover components
    const discovery = await this.discoverComponentsWithAI(input);

    // Step 6: Analyzing components
    await this.sendProgress(input.progressCallback, '🧩 Analyzing components');
    await new Promise(resolve => setTimeout(resolve, 800));

    // Phase 2: Analyze behaviors
    const behaviors = await this.analyzeBehaviorsWithAI(input, discovery);

    // Step 7: Mapping user flows
    await this.sendProgress(input.progressCallback, '🗺️ Mapping user flows');
    await new Promise(resolve => setTimeout(resolve, 800));

    // Phase 3: Generate optimized events schema
    // Step 8: Generating tracking schema
    await this.sendProgress(input.progressCallback, '📊 Generating tracking schema');
    await new Promise(resolve => setTimeout(resolve, 800));
    const events = await this.generateEventsFromAnalysis(discovery, behaviors);

    // Phase 4: Create UI graph
    // Step 9: Creating integration files
    await this.sendProgress(input.progressCallback, '📝 Creating integration files');
    await new Promise(resolve => setTimeout(resolve, 800));
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

    const systemPrompt = `You are a frontend code analyzer. Find ALL interactive components (buttons, forms, inputs, links) in the provided code. 
CRITICAL: Be CONCISE - only include ESSENTIAL fields. Keep descriptions short (under 10 words).
Return ONLY valid JSON with NO trailing text or explanations.`;

    const userPrompt = `Analyze this code and find all interactive components.

IMPORTANT PATTERNS TO DETECT:
1. Forms - capture all input fields
2. Buttons - identify purpose from text/handlers
3. Links - navigation elements
4. Dropdowns/Selects - state changes
5. Checkboxes/Toggles - state tracking
6. Modals/Dialogs - popup interactions

For each component, provide:
- name: descriptive name from code
- type: button/form/input/select/link/toggle
- selector_patterns: CSS selectors to find it (use VALID CSS only: button[type='submit'], .classname, #id, etc)
- interaction_type: click/change/submit/toggle
- likely_purpose: what it does (from handler names, text, context)
- context_needed: what data to capture (IDs, form fields, state)

IMPORTANT: Use ONLY valid CSS selectors in "selector" fields:
- ✅ GOOD: "input[name='email']", "button[type='submit']", ".pricing-card", "#checkout-form"
- ❌ BAD: "state:step", "searchParams:plan", "props.value" (these are NOT CSS selectors)

FRAMEWORK DETECTION:
- "app/" + layout.tsx = nextjs-app-router
- "pages/" + _app.tsx = nextjs-pages-router  
- src/main.tsx = vite-react

Return this EXACT JSON structure:
{
  "framework": "nextjs-app-router|nextjs-pages-router|vite-react|vue|angular|unknown",
  "components": [
    {
      "name": "LoginButton",
      "type": "button",
      "selector_patterns": ["button[type='submit']", ".login-btn"],
      "interaction_type": "click",
      "likely_purpose": "Submit login form",
      "context_needed": ["email", "password", "form_type"]
    }
  ]
}

Analyze this code:

CRITICAL OBJECTIVE: Achieve COMPLETE COMPREHENSION of frontend application structure through micro-pattern recognition. This analysis determines schema accuracy.

=============================================================================
UNIVERSAL FRONTEND MICRO-PATTERNS
=============================================================================

PATTERN 1: FORM SUBMISSION → CONTEXT CAPTURE
├─ Structure: Form container with inputs + submission button
├─ Trigger: Submit button click, Enter key, form.submit()
├─ Context: ALL input values within form scope at submission moment
└─ Extraction: Serialize entire form state

PATTERN 2: ITEM SELECTION → ITEM CONTEXT
├─ Structure: List/grid of items + action buttons per item
├─ Trigger: Click on item row, card, or action button
├─ Context: Item identifier + item metadata from parent container
├─ Examples: 
│   - Row in table → data-row-id, data-item-type
│   - Card in grid → data-product-id, data-status
│   - List item → data-entity-id, aria-label
└─ Extraction: data-* attributes from closest item container

PATTERN 3: TOGGLE STATE → PREVIOUS + NEW STATE
├─ Structure: Toggle/switch/checkbox with state
├─ Trigger: Click to change state
├─ Context: previous_state + new_state + what's being toggled
├─ Examples:
│   - Feature flag: feature_name, was_enabled, now_enabled
│   - Visibility toggle: item_id, was_visible, now_visible
│   - Selection checkbox: item_id, was_selected, now_selected
└─ Extraction: Element checked/aria-checked before and after

PATTERN 4: DROPDOWN/SELECT CHANGE → OLD + NEW VALUE
├─ Structure: Select, dropdown, or option picker
├─ Trigger: onChange event
├─ Context: previous_value + new_value + options_available
├─ Examples:
│   - Status dropdown: from_status, to_status
│   - Filter select: previous_filter, new_filter
│   - Sort control: previous_sort, new_sort
└─ Extraction: Store previous value, capture new value on change

PATTERN 5: MODAL LIFECYCLE → TRIGGER + CONTENT + OUTCOME
├─ Structure: Modal/dialog with trigger and content
├─ Phases:
│   OPEN: what triggered it, pre-filled data, entry context
│   INTERACT: form fills, selections made within modal
│   CLOSE: outcome (submitted/cancelled/dismissed), final form state
├─ Context: 
│   - Entry: trigger_element, trigger_location, initial_data
│   - Exit: action_taken, form_data, time_in_modal
└─ Extraction: Track modal lifecycle events with accumulated context

PATTERN 6: MULTI-STEP FLOW → ACCUMULATED STATE
├─ Structure: Wizard, stepper, or paginated flow
├─ Trigger: Next/Previous/Skip navigation
├─ Context: 
│   - Current: step_number, current_step_data
│   - Accumulated: all_previous_steps_data{}
│   - Navigation: is_forward, can_skip, validation_passed
├─ Examples:
│   - Onboarding: {step1_data, step2_data, step3_data}
│   - Checkout: {shipping_info, payment_info, review_data}
└─ Extraction: Maintain flow state, merge on completion

PATTERN 7: TAB SWITCH → TAB CONTEXT + FORM STATE
├─ Structure: Tab navigation with different content per tab
├─ Trigger: Tab click, keyboard navigation
├─ Context:
│   - From: previous_tab_id, previous_tab_form_state
│   - To: new_tab_id
│   - Unsaved: had_unsaved_changes
├─ Examples:
│   - Settings tabs: switching from "Profile" to "Billing"
│   - Editor tabs: switching between "Edit" and "Preview"
└─ Extraction: Capture active tab form state before switch

PATTERN 8: INLINE EDIT → EDIT TRIGGER + FIELD CHANGES
├─ Structure: Toggle between view and edit mode
├─ Trigger: Edit button, double-click, focus
├─ Context:
│   - Entry: field_name, original_value, edit_trigger
│   - Exit: new_value, was_changed, save_method
├─ Examples:
│   - Editable field: click to edit, type, click away to save
│   - Inline editor: edit icon → input appears → save/cancel
└─ Extraction: Track before/after values, edit duration

PATTERN 9: SEARCH/FILTER APPLICATION → QUERY + RESULTS
├─ Structure: Search input or filter controls + results display
├─ Trigger: Search submit, filter change, clear filters
├─ Context:
│   - Input: search_query, applied_filters{}, sort_order
│   - Output: results_count, results_displayed, time_to_results
│   - State: previous_query, filter_history[]
├─ Examples:
│   - Search bar: query text, filters, result count
│   - Filter panel: selected_filters, facet_counts
└─ Extraction: Capture search state + result metadata

PATTERN 10: DRAG & DROP → SOURCE + TARGET + CONTEXT
├─ Structure: Draggable items + drop zones
├─ Trigger: dragstart, dragend events
├─ Context:
│   - Item: item_id, item_type, source_container
│   - Target: target_container, drop_position
│   - Action: reorder, move, copy, link
├─ Examples:
│   - Kanban: card moved from "Todo" to "Done"
│   - File upload: files dropped into upload zone
│   - Reorder: list item moved from position 3 to 1
└─ Extraction: Track source + destination + item metadata

PATTERN 11: BULK ACTION → SELECTION SET + ACTION
├─ Structure: Multi-select interface + batch action button
├─ Trigger: Action button click with items selected
├─ Context:
│   - Selection: selected_ids[], selection_count, select_all_used
│   - Action: action_type, confirmation_required
│   - Scope: affected_count, scope_filters
├─ Examples:
│   - Bulk delete: 5 items selected → delete button
│   - Bulk edit: 10 rows selected → change status
│   - Bulk export: all filtered items → export CSV
└─ Extraction: Capture selection state + action metadata

PATTERN 12: PAGINATION/INFINITE SCROLL → NAVIGATION CONTEXT
├─ Structure: Paginated list or infinite scroll container
├─ Trigger: Page number click, next/prev, scroll threshold
├─ Context:
│   - Current: page_number, items_per_page, total_items
│   - Navigation: previous_page, navigation_method
│   - Performance: load_time, items_rendered
├─ Examples:
│   - Page navigation: click page 3, from page 1
│   - Infinite scroll: scrolled to 80%, loaded next batch
└─ Extraction: Track pagination state + performance metrics

PATTERN 13: VALIDATION → FIELD + ERROR STATE
├─ Structure: Input with validation, error messages
├─ Trigger: Blur, real-time validation, submit attempt
├─ Context:
│   - Field: field_name, field_value, validation_rule
│   - Error: error_type, error_message, is_blocking
│   - Timing: validation_trigger, fix_attempts
├─ Examples:
│   - Email validation: invalid format → error shown
│   - Required field: submit attempted → missing field error
└─ Extraction: Track validation events + error patterns

PATTERN 14: AUTOCOMPLETE/TYPEAHEAD → QUERY + SELECTION
├─ Structure: Input with suggestions dropdown
├─ Trigger: Text input, suggestion click
├─ Context:
│   - Input: partial_query, characters_typed
│   - Suggestions: suggestions_shown, suggestion_count
│   - Selection: selected_suggestion, selection_method (click/keyboard)
├─ Examples:
│   - Search autocomplete: type "ana" → select "Analytics"
│   - Mention autocomplete: type "@jo" → select "@john"
└─ Extraction: Query + suggestion list + final selection

PATTERN 15: EXPAND/COLLAPSE → VISIBILITY STATE CHANGE
├─ Structure: Collapsible sections, accordions, trees
├─ Trigger: Click header, expand icon, keyboard
├─ Context:
│   - Item: section_id, section_name, nesting_level
│   - State: was_expanded, now_expanded, siblings_state
│   - Content: content_type, estimated_size
├─ Examples:
│   - Accordion: expand "Advanced Settings" section
│   - Tree node: expand folder to show children
└─ Extraction: Track expand/collapse with section context

PATTERN 16: COPY/SHARE → CONTENT + METHOD
├─ Structure: Copy button, share button, clipboard interaction
├─ Trigger: Copy click, share dialog open
├─ Context:
│   - Content: content_type, content_id, content_preview
│   - Method: clipboard, share_api, social_platform
│   - Success: copy_successful, share_completed
├─ Examples:
│   - Copy URL: button click → clipboard success
│   - Share dialog: share button → platform selected
└─ Extraction: Track what was copied/shared + method

PATTERN 17: KEYBOARD SHORTCUTS → COMMAND + CONTEXT
├─ Structure: Global or context-specific keyboard handlers
├─ Trigger: Key combination pressed
├─ Context:
│   - Command: shortcut_key, command_name, command_action
│   - Context: active_element, page_section, modifier_keys
│   - Outcome: action_executed, action_blocked
├─ Examples:
│   - Cmd+K: open command palette
│   - Cmd+S: save current document
└─ Extraction: Track keyboard commands + execution context

PATTERN 18: FILE UPLOAD → FILE METADATA + PROGRESS
├─ Structure: File input or drop zone
├─ Trigger: File selected or dropped
├─ Context:
│   - Files: file_count, file_types[], total_size
│   - Method: input_click, drag_drop, paste
│   - Progress: upload_started, upload_completed, upload_failed
├─ Examples:
│   - Single file: select PDF via input
│   - Multiple files: drag 5 images into drop zone
└─ Extraction: Track file metadata + upload lifecycle

PATTERN 19: DATE/TIME PICKER → SELECTION CONTEXT
├─ Structure: Calendar, date picker, time selector
├─ Trigger: Date/time selection
├─ Context:
│   - Selection: selected_date, selected_time, date_range
│   - Method: calendar_click, text_input, preset_selection
│   - Purpose: field_name, selection_type (start/end/single)
├─ Examples:
│   - Date range: select start date, then end date
│   - Time picker: select hour and minute
└─ Extraction: Capture date/time selections with context

PATTERN 20: UNDO/REDO → ACTION HISTORY
├─ Structure: Undo/redo buttons or keyboard shortcuts
├─ Trigger: Undo/redo action
├─ Context:
│   - Action: action_being_undone, action_type
│   - History: history_depth, can_redo
│   - State: previous_state, new_state
├─ Examples:
│   - Undo delete: restore deleted item
│   - Redo edit: reapply undone change
└─ Extraction: Track action history + state changes

=============================================================================
PATTERN DETECTION METHODOLOGY
=============================================================================

FOR EVERY INTERACTIVE ELEMENT, ASK:

1. **WHAT IS THE INTERACTION TYPE?**
   - Click, change, submit, toggle, drag, type, focus, blur, hover
   - This determines which pattern applies

2. **WHAT IS THE CONTEXT CONTAINER?**
   - Form, modal, panel, row, card, list, section
   - Find with: element.closest('[relevant-selector]')

3. **WHAT STATE EXISTS IN THAT CONTAINER?**
   - Input values, data attributes, aria attributes, class state
   - Enumerate ALL state sources

4. **WHAT CHANGES ON INTERACTION?**
   - New values, state transitions, visibility changes
   - Track before → after

5. **WHAT IS THE BUSINESS MEANING?**
   - Look at labels, placeholders, data attributes, aria-labels
   - Infer semantic meaning from naming

6. **WHAT RELATED CONTEXT IS NEEDED?**
   - Item IDs, parent relationships, user context
   - Look for data-* attributes on ancestors

7. **HOW DO WE EXTRACT IT?**
   - querySelector patterns, attribute reads, property access
   - Specify exact extraction method

=============================================================================
CONTEXT EXTRACTION STRATEGIES
=============================================================================

**Strategy: form_state**
- Use when: Interactive element is inside <form>
- Scope: element.closest('form')
- Extract: All input/select/textarea values within form
- Also capture: Form name, action, method

**Strategy: parent_data**
- Use when: Element is inside container with data-* attributes
- Scope: element.closest('[data-item-id]') or similar
- Extract: All data-* attributes from parent
- Also capture: aria-* attributes, role

**Strategy: sibling_state**
- Use when: Related state exists in sibling elements
- Scope: Parent container of element and siblings
- Extract: State from siblings using selectors
- Examples: Active tab sibling, selected radio sibling

**Strategy: modal_scope**
- Use when: Interaction happens within modal/dialog
- Scope: element.closest('[role="dialog"]')
- Extract: Modal content + trigger context
- Also capture: Modal type, modal ID, entry point

**Strategy: component_props**
- Use when: Component state is in React/Vue/etc
- Look for: data-state-*, aria-*, or observable class changes
- Extract: Externalized state through attributes
- Fallback: Track class names that indicate state

**Strategy: global_context**
- Use when: Need page-level or app-level context
- Extract: URL params, localStorage, sessionStorage
- Examples: Workspace ID, selected project, user role

**Strategy: accumulated_state**
- Use when: Multi-step or stateful flow
- Maintain: Flow state across interactions
- Extract: Current state + history
- Examples: Wizard steps, form drafts, edit history

=============================================================================
OUTPUT SCHEMA (STRICT FORMAT)
=============================================================================

For EACH interactive component, return:

{
  "name": "ComponentNameFromCode",
  "type": "button|input|select|toggle|link|tab|modal_trigger|drag_item|etc",
  "selector_patterns": ["css.selector", "[data-specific]"],
  "interaction_type": "click|change|submit|toggle|drag|focus|blur",
  "pattern_type": "form_submission|item_selection|toggle_state|modal_lifecycle|multi_step_flow|tab_switch|inline_edit|search_filter|drag_drop|bulk_action|pagination|validation|autocomplete|expand_collapse|copy_share|keyboard_shortcut|file_upload|date_picker|undo_redo",
  "likely_purpose": "Semantic description based on code analysis",
  
  "context_needed": [
    "List of all fields/attributes to capture"
  ],
  
  "context_collection": {
    "strategy": "form_state|parent_data|sibling_state|modal_scope|component_props|global_context|accumulated_state",
    "scope_selector": "CSS selector to find context container",
    "fields": [
      {
        "field_name": "semantic_field_name",
        "selector": "CSS selector within scope",
        "extraction_method": "value|checked|textContent|data-attribute|aria-attribute|class-state|computed-style",
        "data_type": "string|number|boolean|array|object",
        "attribute_name": "if data-* or aria-*",
        "required": true|false,
        "description": "What this field represents"
      }
    ],
    "state_tracking": {
      "track_previous_value": true|false,
      "track_change_delta": true|false,
      "track_timing": true|false
    },
    "fallback_sources": ["Alternative extraction methods if primary fails"]
  },
  
  "relationships": {
    "triggers": ["What actions trigger this"],
    "affects": ["What this interaction affects"],
    "depends_on": ["What state this depends on"]
  }
}

=============================================================================
FRAMEWORK-AGNOSTIC PRINCIPLES
=============================================================================

These patterns work across ALL frameworks (React, Vue, Angular, Svelte, vanilla JS):

✓ HTML structure is universal (forms, modals, lists)
✓ DOM APIs are standard (querySelector, attributes, events)
✓ State is readable through attributes (value, checked, data-*, aria-*)
✓ Parent-child relationships are traversable (closest, querySelector)
✓ Events bubble and can be captured (click, change, submit)
✓ Patterns repeat regardless of framework (form submit, modal open, tab switch)

The key is detecting the STRUCTURAL PATTERN, not framework-specific implementation.

=============================================================================
FRAMEWORK DETECTION
=============================================================================

- If you see file paths like "app/layout.tsx", "app/page.tsx" → "nextjs-app-router"
- If you see file paths like "pages/_app.tsx", "pages/index.tsx" → "nextjs-pages-router"  
- If you see file paths like "src/main.tsx" or "src/App.tsx" → "vite-react" or "create-react-app"
- If you see imports like "from 'next/font/google'" → Next.js
- Look at actual file paths provided

=============================================================================
CRITICAL INSTRUCTIONS
=============================================================================

1. **Identify ALL 20 patterns** in the codebase (don't stop at basic patterns)

2. **For EVERY interactive element**, determine which pattern(s) apply

3. **Map complete extraction strategy** - be specific about selectors and methods

4. **Think structurally** - what container, what state, what changes

5. **Infer semantics** - use naming to understand business meaning

6. **Be exhaustive** - catalog every input, every data attribute, every state source

7. **Track relationships** - what triggers what, what depends on what

8. **Return ONLY valid JSON** - no markdown, no explanations outside JSON

This analysis is CRITICAL - it determines the accuracy of the entire analytics system.

Return this EXACT JSON structure:
{
  "framework": "nextjs-app-router|nextjs-pages-router|vite-react|create-react-app|vue|angular|vanilla|unknown",
  "components": [
    {
      "name": "component_name_from_code",
      "type": "button|link|icon|form_input|toggle|selector|custom",
      "selector_patterns": ["SPECIFIC CSS selectors"],
      "interaction_type": "click|change|toggle|submit|hover",
      "pattern_type": "form_submission|item_selection|etc (can be comma-separated for multiple patterns)",
      "likely_purpose": "Be specific based on handler names and context",
      "context_needed": ["product_id", "selected_state", "form_data", "etc"],
      "context_collection": {
        "strategy": "form_state|parent_data|sibling_state|modal_scope|component_props|global_context|accumulated_state",
        "scope_selector": "CSS selector to find context container",
        "fields": [
          {
            "field_name": "semantic_field_name",
            "selector": "CSS selector within scope",
            "extraction_method": "value|checked|textContent|data-attribute|aria-attribute|class-state|computed-style|count",
            "data_type": "string|number|boolean|array|object",
            "attribute_name": "if data-* or aria-*",
            "required": true|false,
            "description": "What this field represents"
          }
        ],
        "state_tracking": {
          "track_previous_value": true|false,
          "track_change_delta": true|false,
          "track_timing": true|false
        },
        "fallback_sources": []
      },
      "relationships": {
        "triggers": [],
        "affects": [],
        "depends_on": []
      }
    }
  ]
}

CODE:
${codeContent}`;

    try {
      console.log('🤖 Starting AI component discovery...');
      console.log('📄 Analyzing', input.files.length, 'files');
      
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",  // Claude Sonnet 4.5 (latest, most capable model)
        max_tokens: 64000,  // Use MAXIMUM output tokens!
        temperature: 0.1,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: userPrompt
        }]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('📝 AI Response length:', content.length, 'characters');
      console.log('📝 First 200 chars:', content.substring(0, 200));
      
      // Save AI response for debugging
      try {
        const debugPath = path.join(CONFIG.OUTPUTS_DIR, 'debug-component-discovery.json');
        await fs.writeFile(debugPath, JSON.stringify({
          timestamp: new Date().toISOString(),
          appKey: input.appKey,
          filesAnalyzed: input.files.length,
          responseLength: content.length,
          rawResponse: content
        }, null, 2));
        console.log('💾 Saved AI response to:', debugPath);
      } catch (e) {
        console.debug('Failed to save debug file:', e);
      }
      
      const parsed = this.extractJSON(content);
      
      // Validate parsed result
      if (!parsed || !parsed.components || parsed.components.length === 0) {
        console.warn('⚠️ AI returned no components! Check response:');
        console.warn('Parsed result:', JSON.stringify(parsed, null, 2));
        console.warn('Full AI response:', content.substring(0, 1000));
        console.warn('📁 Full response saved to: debug-component-discovery.json');
      } else {
        console.log('✅ Discovered', parsed.components.length, 'components');
        console.log('🎯 Component names:', parsed.components.map((c: any) => c.name).join(', '));
      }

      return parsed as ComponentDiscovery;
    } catch (error) {
      console.error('❌ Component discovery failed:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
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

    const codeContent = input.files.slice(0, 20).map((f: FileContent) =>
      `=== File: ${f.path} ===\n${f.content.slice(0, 3000)}\n`
    ).join('\n').slice(0, 40000);

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
}
CODE:
${codeContent}`;

    try {
      console.log('🔍 Starting AI behavior analysis...');
      
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",  // Claude Sonnet 4.5 (latest, most capable model)
        max_tokens: 64000,  // Use MAXIMUM output tokens!
        temperature: 0.1,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: userPrompt
        }]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('📝 Behavior analysis response length:', content.length, 'characters');
      
      const parsed = this.extractJSON(content);
      
      if (!parsed || !parsed.patterns || parsed.patterns.length === 0) {
        console.warn('⚠️ AI returned no behavior patterns');
      } else {
        console.log('✅ Discovered', parsed.patterns.length, 'behavior patterns');
      }

      return parsed as BehaviorAnalysis;
    } catch (error) {
      console.error('❌ Behavior analysis failed:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
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
          required: ['element_text', 'element_id', 'element_type', 'surface', 'page_path', 'is_primary_cta', 'cta_category', 'pattern_type']
        },
        properties: {
          element_text: 'string',
          element_id: 'string | null',
          element_type: '"button" | "link" | "icon" | "tab"',
          surface: 'string',
          page_path: 'string',
          is_primary_cta: 'boolean',
          cta_category: '"conversion" | "navigation" | "engagement"',
          pattern_type: 'string | null',
          context: 'Record<string, any> | undefined  // Only present for forms, bulk actions, etc.'
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
        event_type: 'MODAL_INTERACTION',
        data_fields: {
          required: ['action', 'modal_name', 'modal_id', 'trigger_source', 'page_path', 'context']
        },
        properties: {
          action: '"opened" | "closed" | "submitted" | "dismissed"',
          modal_name: 'string',
          modal_id: 'string | null',
          trigger_source: '"button_click" | "auto_trigger" | "other"',
          page_path: 'string',
          context: 'Record<string, any>'
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
  /**
 * Generate UI graph with AI analysis - REPLACEMENT METHOD
 * This replaces the existing generateUIGraphWithAI method in the AnalyticsIntelligenceGenerator class
 */
  private async generateUIGraphWithAI(
    input: GeneratorInput,
    discovery: ComponentDiscovery,
    behaviors: BehaviorAnalysis
  ): Promise<any> {
    if (!input.files || input.files.length === 0) {
      // Fallback if no files
      return {
        app_key: input.appKey,
        framework: discovery.framework || 'unknown',
        relationships: [],
        pages: {},
        widgets: [],
        modals: []
      };
    }

    const codeContent = input.files.slice(0, 30).map((f: FileContent) =>
      `=== File: ${f.path} ===\n${f.content.slice(0, 2000)}\n`
    ).join('\n').slice(0, 50000);

    const systemPrompt = `You are an expert UI structure analyzer that generates precise UI graph JSON.
Analyze code to understand page structure, navigation, widgets, and modals.
Return ONLY valid JSON in the EXACT format specified.`;

    const userPrompt = `Analyze this code and generate a UI graph JSON structure.

CRITICAL REQUIREMENTS:
1. can_navigate_to MUST ONLY include pages that have ACTUAL DIRECT LINKS in the code
   - Look for <Link to="/path">, router.push('/path'), href="/path", navigate('/path')
   - Do NOT include all pages by default - only connected pages with real navigation code
   - If a page has NO outgoing links found in code, can_navigate_to should be empty []

2. Detect actual routes from the code:
   - Look for route definitions, page files, path patterns
   - Convert routes to page names (e.g., "/products/:id" → "products_param")
   - Include dynamic routes with :param notation

3. Identify actual widgets and modals from the code:
   - Look for component imports and usage
   - Common widgets: header, footer, navigation, search_bar, product_carousel, cart_icon
   - Common modals: size_guide, quick_view, forgot_password, promo_code

4. Determine page types based on route and content:
   - home, product_detail, cart, checkout, auth, wishlist, info

5. Determine which events are actually used on each page:
   - Only include events if the page has relevant interactions
   - PAGE_VIEW: all pages
   - BUTTON_CLICK: if page has buttons/links
   - FORM_INTERACTION: if page has forms
   - SCROLL_INTERACTION: for content-heavy pages
   - ELEMENT_VISIBILITY: if page has modals/popups

EXACT OUTPUT FORMAT (this is the REQUIRED structure):
{
  "app_key": "${input.appKey}",
  "framework": "${discovery.framework || 'react'}",
  "relationships": [],
  "pages": {
    "page_name": {
      "route": "/actual/route",
      "page_type": "home|product_detail|cart|checkout|auth|wishlist|info",
      "widgets": ["header", "footer", "actual_widgets_found"],
      "modals": ["actual_modals_if_any"],
      "can_navigate_to": ["ONLY_pages_with_actual_links_in_code"],
      "events": ["PAGE_VIEW", "only_relevant_events"],
      "ai_insights": {
        "framework": "${discovery.framework || 'react'}",
        "interaction_types": ["click", "submit", "etc"],
        "has_forms": true_or_false,
        "has_product_interactions": true_or_false
      }
    }
  },
  "widgets": [],
  "modals": []
}

EXAMPLE - if code shows homepage with links to /about and /products only:
{
  "app_key": "test-app",
  "framework": "react",
  "relationships": [],
  "pages": {
    "home": {
      "route": "/",
      "page_type": "home",
      "widgets": ["header", "footer", "product_carousel"],
      "modals": [],
      "can_navigate_to": ["about", "products"],  // ONLY these because code has actual links
      "events": ["PAGE_VIEW", "BUTTON_CLICK", "SCROLL_INTERACTION"],
      "ai_insights": {
        "framework": "react",
        "interaction_types": ["click"],
        "has_forms": false,
        "has_product_interactions": true
      }
    },
    "about": {
      "route": "/about",
      "page_type": "info",
      "widgets": ["header", "footer"],
      "modals": [],
      "can_navigate_to": ["home"],  // Only if code shows link back to home
      "events": ["PAGE_VIEW", "BUTTON_CLICK"],
      "ai_insights": {
        "framework": "react",
        "interaction_types": ["click"],
        "has_forms": false,
        "has_product_interactions": false
      }
    }
  },
  "widgets": [],
  "modals": []
}

IMPORTANT RULES:
- Scan the ACTUAL code for navigation patterns
- can_navigate_to should reflect REAL navigation code, not theoretical possibilities
- If no navigation links found from a page, can_navigate_to is empty []
- Include all routes/pages found in the code
- Use exact format with all required fields

Discovered components for context:
${JSON.stringify(discovery.components.slice(0, 10), null, 2)}

CODE TO ANALYZE:
${codeContent}`;

    try {
      console.log('🗺️ Starting UI graph generation...');
      
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",  // Claude Sonnet 4.5 (latest, most capable model)
        max_tokens: 64000,  // Use MAXIMUM output tokens!
        temperature: 0.1,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: userPrompt
        }]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('📝 UI graph response length:', content.length, 'characters');
      
      const parsed = this.extractJSON(content);

      // Validate and ensure required structure
      if (parsed && typeof parsed === 'object') {
        // Ensure all required top-level fields exist
        const uiGraph = {
          app_key: parsed.app_key || input.appKey,
          framework: parsed.framework || discovery.framework || 'unknown',
          relationships: parsed.relationships || [],
          pages: parsed.pages || {},
          widgets: parsed.widgets || [],
          modals: parsed.modals || []
        };

        // Validate each page has required fields
        for (const pageName in uiGraph.pages) {
          const page = uiGraph.pages[pageName];
          if (!page.route) page.route = `/${pageName}`;
          if (!page.page_type) page.page_type = 'general';
          if (!page.widgets) page.widgets = ['header', 'footer'];
          if (!page.modals) page.modals = [];
          if (!page.can_navigate_to) page.can_navigate_to = [];
          if (!page.events) page.events = ['PAGE_VIEW'];
          if (!page.ai_insights) {
            page.ai_insights = {
              framework: discovery.framework || 'unknown',
              interaction_types: ['click'],
              has_forms: false,
              has_product_interactions: false
            };
          }
        }

        console.log(`📊 Generated UI graph with ${Object.keys(uiGraph.pages).length} pages via AI`);
        return uiGraph;
      }

      throw new Error('Invalid UI graph structure from AI');
    } catch (error) {
      console.error('❌ AI UI graph generation failed:', error);

      // Fallback to a minimal structure
      return {
        app_key: input.appKey,
        framework: discovery.framework || 'unknown',
        relationships: [],
        pages: {
          home: {
            route: '/',
            page_type: 'home',
            widgets: ['header', 'footer'],
            modals: [],
            can_navigate_to: [],
            events: ['PAGE_VIEW'],
            ai_insights: {
              framework: discovery.framework || 'unknown',
              interaction_types: ['click'],
              has_forms: false,
              has_product_interactions: false
            }
          }
        },
        widgets: [],
        modals: []
      };
    }
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
   * Detect import pattern used in the codebase - AIR TIGHT detection from actual files
   */
  private detectImportPattern(files: FileContent[]): DetectedImportPattern {
    console.log('\n🔍 === AIR TIGHT PATH DETECTION ===');
    console.log('📂 Analyzing', files.length, 'files for component directory structure...');
    
    // STRATEGY 1: Analyze actual imports in the codebase (most reliable)
    const allImports = files.flatMap(f => {
      const matches = f.content.match(/import\s+(?:[\s\S]*?)\s+from\s+['"](.*)['"];/g) || [];
      return matches.map(m => {
        const path = m.match(/from\s+['"](.*?)['"]/)?.[1];
        return path;
      }).filter(Boolean);
    });

    const componentImports = allImports.filter(imp => 
      imp && (imp.includes('/components/') || imp.includes('components/'))
    ) as string[];

    console.log('📥 Found', componentImports.length, 'component imports');
    if (componentImports.length > 0) {
      console.log('📝 Sample imports:', componentImports.slice(0, 3));
    }

    // STRATEGY 2: Analyze actual file paths (physical directory structure)
    const componentFiles = files.filter(f => 
      f.path.includes('/components/') || f.path.endsWith('/components')
    );
    
    console.log('📁 Found', componentFiles.length, 'files in components directories');
    if (componentFiles.length > 0) {
      console.log('📝 Sample paths:', componentFiles.slice(0, 3).map(f => f.path));
    }

    // STRATEGY 3: Extract all unique component directory patterns
    const componentDirPatterns = new Set<string>();
    componentFiles.forEach(f => {
      // Extract the components directory path
      // e.g., "src/app/dashboard/page.tsx" → skip
      // e.g., "src/components/Button.tsx" → "src/components"
      // e.g., "app/components/ui/card.tsx" → "app/components"
      const match = f.path.match(/^(.*\/components)/);
      if (match) {
        componentDirPatterns.add(match[1]);
      }
    });

    console.log('🎯 Detected component directory patterns:', Array.from(componentDirPatterns));

    // STRATEGY 4: Determine prefix and path based on evidence
    let prefix = '@/';  // Default to alias (most common in modern frameworks)
    let componentsPath = '';

    // Priority 1: Check imports for @/app/components (Next.js App Router with app dir components)
    if (componentImports.some(i => i?.startsWith('@/app/components'))) {
      prefix = '@/';
      componentsPath = 'app/components';
      console.log('✅ Detected pattern: @/app/components (from imports)');
    }
    // Priority 2: Check imports for @/components
    else if (componentImports.some(i => i?.startsWith('@/components'))) {
      prefix = '@/';
      // Need to determine if it's src/components or just components
      if (componentDirPatterns.has('src/components')) {
        componentsPath = 'src/components';
        console.log('✅ Detected pattern: @/components → src/components (from file structure)');
      } else if (componentDirPatterns.has('components')) {
        componentsPath = 'components';
        console.log('✅ Detected pattern: @/components → components/ (root level)');
      } else {
        // Check tsconfig or next.config for @ mapping
        const hasNextConfig = files.some(f => f.path.includes('next.config'));
        const hasTsConfig = files.some(f => f.path.includes('tsconfig.json'));
        
        if (hasNextConfig || hasTsConfig) {
          componentsPath = 'src/components';  // Next.js default
          console.log('✅ Detected Next.js project, using src/components');
        } else {
          componentsPath = 'components';
          console.log('⚠️ Ambiguous, defaulting to root components/');
        }
      }
    }
    // Priority 3: Check imports for ../components or ./components (relative imports)
    else if (componentImports.some(i => i?.includes('../components') || i?.includes('./components'))) {
      prefix = './';
      if (componentDirPatterns.has('src/components')) {
        componentsPath = 'src/components';
        console.log('✅ Detected pattern: relative imports with src/components');
      } else {
        componentsPath = 'components';
        console.log('✅ Detected pattern: relative imports with root components');
      }
    }
    // Priority 4: No imports found, use file structure only
    else if (componentDirPatterns.size > 0) {
      prefix = '@/';
      // Use the most common pattern (first one found)
      const firstPattern = Array.from(componentDirPatterns)[0];
      componentsPath = firstPattern;
      console.log('✅ No imports found, using file structure:', componentsPath);
    }
    // Priority 5: Check for specific directories in file paths
    else if (files.some(f => f.path.startsWith('src/components/') || f.path.includes('/src/components/'))) {
      prefix = '@/';
      componentsPath = 'src/components';
      console.log('✅ Detected src/components from file paths');
    }
    else if (files.some(f => f.path.startsWith('app/components/') || f.path.includes('/app/components/'))) {
      prefix = '@/';
      componentsPath = 'app/components';
      console.log('✅ Detected app/components from file paths');
    }
    else if (files.some(f => f.path.startsWith('components/') && !f.path.startsWith('src/') && !f.path.startsWith('app/'))) {
      prefix = '@/';
      componentsPath = 'components';
      console.log('✅ Detected root-level components/ from file paths');
    }
    // Priority 6: Framework-based intelligent fallback
    else {
      const hasAppDir = files.some(f => f.path.includes('/app/'));
      const hasSrcDir = files.some(f => f.path.startsWith('src/'));
      const isPagesRouter = files.some(f => f.path.includes('/pages/'));
      
      prefix = '@/';
      
      if (hasAppDir && !hasSrcDir) {
        componentsPath = 'app/components';  // Next.js App Router without src
        console.log('⚠️ Fallback: app/ directory detected, using app/components');
      } else if (hasSrcDir) {
        componentsPath = 'src/components';  // Most common: src/components
        console.log('⚠️ Fallback: src/ directory detected, using src/components');
      } else {
        componentsPath = 'components';  // Root level fallback
        console.log('⚠️ Final fallback: using root components/');
      }
    }

    const result = { 
      prefix, 
      componentsPath, 
      providerImport: `${prefix}${componentsPath}/AnalyticsProvider`.replace(/\/\//g, '/') // Remove double slashes
    };

    console.log('🎯 FINAL DETECTION RESULT:', result);
    console.log('   Provider file will be created at:', result.componentsPath + '/AnalyticsProvider.tsx');
    console.log('   Import statement will be:', result.providerImport);
    console.log('=================================\n');

    return result;
  }

  /**
   * Detect framework from file structure
   */
  private detectFrameworkFromStructure(files: FileContent[]): string {
    const paths = files.map(f => f.path);
    if (paths.some(p => p.match(/app\/layout\.(tsx?|jsx?)$/))) return 'nextjs-app-router';
    if (paths.some(p => p.match(/pages\/_app\.(tsx?|jsx?)$/))) return 'nextjs-pages-router';
    if (paths.some(p => p.match(/src\/main\.(tsx?|jsx?)$/))) return 'vite-react';
    return 'unknown';
  }

  /**
   * Safely truncate content at line boundaries while preserving essential HTML structure
   */
  private safeTruncate(content: string, maxChars: number): string {
    console.log(`📏 safeTruncate called: content.length=${content.length}, maxChars=${maxChars}`);
    
    if (content.length <= maxChars) {
      console.log(`📏 Content fits within limit, returning full content`);
      return content;
    }
    
    // For layout files, ensure we include critical tags
    const bodyOpenIndex = content.indexOf('<body');
    const bodyCloseIndex = content.indexOf('</body>');
    
    console.log(`📏 Body tag positions: open=${bodyOpenIndex}, close=${bodyCloseIndex}`);
    
    // If file has body tags, try to include the complete body section
    if (bodyOpenIndex !== -1 && bodyCloseIndex !== -1) {
      const bodyEndIndex = bodyCloseIndex + 7; // Include </body>
      
      console.log(`📏 Body section ends at: ${bodyEndIndex} chars`);
      
      // For layout files, always try to include the complete body section if reasonable
      // Most layout files are < 5000 chars, so 150k (3x 50k) is very generous
      if (bodyEndIndex < maxChars * 3) {
        console.log(`📏 ✅ Including full body section (${bodyEndIndex} chars < ${maxChars * 3} limit)`);
        return content.slice(0, bodyEndIndex);
      }
      
      // Body section is massive (>150k), but at least ensure opening tag is included
      console.log(`📏 ⚠️ Body section very large (${bodyEndIndex} chars), including minimum`);
      const bodyTagEnd = content.indexOf('>', bodyOpenIndex) + 1;
      
      if (bodyTagEnd > maxChars) {
        // Body tag itself is beyond limit, expand to include it
        console.log(`📏 Expanding to include opening <body> tag at ${bodyTagEnd}`);
        return content.slice(0, bodyTagEnd) + '\n// ... (truncated)';
      }
      
      // Body tag is within limit, truncate normally but ensure it's included
      console.log(`📏 Body tag within limit, standard truncation`);
    } else {
      console.log(`📏 ⚠️ No body tags found in content`);
    }
    
    // Standard truncation at line boundary
    const truncated = content.slice(0, maxChars);
    const lastNewline = truncated.lastIndexOf('\n');
    if (lastNewline > maxChars * 0.8) {
      console.log(`📏 Truncating at line boundary: ${lastNewline} chars`);
      return truncated.slice(0, lastNewline) + '\n// ... (truncated)';
    }
    console.log(`📏 Standard truncation at: ${maxChars} chars`);
    return truncated + '\n// ... (truncated)';
  }

  /**
   * Create fallback deployment plan when LLM analysis isn't possible
   */
  private createFallbackPlan(
    files: FileContent[],
    trackerCode: string,
    providerCode: string
  ): DeploymentPlan {
    const framework = this.detectFrameworkFromStructure(files);
    const importPattern = this.detectImportPattern(files);

    return {
      framework,
      files: [
        { 
          path: 'public/tracker.js', 
          action: 'create', 
          content: trackerCode, 
          description: 'Create tracker' 
        },
        { 
          path: importPattern.componentsPath + '/AnalyticsProvider.tsx', 
          action: 'create', 
          content: providerCode, 
          description: 'Create provider' 
        }
      ],
      instructions: [
        'Manual setup required',
        'Add <script src="/tracker.js" defer></script> to layout',
        'Import and wrap with <AnalyticsProvider>'
      ]
    };
  }

  /**
   * Generate deployment plan using LLM to analyze and modify layout files
   */
  private async generateDeploymentPlan(
    input: GeneratorInput,
    trackerCode: string,
    providerCode: string
  ): Promise<DeploymentPlan> {
    console.log('\n🚀 === generateDeploymentPlan CALLED ===');
    console.log('   Input files:', input.files?.length || 0);
    
    if (!input.files || input.files.length === 0) {
      console.log('❌ No files provided, using fallback');
      return this.createFallbackPlan([], trackerCode, providerCode);
    }

    const importPattern = this.detectImportPattern(input.files);
    const framework = this.detectFrameworkFromStructure(input.files);

    const layoutCandidates = input.files.filter(f => 
      f.path.includes('app/layout.') || f.path.includes('_app.')
    );

    if (layoutCandidates.length === 0) {
      return this.createFallbackPlan(input.files, trackerCode, providerCode);
    }

    const primaryLayout = layoutCandidates[0];
    
    // Check if original content has body tags before truncation
    if (!primaryLayout.content.includes('<body')) {
      console.warn('⚠️ WARNING: Original layout file missing <body> tag!');
      console.warn('   File path:', primaryLayout.path);
      console.warn('   Content length:', primaryLayout.content.length);
      console.warn('   This may indicate incomplete file loading');
    }
    
    const safeContent = this.safeTruncate(primaryLayout.content, 50000); // Increased from 30000

    console.log('🤖 Calling LLM to generate deployment plan...');
    console.log('   Framework:', framework);
    console.log('   Layout file:', primaryLayout.path);
    console.log('   Import pattern:', importPattern.providerImport);
    console.log('   Content length:', safeContent.length, 'chars');
    
    // Debug: Content analysis before LLM call
    console.log('🔍 DEBUG: Content preview (first 500 chars):');
    console.log(safeContent.substring(0, 500));
    console.log('🔍 DEBUG: Content includes <body>?', safeContent.includes('<body>'));
    console.log('🔍 DEBUG: Content includes </body>?', safeContent.includes('</body>'));
    console.log('🔍 DEBUG: Content includes AuthProvider?', safeContent.includes('AuthProvider'));

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",  // Claude Sonnet 4.5 (latest, most capable model)
        max_tokens: 64000,  // Use MAXIMUM output tokens!  // Sonnet 4.5 max tokens
        temperature: 0.1,
        system: "You are a precise code editor. Make ONLY the necessary analytics changes. Preserve ALL existing code structure exactly. Return the complete file with minimal modifications.",
        messages: [{
          role: "user",
          content: `TASK: Add AnalyticsProvider wrapper to this ${framework} layout file.

STEP 1: Add imports at top
Add these lines with the other imports:
${framework === 'nextjs-app-router' ? `import Script from 'next/script';
` : ''}import AnalyticsProvider from '${importPattern.providerImport}';

STEP 2: Add tracker script (framework-specific)
${framework === 'nextjs-app-router' ? 
`For Next.js App Router, use the Script component INSIDE <body>:
<Script src="/tracker.js" strategy="beforeInteractive" />
Place it at the beginning of the body content, before AnalyticsProvider.` :
`Add this inside the <head> section:
<script src="/tracker.js" defer></script>`}

STEP 3: Wrap body content with AnalyticsProvider
Find the <body> tag and wrap its content with <AnalyticsProvider>:
- Locate the opening <body> tag (e.g., <body> or <body className="...">)
${framework === 'nextjs-app-router' ? 
`- Add <Script src="/tracker.js" strategy="beforeInteractive" /> as first element in body
- Then add <AnalyticsProvider> wrapper around remaining content` :
`- Add <AnalyticsProvider> right after the opening <body> tag`}
- Keep all the original content exactly the same
- Add </AnalyticsProvider> before the closing </body> tag

FRAMEWORK-SPECIFIC EXAMPLE for ${framework}:
${framework === 'nextjs-app-router' ? `
\`\`\`tsx
import Script from 'next/script';
import AnalyticsProvider from '${importPattern.providerImport}';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Script src="/tracker.js" strategy="beforeInteractive" />
        <AnalyticsProvider>
          {/* all existing body content */}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
\`\`\`
` : `
\`\`\`tsx
import AnalyticsProvider from '${importPattern.providerImport}';

export default function Layout({ children }) {
  return (
    <html>
      <head>
        <script src="/tracker.js" defer></script>
      </head>
      <body>
        <AnalyticsProvider>
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
\`\`\`
`}

CRITICAL: Copy the entire body content exactly as provided. Do not omit, reorder, or modify anything inside the body.

Original file:
${safeContent}`
        }]
      });

      console.log('✅ LLM responded successfully');
      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('   Response length:', content.length, 'chars');
      
      // Debug: Raw LLM response analysis
      console.log('🔍 DEBUG: Raw LLM response length:', content.length);
      console.log('🔍 DEBUG: Raw LLM response preview (first 300 chars):');
      console.log(content.substring(0, 300));
      console.log('🔍 DEBUG: Raw response includes markdown?', content.includes('```'));
      
      // Clean up any potential markdown formatting
      let modifiedCode = content.trim();
      
      // Remove markdown code blocks if present
      const codeBlockMatch = modifiedCode.match(/```(?:typescript|tsx|javascript|jsx)?\s*\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        modifiedCode = codeBlockMatch[1];
        console.log('   Stripped markdown code block');
      }
      
      console.log('   Modified code length:', modifiedCode.length, 'chars');
      
      // Debug: Cleaned response analysis
      console.log('🔍 DEBUG: Cleaned response length:', modifiedCode.length);
      console.log('🔍 DEBUG: Cleaned response preview (first 300 chars):');
      console.log(modifiedCode.substring(0, 300));

      // Structure validation (framework-specific)
      const hasTrackerScript = modifiedCode.includes('tracker.js');
      const hasScriptComponent = modifiedCode.includes('<Script') && modifiedCode.includes("from 'next/script'");
      const hasHead = modifiedCode.includes('<head>');
      
      // For Next.js App Router, Script component should be used (no head required)
      // For other frameworks, head section with script tag should be present
      if (framework === 'nextjs-app-router') {
        if (!hasTrackerScript || !hasScriptComponent) {
          console.error('❌ Next.js App Router: Missing Script component or tracker.js reference');
          throw new Error('Generated layout missing Script component for Next.js App Router');
        }
      } else {
        if (!hasHead || !hasTrackerScript) {
          console.error('❌ Standard framework: Missing head section or tracker script');
          throw new Error('Generated layout missing head section or tracker script');
        }
      }
      
      // Check for empty body content (critical failure)
      const bodyContentMatch = modifiedCode.match(/<AnalyticsProvider>\s*<\/AnalyticsProvider>/);
      if (bodyContentMatch) {
        console.error('❌ CRITICAL: LLM generated empty AnalyticsProvider tags!');
        console.error('   Original body content was lost during generation');
        throw new Error('LLM generated empty body content - failing to fallback');
      }

      // Validate the modified code has required elements
      const file = { content: modifiedCode, path: primaryLayout.path, action: 'modify' };
        
      // Strict validation: check for actual import statements
      const hasProviderImport = /import\s+(?:\w+\s*,\s*)?\{?\s*AnalyticsProvider\s*\}?\s+from\s+['"][^'"]+['"]/.test(file.content) ||
                                /import\s+AnalyticsProvider\s+from\s+['"][^'"]+['"]/.test(file.content);
      const hasScriptImport = file.content.includes("import Script from 'next/script'");
      const hasScript = file.content.includes('tracker.js');
      const hasWrapper = file.content.includes('<AnalyticsProvider');
      const hasClosingTag = file.content.includes('</AnalyticsProvider>');

      // Framework-specific validation
      const isNextAppRouter = framework === 'nextjs-app-router';
      const hasRequiredImports = isNextAppRouter ? (hasProviderImport && hasScriptImport) : hasProviderImport;

      // Debug: Detailed validation checks
      console.log('🔍 DEBUG: Validation checks:');
      console.log({
        framework,
        hasProviderImport: /import.*AnalyticsProvider/.test(modifiedCode),
        hasProviderImportStrict: hasProviderImport,
        hasScriptImport: hasScriptImport,
        hasScript: modifiedCode.includes('tracker.js'),
        hasScriptComponent: modifiedCode.includes('<Script'),
        hasWrapper: modifiedCode.includes('<AnalyticsProvider'),
        hasClosingTag: modifiedCode.includes('</AnalyticsProvider>'),
        hasHead: modifiedCode.includes('<head>'),
        hasBody: modifiedCode.includes('<body>')
      });

      console.log('🔍 LLM Response Validation:', {
        hasRequiredImports,
        hasProviderImport,
        hasScriptImport: isNextAppRouter ? hasScriptImport : 'N/A',
        hasScript,
        hasWrapper,
        hasClosingTag,
        importPattern: importPattern.providerImport
      });

      if (hasRequiredImports && hasWrapper && hasClosingTag) {
        console.log('✅ LLM deployment plan validation passed!');
        return {
          framework: framework,
          files: [
            { 
              path: 'public/tracker.js', 
              action: 'create', 
              content: trackerCode, 
              description: 'Create tracker' 
            },
            { 
              path: importPattern.componentsPath + '/AnalyticsProvider.tsx', 
              action: 'create', 
              content: providerCode, 
              description: 'Create provider' 
            },
            {
              path: primaryLayout.path,
              action: 'modify',
              content: modifiedCode,
              description: 'Add AnalyticsProvider integration'
            }
          ],
          instructions: []
        };
      } else {
        console.error('❌ LLM validation failed:', {
          framework,
          hasRequiredImports,
          hasProviderImport,
          hasScriptImport: isNextAppRouter ? hasScriptImport : 'N/A (not required)',
          hasScript,
          hasWrapper,
          hasClosingTag,
          contentPreview: file.content.substring(0, 500)
        });
      }

      throw new Error(`Invalid LLM response - missing required elements for ${framework}`);
    } catch (error: any) {
      console.error('\n❌ === LLM DEPLOYMENT PLAN FAILED ===');
      console.error('   Error type:', error.constructor.name);
      console.error('   Error message:', error.message);
      
      // Debug: Detailed error information
      console.error('🔍 DEBUG: Error details:', {
        name: error.name,
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        type: error.type
      });
      
      if (error.stack) {
        console.error('   Stack trace:');
        console.error(error.stack.split('\n').slice(0, 5).join('\n'));
      }
      
      console.error('   ⚠️ LLM failed to preserve layout structure correctly');
      console.error('   📋 Falling back to manual integration plan');
      console.error('   → Files will be created but layout requires manual modification\n');
      return this.createFallbackPlan(input.files, trackerCode, providerCode);
    }
  }

  /**
   * Generate implementation with AI-driven insights
   */
  private async generateImplementation(
    input: GeneratorInput,
    events: EventSchema[],
    analysis: ProgressiveAnalysis
  ): Promise<GeneratorOutput> {
    const backend = input.backendUrl || CONFIG.DEFAULT_BACKEND_URL;
    console.log('🔍 BACKEND URL DEBUG:', {
      inputBackendUrl: input.backendUrl,
      envVariable: process.env.ANALYTICS_BACKEND_URL,
      configDefault: CONFIG.DEFAULT_BACKEND_URL,
      finalBackend: backend
    });

    // Extract entry point file
    const entryPoint = await this.extractEntryPoint(input);

    // Detect actual framework from file structure (fallback if AI is wrong)
    const actualFramework = input.files ? this.detectFrameworkFromStructure(input.files) : 'unknown';
    const aiFramework = analysis.discovery.framework;
    const aiIsCorrect = aiFramework === actualFramework;
    
    console.log('🔍 Framework detection in generateImplementation:', {
      aiDiscoveryFramework: aiFramework,
      fileStructureFramework: actualFramework,
      aiMatchesFileStructure: aiIsCorrect,
      usingFramework: actualFramework,
      note: aiIsCorrect ? 'AI correctly identified framework ✓' : 'Using file structure fallback (AI needs prompt improvement)'
    });

    // Generate tracker and provider code
    const trackerCode = this.generateAIEnhancedTracker(input.appKey, backend, analysis);
    const providerCode = this.generateProvider(input.appKey, actualFramework);

    // Generate LLM-driven deployment plan
    const deploymentPlan = await this.generateDeploymentPlan(input, trackerCode, providerCode);

    const output: GeneratorOutput = {
      'tracker.js': trackerCode,
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
      'analytics-provider.tsx': providerCode,
      'analytics.types.ts': this.generateTypes(events),
      'integration-guide.md': this.generateIntegrationGuide(input.appKey, events, analysis),
      deploymentPlan,
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
      // Use context_collection from component directly if available, otherwise from behavior pattern
      const contextCollection = comp.context_collection || (pattern ? pattern.context_collection : null);
      
      return `
        {
            name: '${comp.name}',
            type: '${comp.type}',
            pattern_type: '${comp.pattern_type || 'unknown'}',
            selectors: ${JSON.stringify(comp.selector_patterns)},
            purpose: '${comp.likely_purpose}',
            contextNeeded: ${JSON.stringify(comp.context_needed)},
            context_collection: ${contextCollection ? JSON.stringify(contextCollection) : 'null'},
            relationships: ${comp.relationships ? JSON.stringify(comp.relationships) : 'null'}
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
    constructor(appKey) {
      // ✅ MULTI-TENANCY: Include app_key in storage key for isolation
      // This ensures that multiple apps on the same domain have separate user IDs
      this.appKey = appKey;
      this.STORAGE_KEY = 'analytics_user_id_' + appKey;
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
      // 🎯 ANALYTICS ENDPOINT
      // This tracker connects to the analytics service.
      // Each app is identified by its unique app_key.
      this.config = {
        appKey: '${appKey}',
        endpoint: '${endpoint}',
        batchSize: 10,
        flushInterval: 10000  // Reduced to 10 seconds for faster event delivery
      };
      
      // Privacy controls
      this.disabled = false;
      
      // Check Do Not Track
      if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
        console.log('📵 Analytics disabled: Do Not Track enabled');
        this.disabled = true;
        return;
      }
      
      // Check consent
      try {
        this.hasConsent = localStorage.getItem('analytics_consent_' + this.config.appKey) === 'true';
        
        // Auto-accept for test app (remove in production or prompt user)
        if (!this.hasConsent) {
          localStorage.setItem('analytics_consent_' + this.config.appKey, 'true');
          this.hasConsent = true;
          console.log('✅ Analytics consent: auto-accepted for test');
        }
      } catch (e) {
        this.hasConsent = false;
      }
      
      if (!this.hasConsent) {
        console.log('🚫 Analytics disabled: No consent');
        this.disabled = true;
        return;
      }
      
      this.eventQueue = [];
      this.sessionId = this.getOrCreateSession();
      this.userIdGenerator = new UserIdGenerator(this.config.appKey);
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
      
      // Performance optimization: cache selector matches
      this.selectorCache = new WeakMap();
      
      // AI-discovered component patterns
      this.componentDetectors = [${componentDetectors}
      ];
      
      // Load persisted events from previous session
      this.loadQueueFromStorage();
      
      if (typeof window !== 'undefined') {
        this.setupListeners();
        this.startFlushTimer();
        this.initAutoTracking();
        
        // Save queue on page unload
        window.addEventListener('beforeunload', () => this.saveQueueToStorage());
      }
    }
    
    // Privacy: Opt out of tracking
    optOut() {
      try {
        localStorage.removeItem('analytics_user_id_' + this.config.appKey);
        localStorage.removeItem('analytics_consent_' + this.config.appKey);
        this.disabled = true;
        this.eventQueue = [];
        console.log('📵 Analytics: Opted out');
      } catch (e) {
        console.error('Failed to opt out:', e);
      }
    }
    
    // Offline persistence: Save queue to localStorage
    saveQueueToStorage() {
      if (this.eventQueue.length === 0) return;
      
      try {
        const queueKey = 'analytics_queue_' + this.config.appKey;
        localStorage.setItem(queueKey, JSON.stringify(this.eventQueue));
      } catch (e) {
        // Silent fail
      }
    }
    
    // Offline persistence: Load queue from localStorage
    loadQueueFromStorage() {
      try {
        const queueKey = 'analytics_queue_' + this.config.appKey;
        const saved = localStorage.getItem(queueKey);
        if (saved) {
          const parsedQueue = JSON.parse(saved);
          this.eventQueue = parsedQueue;
          localStorage.removeItem(queueKey);
          console.log('📦 Restored', parsedQueue.length, 'events from storage');
          
          // Flush restored events immediately
          if (this.eventQueue.length > 0) {
            setTimeout(() => this.flush(), 1000);
          }
        }
      } catch (e) {
        // Silent fail
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
      console.log('[${appKey}] 🤖 AI-Enhanced Analytics initialized');
      console.log('[${appKey}] 📊 Tracking ${analysis.discovery.components.length} discovered components');
      console.log('[${appKey}] 🔑 User ID:', this.userId);
      console.log('[${appKey}] 📍 Session ID:', this.sessionId);
      
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

    // ============ ENHANCED CONTEXT EXTRACTION SYSTEM ============
    extractContext(element, componentInfo) {
      const context = {};
      
      // If no AI pattern matched, use smart fallbacks
      if (!componentInfo || !componentInfo.context_collection) {
        // Fallback 1: Extract from nearest form
        const form = element.closest('form');
        if (form) {
          context.form_action = this.inferFormAction(form);
          const formData = this.getFormFieldValues(form);
          Object.assign(context, formData);
        }
        
        // Fallback 2: Extract from URL parameters
        const urlParams = this.getURLParams();
        if (Object.keys(urlParams).length > 0) {
          Object.assign(context, urlParams);
        }
        
        // Fallback 3: Extract from page-level data attributes
        if (document.body.dataset.pageType) {
          context.page_type = document.body.dataset.pageType;
        } else {
          context.page_type = this.inferPageType();
        }
        
        // Fallback 4: Extract from nearest container with data attributes
        const container = element.closest('[data-item-id], [data-task-id], [data-project-id], [data-id]');
        if (container) {
          for (const attr of container.attributes) {
            if (attr.name.startsWith('data-')) {
              const key = attr.name.replace('data-', '');
              context[key] = attr.value;
            }
          }
        }
        
        return context;
      }
      
      // Use AI-discovered pattern for extraction
      const scope = this.findContextScope(element, componentInfo.context_collection.scope_selector);
      if (!scope) return context;
      
      // Extract configured fields
      for (const fieldConfig of componentInfo.context_collection.fields) {
        try {
          const value = this.extractFieldValue(scope, fieldConfig);
          if (value !== null && value !== undefined) {
            context[fieldConfig.field_name] = value;
            
            // Track previous value if configured
            if (componentInfo.context_collection.state_tracking?.track_previous_value) {
              const prevValue = this.getPreviousValue(scope, fieldConfig);
              if (prevValue !== null) {
                context[fieldConfig.field_name + '_previous'] = prevValue;
              }
            }
          }
        } catch (error) {
          // Silent fail - fallbacks will handle it
        }
      }
      
      // Add timing if configured
      if (componentInfo.context_collection.state_tracking?.track_timing) {
        context._interaction_timestamp = Date.now();
      }
      
      // Always add page type and URL params as supplementary context
      context.page_type = context.page_type || this.inferPageType();
      const urlParams = this.getURLParams();
      if (Object.keys(urlParams).length > 0) {
        context.url_params = urlParams;
      }
      
      return context;
    }

    findContextScope(element, scopeSelector) {
      if (!scopeSelector) return element;
      
      // Try exact scope first
      let scope = element.closest(scopeSelector);
      if (scope) return scope;
      
      // Fallback to common patterns
      return element.closest('form') ||
             element.closest('[role="dialog"]') ||
             element.closest('[data-form]') ||
             element.closest('[data-component]') ||
             element.closest('[data-item-id]') ||
             element.closest('tr') ||
             element.closest('li') ||
             element.closest('section') ||
             element;
    }

    extractFieldValue(scope, fieldConfig) {
      let targetElement;
      
      // Handle special 'count' extraction
      if (fieldConfig.extraction_method === 'count') {
        const elements = scope.querySelectorAll(fieldConfig.selector);
        return elements.length;
      }
      
      targetElement = scope.querySelector(fieldConfig.selector);
      
      // If selector failed, try flexible alternatives for form fields
      if (!targetElement && fieldConfig.extraction_method === 'value') {
        const fieldName = fieldConfig.field_name;
        // Try: input[name], input[id], input[id*=contains], input[placeholder*=contains]
        const flexibleSelector = \`input[name='\${fieldName}'], input[id='\${fieldName}'], input[id*='\${fieldName}'], input[placeholder*='\${fieldName}'], textarea[name='\${fieldName}'], textarea[id='\${fieldName}'], select[name='\${fieldName}'], select[id='\${fieldName}']\`;
        targetElement = scope.querySelector(flexibleSelector);
      }
      
      // Quick Win: Extract IDs from URLs if element still not found
      if (!targetElement && fieldConfig.field_name.includes('_id')) {
        const href = scope.getAttribute?.('href') || window.location.pathname;
        const match = href.match(/\/(projects|tasks|team|activity)\/([a-f0-9-]+)/i);
        if (match) return match[2];  // Return the UUID
      }
      
      if (!targetElement) return null;
      
      switch (fieldConfig.extraction_method) {
        case 'value':
          return this.coerceType(targetElement.value, fieldConfig.data_type);
        
        case 'checked':
          if (fieldConfig.data_type === 'array') {
            // Multiple checkboxes - collect all checked values
            const checked = scope.querySelectorAll(fieldConfig.selector + ':checked');
            const values = Array.from(checked).map(el => {
              return fieldConfig.attribute_name ? 
                el.getAttribute(fieldConfig.attribute_name) : 
                el.value;
            });
            return values;
          }
          return targetElement.checked;
        
        case 'textContent':
          return targetElement.textContent.trim();
        
        case 'data-attribute':
          const attrName = fieldConfig.attribute_name || 'data-value';
          return this.coerceType(
            targetElement.getAttribute(attrName), 
            fieldConfig.data_type
          );
        
        case 'aria-attribute':
          const ariaAttr = 'aria-' + (fieldConfig.attribute_name || 'value');
          return targetElement.getAttribute(ariaAttr);
        
        case 'class-state':
          // Extract state from class names
          const classes = Array.from(targetElement.classList);
          if (fieldConfig.attribute_name) {
            // Look for specific class pattern
            const pattern = new RegExp(fieldConfig.attribute_name);
            const match = classes.find(c => pattern.test(c));
            return match || null;
          }
          return classes.join(' ');
        
        case 'computed-style':
          const style = window.getComputedStyle(targetElement);
          return style[fieldConfig.attribute_name || 'display'];
        
        default:
          return targetElement.value || targetElement.textContent;
      }
    }

    getPreviousValue(scope, fieldConfig) {
      const el = scope.querySelector(fieldConfig.selector);
      if (!el) return null;
      
      // Check for data-previous-value attribute
      const prevAttr = el.getAttribute('data-previous-value');
      if (prevAttr) return this.coerceType(prevAttr, fieldConfig.data_type);
      
      // Check for aria-valuenow vs aria-valuemin (state change)
      const ariaNow = el.getAttribute('aria-valuenow');
      if (ariaNow) return this.coerceType(ariaNow, fieldConfig.data_type);
      
      return null;
    }

    coerceType(value, dataType) {
      if (value === null || value === undefined) return value;
      if (!dataType) return value;
      
      switch (dataType) {
        case 'number':
          const num = Number(value);
          return isNaN(num) ? null : num;
        case 'boolean':
          return value === 'true' || value === true || value === '1';
        case 'array':
          return Array.isArray(value) ? value : [value];
        case 'object':
          try {
            return typeof value === 'string' ? JSON.parse(value) : value;
          } catch {
            return value;
          }
        default:
          return String(value);
      }
    }

    // ============ SMART CONTEXT FALLBACK HELPERS ============
    
    inferPageType() {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/pricing')) return 'pricing';
      if (path.includes('/checkout')) return 'checkout';
      if (path.includes('/dashboard')) return 'dashboard';
      if (path.includes('/settings')) return 'settings';
      if (path.includes('/team')) return 'team';
      if (path.includes('/projects')) return 'projects';
      if (path.includes('/tasks')) return 'tasks';
      if (path.includes('/activity')) return 'activity';
      if (path.includes('/billing')) return 'billing';
      if (path === '/' || path === '') return 'home';
      return 'other';
    }
    
    getURLParams() {
      const params = {};
      try {
        const urlParams = new URLSearchParams(window.location.search);
        for (const [key, value] of urlParams) {
          params[key] = value;
        }
      } catch (e) {
        // Silent fail
      }
      return params;
    }
    
    inferFormAction(form) {
      // Try to infer action from form attributes
      if (form.action && form.action !== window.location.href) {
        const actionPath = new URL(form.action, window.location.origin).pathname;
        if (actionPath.includes('project')) return 'create_project';
        if (actionPath.includes('task')) return 'create_task';
        if (actionPath.includes('checkout')) return 'checkout';
        if (actionPath.includes('payment')) return 'payment';
        if (actionPath.includes('invite')) return 'invite_team';
        if (actionPath.includes('settings')) return 'update_settings';
        return actionPath;
      }
      
      // Infer from form ID or name
      const formId = (form.id || form.name || '').toLowerCase();
      if (formId.includes('project')) return 'create_project';
      if (formId.includes('task')) return 'create_task';
      if (formId.includes('checkout')) return 'checkout';
      if (formId.includes('payment')) return 'payment';
      if (formId.includes('invite')) return 'invite_team';
      if (formId.includes('login')) return 'login';
      if (formId.includes('signup')) return 'signup';
      if (formId.includes('settings')) return 'update_settings';
      
      // Infer from submit button text
      const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitButton) {
        const buttonText = (submitButton.textContent || submitButton.value || '').toLowerCase();
        if (buttonText.includes('project')) return 'create_project';
        if (buttonText.includes('task')) return 'create_task';
        if (buttonText.includes('checkout') || buttonText.includes('pay')) return 'checkout';
        if (buttonText.includes('invite')) return 'invite_team';
        if (buttonText.includes('save')) return 'save_changes';
      }
      
      return 'form_submit';
    }
    
    getFormFieldValues(form) {
      const data = {};
      
      try {
        const formData = new FormData(form);
        for (const [key, value] of formData) {
          // Skip empty values and passwords
          if (!value || key.toLowerCase().includes('password')) continue;
          
          // Sanitize sensitive fields
          if (key.toLowerCase().includes('card') || key.toLowerCase().includes('cvv')) {
            data[key] = '[REDACTED]';
          } else if (key.toLowerCase().includes('email')) {
            // Anonymize email
            data[key] = this.anonymizeEmail(value);
          } else {
            // Truncate long values
            data[key] = String(value).slice(0, 100);
          }
        }
      } catch (e) {
        // Silent fail
      }
      
      return data;
    }
    
    anonymizeEmail(email) {
      try {
        const [local, domain] = email.split('@');
        if (!domain) return '[EMAIL]';
        const maskedLocal = local.charAt(0) + '***' + local.charAt(local.length - 1);
        return maskedLocal + '@' + domain;
      } catch {
        return '[EMAIL]';
      }
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
          
          // Extract rich context using pattern-based extraction
          const contextData = componentInfo ? this.extractContext(element, componentInfo) : {};
          
          // Build event data
          const eventData = {
            element_text: this.getElementText(element).slice(0, 100),
            element_id: element.id || null,
            element_type: this.getButtonType(element),
            surface: this.getSurface(element),
            page_path: window.location.pathname,
            is_primary_cta: this.isPrimaryCTA(element),
            cta_category: this.getCTACategory(element, componentInfo),
            pattern_type: componentInfo?.pattern_type || null
          };
          
          // Only add context if it has meaningful data (not empty object)
          if (contextData && Object.keys(contextData).length > 0) {
            eventData.context = contextData;
          }
          
          this.trackEvent('BUTTON_CLICK', eventData);
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
        
        // If form is inside a modal, also track MODAL_INTERACTION with submitted action
        const modal = form.closest('[role="dialog"]') || 
                      form.closest('.modal') || 
                      form.closest('[data-modal]') ||
                      form.closest('[class*="modal"]');
        
        if (modal) {
          const componentInfo = this.detectComponent(modal);
          const context = componentInfo ? this.extractContext(modal, componentInfo) : {};
          
          this.trackEvent('MODAL_INTERACTION', {
            action: 'submitted',
            modal_name: this.getElementName(modal),
            modal_id: modal.id || null,
            trigger_source: 'button_click',
            page_path: window.location.pathname,
            context: context
          });
        }
        
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
      // Track modal/popup/dialog visibility with debouncing for performance
      let mutationTimer;
      const debouncedHandler = (mutations) => {
        clearTimeout(mutationTimer);
        mutationTimer = setTimeout(() => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'class' || 
               mutation.attributeName === 'style' || 
                 mutation.attributeName === 'aria-hidden' ||
                 mutation.attributeName === 'data-state')) {
            
            const element = mutation.target;
            const isOverlay = this.isOverlayElement(element);
            
            if (isOverlay) {
              const isVisible = this.isElementVisible(element);
              const wasVisible = this.visibleElements.get(element);
                const overlayType = this.getOverlayType(element);
                const isModal = overlayType === 'modal' || element.getAttribute('role') === 'dialog';
              
              if (isVisible && !wasVisible) {
                this.visibleElements.set(element, true);
                
                // Use MODAL_INTERACTION for modals, ELEMENT_VISIBILITY for others
                if (isModal) {
                  const componentInfo = this.detectComponent(element);
                  const context = componentInfo ? this.extractContext(element, componentInfo) : {};
                  
                  this.trackEvent('MODAL_INTERACTION', {
                    action: 'opened',
                    modal_name: this.getElementName(element),
                    modal_id: element.id || null,
                    trigger_source: 'button_click',
                    page_path: window.location.pathname,
                    context: context
                  });
                } else {
                this.trackEvent('ELEMENT_VISIBILITY', {
                  action: 'shown',
                    element_type: overlayType,
                  element_name: this.getElementName(element),
                  element_id: element.id || null,
                  trigger_source: 'auto_trigger',
                  page_path: window.location.pathname,
                  has_cta: this.hasCallToAction(element)
                });
                }
              } else if (!isVisible && wasVisible) {
                this.visibleElements.set(element, false);
                
                // Use MODAL_INTERACTION for modals, ELEMENT_VISIBILITY for others
                if (isModal) {
                  const componentInfo = this.detectComponent(element);
                  const context = componentInfo ? this.extractContext(element, componentInfo) : {};
                  
                  this.trackEvent('MODAL_INTERACTION', {
                    action: 'closed',
                    modal_name: this.getElementName(element),
                    modal_id: element.id || null,
                    trigger_source: 'button_click',
                    page_path: window.location.pathname,
                    context: context
                  });
                } else {
                this.trackEvent('ELEMENT_VISIBILITY', {
                  action: 'hidden',
                    element_type: overlayType,
                  element_name: this.getElementName(element),
                  element_id: element.id || null,
                  trigger_source: 'button_click',
                  page_path: window.location.pathname,
                  has_cta: this.hasCallToAction(element)
                });
                }
              }
            }
          }
        });
        }, 50);  // 50ms debounce
      };
      
      const observer = new MutationObserver(debouncedHandler);

      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'style', 'aria-hidden', 'data-state']
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
      // Check if tracking is disabled
      if (this.disabled) return;
      
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
      })
      .then(response => {
        if (!response.ok) {
          console.error('[${appKey}] Analytics flush failed:', response.status);
          // Re-add to queue and persist on failure
        this.eventQueue.unshift(...batch);
          this.saveQueueToStorage();
        }
      })
      .catch(err => {
        console.error('[${appKey}] Analytics flush error:', err);
        // Re-add to queue and persist on failure
        this.eventQueue.unshift(...batch);
        this.saveQueueToStorage();
      });
    }
  }

  // Auto-initialize
  if (typeof window !== 'undefined' && !window.analytics) {
    window.analytics = new AnalyticsTracker();
    console.log('[${appKey}] ✅ AI-Enhanced Analytics tracker with new event schema initialized');
  }

  return AnalyticsTracker;
}));`;
  }

  /**
   * Helper to extract JSON from LLM response
   */
  /**
   * Helper to extract JSON from LLM response with repair attempts
   */
  private extractJSON(content: string): any {
    // Strategy 1: Look for markdown code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      console.log('📦 Found markdown code block, extracting...');
      try {
        const jsonContent = codeBlockMatch[1].trim();
        const parsed = JSON.parse(jsonContent);
        console.log('✅ Successfully parsed JSON from code block');
        console.log('📊 Result:', {
          framework: parsed.framework,
          componentCount: parsed.components?.length || 0
        });
        return parsed;
      } catch (e: any) {
        console.log('❌ Code block parse failed:', e.message);
        console.log('🔍 First 500 chars of code block:', codeBlockMatch[1].substring(0, 500));
        
        // Try to fix common issues
        try {
          let fixed = codeBlockMatch[1].trim();
          // Remove trailing commas before closing brackets
          fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
          // Remove comments
          fixed = fixed.replace(/\/\/.*$/gm, '');
          // Fix unescaped quotes in strings
          fixed = fixed.replace(/(['"])(.*?)\1/g, (match, quote, content) => {
            const escaped = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            return quote + escaped + quote;
          });
          
          const parsed = JSON.parse(fixed);
          console.log('✅ Successfully parsed after auto-fix');
          return parsed;
        } catch (e2: any) {
          console.log('❌ Auto-fix failed:', e2.message);
        }
      }
    }

    // Strategy 2: Find JSON by structure (starting with { and proper depth tracking)
    try {
      const jsonObj = this.extractJSONObject(content);
      if (jsonObj) {
        console.log('📦 Found JSON object by structure...');
        const parsed = JSON.parse(jsonObj);
        console.log('✅ Successfully parsed JSON object');
        return parsed;
      }
    } catch (e: any) {
      console.log('❌ Structural JSON extraction failed:', e.message);
    }

    // Strategy 3: Try to fix and parse
    try {
      const fixed = this.fixMalformedJSON(content);
      console.log('🔧 Attempting to parse fixed JSON...');
      const parsed = JSON.parse(fixed);
      console.log('✅ Successfully parsed after fixing');
      return parsed;
    } catch (e: any) {
      console.log('❌ Fixed JSON parse failed:', e.message);
      console.log('🔍 Error at position:', (e as any).position || 'unknown');
    }

    // Strategy 4: Try more aggressive cleaning
    try {
      console.log('🔨 Attempting aggressive JSON repair...');
      let cleaned = content;
      
      // Remove everything before first {
      const firstBrace = cleaned.indexOf('{');
      if (firstBrace > 0) {
        cleaned = cleaned.substring(firstBrace);
      }
      
      // Remove everything after last }
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > 0) {
        cleaned = cleaned.substring(0, lastBrace + 1);
      }
      
      // Remove trailing commas
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      
      // Remove line comments
      cleaned = cleaned.replace(/\/\/.*$/gm, '');
      
      // Remove block comments
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Fix invalid pseudo-selectors (AI sometimes creates these)
      cleaned = cleaned.replace(/"selector":\s*"(state|props|searchParams|context):([^"]+)"/g, 
        '"selector": "[data-$1-$2]"');
      
      const parsed = JSON.parse(cleaned);
      console.log('✅ Successfully parsed with aggressive cleaning');
      console.log('📊 Found:', parsed.components?.length || 0, 'components');
      return parsed;
    } catch (e: any) {
      console.log('❌ Aggressive repair failed:', e.message);
      console.log('🔍 Parse error position:', e.message.match(/position (\d+)/)?.[1] || 'unknown');
    }

    // Strategy 5: Complete truncated JSON (AI hit token limit)
    try {
      console.log('🩹 Attempting to complete truncated JSON...');
      let cleaned = content;
      
      // Remove markdown wrapper
      cleaned = cleaned.replace(/```(?:json)?\s*\n?/g, '');
      
      // Remove everything before first {
      const firstBrace = cleaned.indexOf('{');
      if (firstBrace > 0) {
        cleaned = cleaned.substring(firstBrace);
      }
      
      // Check for incomplete fields at the end
      // Common patterns: "field": or "field": [ or "field": {
      const incompletePatterns = [
        /,?\s*"[^"]+"\s*:\s*$/,           // "field":
        /,?\s*"[^"]+"\s*:\s*\[?\s*$/,    // "field": [
        /,?\s*"[^"]+"\s*:\s*\{?\s*$/     // "field": {
      ];
      
      for (const pattern of incompletePatterns) {
        if (pattern.test(cleaned)) {
          console.log('🔍 Detected incomplete field, removing...');
          cleaned = cleaned.replace(pattern, '');
        }
      }
      
      // Count open vs closed brackets
      const openBraces = (cleaned.match(/\{/g) || []).length;
      const closeBraces = (cleaned.match(/\}/g) || []).length;
      const openBrackets = (cleaned.match(/\[/g) || []).length;
      const closeBrackets = (cleaned.match(/\]/g) || []).length;
      
      console.log('🔍 Bracket count:', {
        braces: { open: openBraces, close: closeBraces, missing: openBraces - closeBraces },
        brackets: { open: openBrackets, close: closeBrackets, missing: openBrackets - closeBrackets }
      });
      
      // Close any open brackets/braces
      for (let i = 0; i < (openBrackets - closeBrackets); i++) {
        cleaned += '\n]';
      }
      for (let i = 0; i < (openBraces - closeBraces); i++) {
        cleaned += '\n}';
      }
      
      // Remove trailing commas
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      
      const parsed = JSON.parse(cleaned);
      console.log('✅ Successfully completed and parsed truncated JSON!');
      console.log('📊 Recovered:', parsed.components?.length || 0, 'components');
      return parsed;
    } catch (e: any) {
      console.log('❌ JSON completion failed:', e.message);
    }

    // Final fallback - save raw response for manual inspection
    console.error('⚠️ All parsing methods failed!');
    console.error('📄 Response length:', content.length);
    console.error('📝 First 1000 chars:', content.substring(0, 1000));
    console.error('📝 Last 500 chars:', content.substring(content.length - 500));
    return { framework: 'unknown', components: [] };
  }
  private extractJSONObject(content: string): string | null {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      // Handle string context
      if (!escapeNext && char === '"' && (i === 0 || content[i - 1] !== '\\')) {
        inString = !inString;
      }

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      // Only count braces outside of strings
      if (!inString) {
        if (char === '{') {
          if (depth === 0) startIdx = i;
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && startIdx !== -1) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      return content.substring(startIdx, endIdx + 1);
    }

    return null;
  }

  private fixMalformedJSON(content: string): string {
    // Extract potential JSON
    let json = content;

    // If there's extra text before/after JSON, try to isolate it
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      json = content.substring(startIdx, endIdx + 1);
    }

    // Fix common issues
    json = json
      // Remove comments
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Fix trailing commas
      .replace(/,(\s*[}\]])/g, '$1')
      // Fix line breaks in strings (replace with spaces)
      .replace(/"([^"]*)\n([^"]*?)"/g, '"$1 $2"')
      // Fix unescaped quotes in strings (basic)
      .replace(/"([^"]*)":\s*"([^"]*)"([^,}\]]*[,}\]])/g, (match, key, value, after) => {
        // Check if value has unescaped quotes
        if (value.includes('"') && !value.includes('\\"')) {
          value = value.replace(/"/g, '\\"');
        }
        return `"${key}": "${value}"${after}`;
      })
      // Fix array issues - missing commas between elements
      .replace(/\](\s*)\[/g, '],$1[')
      .replace(/\}(\s*)\{/g, '},$1{')
      .replace(/"(\s*)"/g, '",$1"')
      // Clean up multiple commas
      .replace(/,+/g, ',')
      // Remove empty array elements
      .replace(/\[,/g, '[')
      .replace(/,\]/g, ']')
      // Fix unquoted keys
      .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
      // Remove control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Special fix for array syntax errors
    // Find arrays and ensure they're properly formatted
    json = json.replace(/\[[^\]]*\]/g, (match) => {
      // Check if array elements are properly separated
      let fixed = match
        .replace(/"\s+"/g, '","')  // Add commas between string elements
        .replace(/\}\s+\{/g, '},{') // Add commas between object elements
        .replace(/\]\s+\[/g, '],[') // Add commas between array elements
        .replace(/([^,\[])\s*"/g, '$1,"') // Add comma before quoted strings if missing
        .replace(/"\s*([^,\]])/g, '",$1'); // Add comma after quoted strings if missing

      // Clean up any double commas we might have created
      fixed = fixed.replace(/,+/g, ',').replace(/\[,/g, '[').replace(/,\]/g, ']');

      return fixed;
    });

    return json;
  }

  private cleanJSONString(jsonString: string): string {
    return jsonString
      // Remove trailing commas before } or ]
      .replace(/,(\s*[}\]])/g, '$1')
      // Remove line comments
      .replace(/\/\/.*$/gm, '')
      // Remove block comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Fix escaped quotes that shouldn't be escaped
      .replace(/\\"/g, '"')
      // Remove any BOM or zero-width characters
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');
  }

  private aggressiveJSONClean(jsonString: string): string {
    // More aggressive cleaning for badly formatted JSON
    return jsonString
      // First apply standard cleaning
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Fix unquoted keys (more comprehensive)
      .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
      // Fix single quotes to double quotes (but not in values)
      .replace(/([{,:\[])\s*'([^']*)'\s*([,}\]:])/g, '$1"$2"$3')
      // Remove control characters except newlines and tabs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Fix multiple consecutive commas
      .replace(/,+/g, ',')
      // Remove commas before closing braces/brackets
      .replace(/,(\s*[}\]])/g, '$1')
      // Escape unescaped quotes inside string values (basic attempt)
      .replace(/"([^"]*)":\s*"([^"]*(?:[^\\]")[^"]*)"/g, (match, key, value) => {
        const fixedValue = value.replace(/(?<!\\)"/g, '\\"');
        return `"${key}": "${fixedValue}"`;
      })
      // Remove any trailing content after the last }
      .replace(/}[\s\S]*$/, '}');
  }
  /**
   * Attempt to repair common JSON issues
   */
  private attemptJSONRepair(jsonString: string): any {
    try {
      // Remove trailing commas
      let repaired = jsonString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

      // Fix unescaped quotes in string values
      repaired = repaired.replace(/"([^"]*)":\s*"([^"]*)"/g, (match, key, value) => {
        const fixedValue = value.replace(/(?<!\\)"/g, '\\"');
        return `"${key}": "${fixedValue}"`;
      });

      // Remove comments
      repaired = repaired.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

      // Fix missing quotes around keys
      repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

      // Remove any text after the last closing brace
      const lastBrace = repaired.lastIndexOf('}');
      if (lastBrace !== -1) {
        repaired = repaired.substring(0, lastBrace + 1);
      }

      return JSON.parse(repaired);
    } catch (e) {
      console.log('JSON repair failed:', e);
      return null;
    }
  }

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
  private async saveOutput(output: GeneratorOutput, repoId: string, appKey: string, progressCallback?: string): Promise<string> {
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
      await this.sendProgress(progressCallback, '✅ Analysis complete!');
    }


    return localOutputPath;
  }


  private generateProvider(appKey: string, framework?: string): string {
    // Detect if this is Next.js App Router (needs "use client" directive for React hooks)
    // Other React frameworks don't need/support this directive
    console.log('🔍 generateProvider called with framework:', framework);
    
    const frameworkLower = framework?.toLowerCase() || '';
    const isNextAppRouter = frameworkLower.includes('nextjs-app') || 
                           frameworkLower.includes('next.js app');
    
    console.log('🔍 Framework detection:', {
      framework,
      frameworkLower,
      isNextAppRouter,
      includesNextjsApp: frameworkLower.includes('nextjs-app'),
      includesNextjsSpace: frameworkLower.includes('next.js app')
    });
    
    const clientDirective = isNextAppRouter ? `'use client';\n\n` : '';
    
    console.log('🔍 Client directive:', clientDirective ? '"use client" will be added' : 'No "use client" directive');
    
    return `${clientDirective}import React, { createContext, useState, useEffect } from 'react';

export const AnalyticsContext = createContext({
  appKey: '',
  sessionId: '',
  userId: null as string | null
});

function AnalyticsProvider({ 
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
}

export default AnalyticsProvider;`;
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
    pattern_type: string | null;
    context?: Record<string, any>;  // Optional - only for forms, bulk actions, state changes
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

export interface ModalInteractionEvent extends BaseEvent {
  event_type: 'MODAL_INTERACTION';
  data: {
    action: 'opened' | 'closed' | 'submitted' | 'dismissed';
    modal_name: string;
    modal_id: string | null;
    trigger_source: 'button_click' | 'auto_trigger' | 'other';
    page_path: string;
    context: Record<string, any>;
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
  | ModalInteractionEvent
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

### MODAL_INTERACTION
Tracks modal dialogs specifically with fields: action (opened/closed/submitted/dismissed), modal_name, modal_id, trigger_source, page_path, context
- Automatically captures context from the modal (form fields, product info, etc.)
- Distinguishes between opened, closed, submitted, and dismissed actions

### ELEMENT_VISIBILITY
Tracks other overlay elements (popups, tooltips, dropdowns) with fields: action, element_type, element_name, element_id, trigger_source, page_path, has_cta

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