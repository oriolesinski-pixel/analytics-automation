# Analytics Quality Guidelines - Quick Reference

## For Product Developers

### What Changed?
The analytics generator now automatically produces higher-quality, privacy-compliant events by:
1. **Removing sensitive data** before sending events
2. **Deduplicating** rapid clicks and repeated interactions
3. **Inferring semantic meaning** from element IDs and page paths
4. **Enriching events** with journey stage, conversion relevance, and surface attribution

### Where Are Guidelines Applied?

#### 1. During Code Analysis (LLM Prompt)
When Claude analyzes your codebase, it now:
- Marks payment/PII fields as `anonymize: true`
- Simplifies pattern types to single values
- Adds semantic enrichment metadata
- Infers UI surfaces from paths

**File**: `analytics-intelligence-generator.ts` lines 860-930

#### 2. Post-Processing (Validation)
After Claude returns component data:
- Enforces pattern simplification
- Marks any missed sensitive fields
- Adds semantic actions and conversion relevance
- Detects toggles and dropdowns

**File**: `analytics-intelligence-generator.ts` lines 1076-1218  
**Method**: `validateAndEnforceGuidelines()`

#### 3. Runtime (Tracker.js)
When users interact with your app:
- Anonymizes sensitive form data before capture
- Deduplicates rapid clicks (< 1 second apart)
- Infers semantic actions from element IDs
- Infers surface location from page path
- Removes redundant timestamps

**File**: `analytics-intelligence-generator.ts` lines 3292-3508  
**Generated Code**: Inside `tracker.js` trackEvent() method

---

## Sensitive Field Detection

### Automatically Anonymized Patterns

**PCI Data** (Payment Card Industry):
```
card, cvv, cvc, expir, security_code
→ field_purpose: "pci_protected"
→ anonymize: true
```

**PII Data** (Personally Identifiable Information):
```
ssn, social, passport, license, birth, email, name, address
→ field_purpose: "pii"
```

**Authentication Data**:
```
password, pin, secret, token
→ field_purpose: "authentication_credential"
→ anonymize: true
```

### How It Works
Instead of capturing:
```json
{
  "context": {
    "card_number": "4111111111111111",
    "cvv": "123",
    "zip": "64503"
  }
}
```

The tracker sends:
```json
{
  "payment_fields_completed": ["card_number", "cvv"],
  "fields_completed_names": ["zip"],
  "has_sensitive_data": true
}
```

---

## Semantic Enrichment

### Automatic Inference Rules

**From Element ID:**
- `email` → `element_text: "Email Input"`
- `password` → `element_text: "Password Input"`
- `submit` → `semantic_action: "form_submit"`
- `login`/`signin` → `semantic_action: "authenticate"`
- `buy`/`purchase`/`checkout` → `semantic_action: "purchase"`, `conversion_relevance: "high"`

**From Page Path:**
- `/login`, `/signin`, `/auth` → `surface: "auth_page"`, `journey_stage: "activation"`
- `/checkout`, `/payment` → `surface: "payment_form"`, `journey_stage: "monetization"`
- `/dashboard`, `/app` → `surface: "main_content"`, `journey_stage: "engagement"`
- `/` → `surface: "homepage"`, `journey_stage: "acquisition"`

---

## Deduplication Behavior

### Same-Element Clicks
**Before:**
```
[10:30:15.100] BUTTON_CLICK on "Submit"
[10:30:15.150] BUTTON_CLICK on "Submit"
[10:30:15.200] BUTTON_CLICK on "Submit"
```

**After:**
```
[10:30:15.100] BUTTON_CLICK on "Submit" { field_correction_count: 3 }
```

### Duplicate Page Views
**Before:**
```
[10:30:20.100] PAGE_VIEW /checkout
[10:30:20.150] PAGE_VIEW /checkout  (SPA re-render)
```

**After:**
```
[10:30:20.100] PAGE_VIEW /checkout
(second view suppressed)
```

---

## Pattern Simplification

### Before (Comma-Separated)
```json
{
  "pattern_type": "form_submission,multi_step_flow,modal_lifecycle"
}
```

### After (Single Most Relevant)
```json
{
  "pattern_type": "form_submission"
}
```

**Priority Order:**
1. `form_submission`
2. `modal_lifecycle`
3. `multi_step_flow`
4. `item_selection`
5. `toggle_state`
6. `navigation`
7. `form_field_focus`

---

## Redundancy Elimination

### Removed Fields

❌ **Removed**: `context._timestamp` (base `ts` exists)  
❌ **Removed**: `context._interaction_timestamp` (base `ts` exists)  
❌ **Removed**: `page_type` (inferrable from `page_path`)

### Kept Fields

✅ **Kept**: Base `ts` field (Unix timestamp)  
✅ **Kept**: `page_path` (original source of truth)  
✅ **Kept**: All non-sensitive context data

---

## Toggle & Dropdown Recognition

### Automatic Type Upgrades

**Toggles:**
```javascript
// Before
{ "type": "button", "name": "BillingToggle" }

// After
{ "type": "toggle_switch", "pattern_type": "toggle_state" }
```

**Dropdowns:**
```javascript
// Before
{ "type": "select", "name": "PlanSelector" }

// After
{ "type": "select_dropdown" }
```

---

## Debugging & Validation

### Check Generated Output

After generation, inspect `events-schema.json` for:
1. ✅ `ai_components[].context_collection.fields[].anonymize` flags on sensitive fields
2. ✅ `ai_components[].semantic_enrichment` populated
3. ✅ `ai_components[].pattern_type` is single value (no commas)

### Console Logs

Look for validation output:
```
🔍 Applying analytics quality guidelines...
✅ Quality enforcement complete:
   - 12 patterns simplified
   - 8 sensitive fields marked
   - 0 surfaces inferred
   - 15 semantic actions added
```

### Test Tracker Runtime

Check browser console when interacting:
```javascript
// Events should have:
event.data.semantic_action  // "authenticate", "purchase", etc.
event.data.conversion_relevance  // "high", "medium", "low"
event.data.journey_stage  // "acquisition", "activation", etc.
event.data.surface  // "auth_page", "payment_form", etc.

// Sensitive fields should NOT appear:
event.data.context.card_number  // undefined ✓
event.data.context.cvv  // undefined ✓
event.data.payment_fields_completed  // ["card_number", "cvv"] ✓
```

---

## Modifying Guidelines

### To Add New Sensitive Pattern

**File**: `analytics-intelligence-generator.ts`  
**Line**: 2415-2419

```javascript
this.sensitiveFieldPatterns = {
  pci: ['card', 'cvv', 'cvc', 'expir', 'security_code'],
  pii: ['ssn', 'social', 'passport', 'license', 'birth'],
  auth: ['password', 'pin', 'secret', 'token'],
  custom: ['your_pattern_here']  // Add here
};
```

### To Add New Semantic Action

**File**: `analytics-intelligence-generator.ts`  
**Line**: 3403-3416

```javascript
if (elementId.includes('your_keyword')) {
  result.semantic_action = 'your_action';
  result.conversion_relevance = 'high';
}
```

### To Change Pattern Priority

**File**: `analytics-intelligence-generator.ts`  
**Line**: 1099-1100

```javascript
const priority = ['form_submission', 'modal_lifecycle', 'your_priority_here'];
```

---

## FAQ

**Q: Will this break existing analytics?**  
A: No. Only **new generations** apply these guidelines. Existing tracker.js files remain unchanged until regenerated.

**Q: Can I disable deduplication?**  
A: Yes. In generated `tracker.js`, set `this.eventDedupeWindow = 0;` (line ~2412 of generator).

**Q: What if I WANT to capture a sensitive field?**  
A: Mark it as non-sensitive by setting `anonymize: false` in the component's field definition. However, ensure compliance with PCI-DSS/GDPR.

**Q: How do I test sensitive data anonymization?**  
A: Generate analytics for an app with payment forms, then check events in Network tab. Verify no raw card data present.

**Q: Do guidelines apply to existing tracker.js files?**  
A: No. You must **regenerate** analytics to get the enhanced tracker. Old trackers continue working as-is.

---

**Last Updated**: October 16, 2025  
**Guidelines Version**: 1.0

