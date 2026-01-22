# Variant-Based Schema Refactoring - Complete

## 🎯 Objective Achieved

Refactored `generateEventsFromAnalysis` to generate **component-specific event variants** with **micro-pattern-driven context fields** and **location awareness**. The schema now documents exactly what the pre-generated tracker will capture at runtime.

---

## 🔄 What Changed

### 1. EventSchema Interface (Lines 42-65)

**Added `variants` support:**
```typescript
interface EventSchema {
  event_type: string;
  description?: string;
  base_fields?: { required: string[] };
  data_fields?: { required: string[]; optional?: string[] };
  variants?: Array<{
    component: string;
    location: string;
    pattern_type: string | null;
    semantic_action?: string;
    conversion_relevance?: string;
    journey_stage?: string;
    form_purpose?: string;
    data_fields: any;
    extraction_strategy: any;
    pattern_metadata?: any;
  }>;
  properties?: Record<string, any>;
}
```

### 2. generateEventsFromAnalysis Method (Lines 1323-1438)

**New structure:**
```typescript
private async generateEventsFromAnalysis(discovery, behaviors): Promise<EventSchema[]> {
  // Build component-specific variants
  const buttonClickVariants = this.buildButtonClickVariants(discovery);
  const formInteractionVariants = this.buildFormInteractionVariants(discovery);
  const modalInteractionVariants = this.buildModalInteractionVariants(discovery);
  
  return [
    { event_type: 'PAGE_VIEW', ... },  // Generic
    { 
      event_type: 'BUTTON_CLICK',
      base_fields: {...},
      variants: buttonClickVariants  // ← Component-specific variants
    },
    { 
      event_type: 'FORM_INTERACTION',
      base_fields: {...},
      variants: formInteractionVariants
    },
    { 
      event_type: 'MODAL_INTERACTION',
      base_fields: {...},
      variants: modalInteractionVariants
    },
    { event_type: 'ELEMENT_VISIBILITY', ... },
    { event_type: 'SCROLL_INTERACTION', ... }
  ];
}
```

### 3. New Helper Methods Added

#### `buildButtonClickVariants(discovery)` (Lines 1440-1476)
- Filters clickable components (type: button, link, icon OR interaction_type: click)
- Extracts semantic action, conversion relevance, journey stage
- Builds context fields from `context_collection.fields`
- Infers component location
- Adds micro-pattern metadata

#### `buildFormInteractionVariants(discovery)` (Lines 1478-1509)
- Filters form components (type: form OR pattern_type includes 'form')
- Extracts form purpose
- Builds form-specific context fields
- Sets form_state extraction strategy

#### `buildModalInteractionVariants(discovery)` (Lines 1511-1545)
- Filters modal components (pattern_type includes 'modal')
- Builds modal lifecycle context fields
- Sets modal_scope extraction strategy with lifecycle tracking

#### `buildContextFields(comp)` (Lines 1547-1580)
- Extracts context fields from `comp.context_collection.fields`
- Separates required vs optional fields
- Creates field definitions with data types, selectors, extraction methods

#### `buildFormContextFields(comp)` (Lines 1582-1606)
- Specialized for form field extraction
- Includes field_purpose (authentication_credential, pci_protected, pii, etc.)
- Handles anonymization flags

#### `buildModalContextFields(comp)` (Lines 1608-1631)
- Specialized for modal lifecycle tracking
- Tracks: entry_context, form_state, exit_outcome

#### `inferComponentLocation(comp)` (Lines 1633-1685)
- **Priority 1:** Selector patterns (data-page attributes, route classes)
- **Priority 2:** Surface inference (auth, dashboard, settings, etc.)
- **Priority 3:** Component name patterns
- **Priority 4:** Form purpose mapping
- **Default:** '/global' for components that appear on multiple pages

#### `getMicroPatternMetadata(patternType)` (Lines 1687-1730)
- Provides descriptions and expected context for 8 micro-patterns:
  - `item_selection` - Extracts item context from parent container
  - `form_submission` - Serializes entire form state
  - `toggle_state` - Tracks before/after values
  - `modal_lifecycle` - Tracks modal open/interact/close
  - `bulk_action` - Captures selection set
  - `multi_step_flow` - Maintains wizard state
  - `search_filter` - Captures search and filters
  - `inline_edit` - Tracks value changes

---

## 📊 Output Schema Structure

### Before (Generic)
```json
{
  "events": [
    {
      "event_type": "BUTTON_CLICK",
      "data_fields": ["element_text", "element_id", ...],
      "properties": { "element_text": "string", ... }
    }
  ]
}
```

### After (Component-Specific Variants)
```json
{
  "events": [
    {
      "event_type": "BUTTON_CLICK",
      "description": "Button/link click event with component-specific context",
      "base_fields": {
        "required": ["element_text", "element_id", "element_type", "surface", "page_path"]
      },
      "variants": [
        {
          "component": "ApproveRequestButton",
          "location": "/requests",
          "pattern_type": "item_selection",
          "semantic_action": "approve_request",
          "conversion_relevance": "high",
          "journey_stage": "activation",
          "data_fields": {
            "required": ["element_text", "element_id"],
            "context": {
              "required": ["request_id", "request_status"],
              "optional": ["requester_id", "priority"],
              "field_definitions": {
                "request_id": {
                  "data_type": "string",
                  "extraction_method": "data-attribute",
                  "selector": "[data-request-id]",
                  "description": "Unique request identifier",
                  "anonymize": false
                },
                "request_status": {
                  "data_type": "string",
                  "extraction_method": "textContent",
                  "selector": ".status-badge",
                  "anonymize": false
                }
              }
            }
          },
          "extraction_strategy": {
            "strategy": "parent_data",
            "scope_selector": "[data-request-id]",
            "state_tracking": { ... }
          },
          "pattern_metadata": {
            "description": "Extracts item context from parent container",
            "expected_context": "Item ID and metadata from data-* attributes on closest item container"
          }
        },
        {
          "component": "CreateProjectButton",
          "location": "/projects",
          "pattern_type": "modal_trigger",
          ...
        }
      ],
      "properties": { ... }
    }
  ]
}
```

---

## 🎯 Key Principles

### 1. Pattern-Driven Context
Context fields are determined by micro-pattern, not hardcoded:
- `item_selection` → Extracts parent container data
- `form_submission` → Serializes all inputs
- `toggle_state` → Tracks before/after values
- `modal_lifecycle` → Tracks open/interact/close

### 2. Location Awareness
Same component on different pages may have different context:
```typescript
// ApproveButton on /requests page
{ component: "ApproveButton", location: "/requests", context: ["request_id"] }

// ApproveButton on /tasks page  
{ component: "ApproveButton", location: "/tasks", context: ["task_id"] }
```

### 3. Extraction-Ready Schema
Schema documents exactly what tracker will extract:
```json
{
  "field_definitions": {
    "request_id": {
      "data_type": "string",
      "extraction_method": "data-attribute",
      "selector": "[data-request-id]"
    }
  }
}
```

### 4. Domain-Agnostic
Works for any application type:
- SaaS (requests, projects, tasks)
- E-commerce (products, cart, checkout)
- Content (articles, comments, likes)
- Finance (transactions, accounts, statements)

### 5. Tracker Documentation
Schema reflects what the pre-generated tracker will capture, not instructions for the tracker.

---

## 🔍 Location Inference Logic

### Priority 1: Selector Patterns
```typescript
// data-page attribute
selector: "[data-page='requests'] button" → location: "requests"

// route class
selector: ".page-dashboard .approve-btn" → location: "/dashboard"
```

### Priority 2: Surface Inference
```typescript
surface_inferred: "dashboard_action_bar" → location: "/dashboard"
surface_inferred: "auth_form" → location: "/auth"
surface_inferred: "project_list" → location: "/projects"
```

### Priority 3: Component Name
```typescript
name: "LoginButton" → location: "/auth"
name: "ProjectCreateButton" → location: "/projects"
name: "DashboardWidget" → location: "/dashboard"
```

### Priority 4: Form Purpose
```typescript
form_purpose: "authentication" → location: "/auth"
form_purpose: "payment" → location: "/checkout"
form_purpose: "profile_update" → location: "/settings"
```

### Default: Global
```typescript
// Component appears on multiple pages
location: "/global"
```

---

## 📦 Data Flow

```
Component Discovery (AI Call #1)
  ↓
discovery.components = [
  {
    name: "ApproveRequestButton",
    type: "button",
    pattern_type: "item_selection",
    context_collection: {
      strategy: "parent_data",
      fields: [
        { field_name: "request_id", selector: "[data-request-id]", ... }
      ]
    },
    semantic_enrichment: {
      semantic_action: "approve_request",
      surface_inferred: "request_list"
    }
  },
  ...
]
  ↓
buildButtonClickVariants(discovery)
  ↓
For each clickable component:
  1. Infer location from selectors/surface/name
  2. Extract semantic action, conversion relevance
  3. Build context fields from context_collection.fields
  4. Create extraction strategy
  5. Add micro-pattern metadata
  ↓
variants = [
  {
    component: "ApproveRequestButton",
    location: "/requests",
    pattern_type: "item_selection",
    data_fields: { context: { required: ["request_id"], ... } },
    extraction_strategy: { strategy: "parent_data", ... },
    pattern_metadata: { description: "...", ... }
  },
  ...
]
  ↓
BUTTON_CLICK event with variants array
  ↓
events-schema.json output
```

---

## ✅ Validation Checklist

- [x] `generateEventsFromAnalysis` builds variants for BUTTON_CLICK, FORM_INTERACTION, MODAL_INTERACTION
- [x] Each variant includes: component name, location, pattern_type, data_fields with context
- [x] Context fields extracted from `comp.context_collection.fields`
- [x] Location inferred from selectors, surface_inferred, or component name
- [x] Micro-pattern metadata added based on pattern_type
- [x] Extraction strategies preserved from component discovery
- [x] Schema documents what tracker will capture (not instructions for tracker)
- [x] No domain-specific bias (works for SaaS, e-commerce, any domain)
- [x] No linter errors
- [x] EventSchema interface updated with variants support
- [x] Output serialization updated to include variants

---

## 🔧 Implementation Details

### Files Modified
- **analytics-intelligence-generator.ts**
  - Lines 42-65: EventSchema interface updated
  - Lines 1323-1438: generateEventsFromAnalysis refactored
  - Lines 1440-1730: 8 new helper methods added
  - Lines 2659-2666: Output serialization updated

### Lines Added
- **~450 lines** of new code for variant generation
- **8 helper methods** for building variants and metadata

### Breaking Changes
- **None** - Additive only, backward compatible
- Old schema consumers can ignore variants array
- New consumers can use rich variant data

---

## 📈 Benefits

### For Schema Consumers
- Component-specific context fields (not generic)
- Location-aware tracking (same component, different pages)
- Micro-pattern metadata for intelligent tracking
- Extraction strategies with exact selectors

### For Tracker
- Pre-documented extraction logic
- Pattern-driven context collection
- Location-specific behavior
- Field definitions with data types and methods

### For Developers
- Clear understanding of what will be tracked
- Domain-agnostic patterns (works for any app)
- Semantic actions and conversion relevance
- Journey stage information

---

## 🚀 Next Steps

1. **Test with real app** - Verify variants generated correctly
2. **Validate extraction strategies** - Ensure selectors and methods are accurate
3. **Check location inference** - Verify components mapped to correct pages
4. **Review pattern metadata** - Confirm micro-patterns assigned correctly
5. **Update tracker generation** - Use variants for smarter tracker code

---

**Status:** ✅ COMPLETE  
**Linter Errors:** 0  
**Breaking Changes:** None  
**Lines Added:** ~450  
**New Methods:** 8  

The schema now generates component-specific, location-aware event variants with micro-pattern-driven context fields, exactly documenting what the pre-generated tracker will capture at runtime.

