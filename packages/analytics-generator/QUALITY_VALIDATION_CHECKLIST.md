# Analytics Quality Guidelines - Validation Checklist

Use this checklist to verify that the analytics quality guidelines are working correctly after generation.

## Pre-Generation Checks

- [ ] Environment variables set (ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Test app contains forms with payment fields (card, CVV, expiry)
- [ ] Test app has login/auth pages
- [ ] Test app has checkout/payment pages

## Generation Process Checks

### Console Output Validation

After running generation, verify console shows:

- [ ] "🔍 Applying analytics quality guidelines..."
- [ ] "✅ Quality enforcement complete:"
  - [ ] Shows count of patterns simplified
  - [ ] Shows count of sensitive fields marked
  - [ ] Shows count of semantic actions added

### Generated Files Validation

#### 1. Check `events-schema.json`

**Location**: `generated-outputs/unified/tmp/[repo-id]/[app-name]/[timestamp]/events-schema.json`

##### Base Structure
- [ ] Contains `base_fields` section
- [ ] Contains `events` array with 6+ event types
- [ ] Contains `ai_components` array
- [ ] Contains `ai_patterns` array

##### AI Components Validation
For each component in `ai_components`:

**Pattern Simplification:**
- [ ] `pattern_type` is single value (not comma-separated)
- [ ] Valid values: `form_submission`, `modal_lifecycle`, `multi_step_flow`, `item_selection`, etc.

**Sensitive Field Detection:**
Find components with payment/auth fields:
- [ ] Fields named `card_number`, `cvv`, `cvc`, `expiry` have:
  - [ ] `field_purpose: "pci_protected"`
  - [ ] `anonymize: true`
- [ ] Fields named `password`, `pin`, `token` have:
  - [ ] `field_purpose: "authentication_credential"`
  - [ ] `anonymize: true`
- [ ] Fields named `ssn`, `passport` have:
  - [ ] `field_purpose: "pii"`
  - [ ] `anonymize: true`

**Semantic Enrichment:**
- [ ] At least 50% of components have `semantic_enrichment` object
- [ ] `semantic_enrichment.semantic_action` populated (e.g., "authenticate", "purchase", "submit")
- [ ] `semantic_enrichment.conversion_relevance` set ("high", "medium", "low", "none")
- [ ] Components on checkout pages have:
  - [ ] `semantic_enrichment.journey_stage: "monetization"`
  - [ ] `semantic_enrichment.conversion_relevance: "high"`

**Toggle/Dropdown Recognition:**
- [ ] Components with "toggle"/"switch" in name have `type: "toggle_switch"`
- [ ] Components with "select"/"dropdown" in name have `type: "select_dropdown"`

#### 2. Check `tracker.js`

**Location**: `generated-outputs/unified/tmp/[repo-id]/[app-name]/[timestamp]/tracker.js`

Search for key implementations:

**Deduplication Infrastructure:**
- [ ] Line ~2410: `this.recentEvents = [];`
- [ ] Line ~2411: `this.eventDedupeWindow = 1000;`
- [ ] Lines ~2415-2419: `this.sensitiveFieldPatterns` object defined

**Enhanced trackEvent Method:**
- [ ] Line ~3296: `const sanitizedData = this.anonymizeSensitiveData(data, eventType);`
- [ ] Line ~3299: `const enrichedData = this.enrichEventData(sanitizedData, eventType);`
- [ ] Line ~3302: `const cleanedData = this.removeRedundantFields(enrichedData);`
- [ ] Line ~3305: `const isDuplicate = this.checkDuplicateEvent(eventType, cleanedData);`

**Analytics Quality Methods:**
- [ ] Line ~3345: `anonymizeSensitiveData(data, eventType)` method exists
- [ ] Line ~3399: `enrichEventData(data, eventType)` method exists
- [ ] Line ~3457: `removeRedundantFields(data)` method exists
- [ ] Line ~3476: `checkDuplicateEvent(eventType, data)` method exists

#### 3. Check `integration-guide.md`

- [ ] File exists
- [ ] Contains instructions for integrating tracker
- [ ] References the generated files

## Runtime Validation (Browser Testing)

### Setup Test Environment

1. Deploy generated tracker to test app
2. Open browser DevTools → Network tab
3. Filter for analytics endpoint requests

### Test 1: Sensitive Data Anonymization

**Steps:**
1. Navigate to checkout/payment page
2. Fill out form with:
   - Card number: `4111111111111111`
   - CVV: `123`
   - Expiry: `12/25`
   - Zip: `64503`
3. Submit form
4. Inspect network request to analytics endpoint

**Expected Result:**
- [ ] Request body does NOT contain `"card_number": "4111111111111111"`
- [ ] Request body does NOT contain `"cvv": "123"`
- [ ] Request body does NOT contain `"expiry": "12/25"`
- [ ] Request body DOES contain `"payment_fields_completed": ["card_number", "cvv", ...]`
- [ ] Request body DOES contain `"has_sensitive_data": true`
- [ ] Zip code present (not sensitive): `"zip": "64503"`

### Test 2: Deduplication - Rapid Clicks

**Steps:**
1. Navigate to any page with submit button
2. Rapidly click button 5 times within 1 second
3. Inspect network requests

**Expected Result:**
- [ ] Only 1 BUTTON_CLICK event sent (not 5)
- [ ] Event contains `"field_correction_count": 5`

### Test 3: Deduplication - Duplicate Page Views

**Steps:**
1. Navigate to page `/checkout`
2. Immediately refresh page
3. Inspect network requests (both page loads)

**Expected Result:**
- [ ] Only 1 PAGE_VIEW event for `/checkout` per actual navigation
- [ ] No duplicate PAGE_VIEW within 1 second window

### Test 4: Semantic Enrichment - Login Page

**Steps:**
1. Navigate to `/login` page
2. Inspect PAGE_VIEW event in network

**Expected Result:**
- [ ] Event data contains `"surface": "auth_page"`
- [ ] Event data contains `"journey_stage": "activation"`

### Test 5: Semantic Enrichment - Button Click

**Steps:**
1. Navigate to login page
2. Click button with id="submit-login" or similar
3. Inspect BUTTON_CLICK event

**Expected Result:**
- [ ] Event data contains `"semantic_action": "authenticate"` (or similar)
- [ ] Event data contains `"conversion_relevance": "high"` (or appropriate level)
- [ ] If `element_text` was "Unknown", now has inferred text like "Login Button"

### Test 6: Semantic Enrichment - Purchase Flow

**Steps:**
1. Navigate to `/checkout` page
2. Click "Complete Purchase" button
3. Inspect BUTTON_CLICK event

**Expected Result:**
- [ ] Event data contains `"semantic_action": "purchase"`
- [ ] Event data contains `"conversion_relevance": "high"`
- [ ] Event data contains `"journey_stage": "monetization"`
- [ ] Event data contains `"surface": "payment_form"`

### Test 7: Redundancy Elimination

**Steps:**
1. Trigger any event with context data
2. Inspect event payload

**Expected Result:**
- [ ] NO `"context._timestamp"` field
- [ ] NO `"context._interaction_timestamp"` field
- [ ] NO `"page_type"` field (if `page_path` exists)
- [ ] Base `"ts"` field present at root level

### Test 8: Form Interaction Tracking

**Steps:**
1. Navigate to page with form (non-payment)
2. Focus first field (triggers "started")
3. Fill multiple fields
4. Submit form (triggers "submitted")
5. Inspect FORM_INTERACTION events

**Expected Result:**
- [ ] 2 events: one with `"action": "started"`, one with `"action": "submitted"`
- [ ] "submitted" event contains `"fields_completed_names": [...]` array
- [ ] NOT individual BUTTON_CLICK for every field focus

## Performance Validation

### Memory Checks

**Console Commands:**
```javascript
// In browser console after interacting with app
Analytics.recentEvents.length  // Should be < 10 (sliding window)
Analytics.eventQueue.length    // Should be < batchSize (10)
```

**Expected:**
- [ ] `recentEvents` buffer stays small (< 10 events)
- [ ] Events older than 2 seconds removed from buffer
- [ ] No memory leaks from WeakMap/WeakSet usage

### Network Efficiency

**Monitor:**
- [ ] Events batched (not sent individually)
- [ ] Batch sent when queue reaches 10 events OR every 10 seconds
- [ ] No duplicate payloads sent to server

## Edge Cases

### Test A: Multiple Sensitive Fields
**Setup:** Form with card, CVV, SSN, password
**Expected:** All anonymized, separate categories in `payment_fields_completed`

### Test B: Unknown Element with ID
**Setup:** Button with `element_text: "Unknown"`, `element_id: "checkout-button"`
**Expected:** `element_text` enriched to something more meaningful

### Test C: Surface Inference with Unknown Path
**Setup:** Navigate to `/admin/settings`
**Expected:** `surface` either inferred logically or gracefully handles unknown

### Test D: Pattern Type Already Single Value
**Setup:** Component with `pattern_type: "form_submission"` (no commas)
**Expected:** Unchanged, no error

### Test E: No Sensitive Fields in Form
**Setup:** Form with only name, email (non-sensitive context)
**Expected:** `payment_fields_completed` empty or absent, `has_sensitive_data: false`

## Regression Checks

Ensure existing functionality still works:

- [ ] PAGE_VIEW events still fire on navigation
- [ ] BUTTON_CLICK events still fire on clicks
- [ ] FORM_INTERACTION events still fire on form submit
- [ ] SCROLL_INTERACTION events fire at milestones
- [ ] Session ID persists across page loads
- [ ] User ID persists across sessions
- [ ] Events flushed on page unload (beforeunload)
- [ ] Do Not Track (DNT) still respected

## Integration Tests

### Test with Real Analytics Backend

1. Configure `backendUrl` to real analytics service
2. Generate analytics with guidelines
3. Deploy to test app
4. Interact with app
5. Query analytics backend database

**Verify:**
- [ ] Events stored correctly
- [ ] No PCI/PII data in database
- [ ] Semantic enrichment fields indexed
- [ ] Journey stage can be queried
- [ ] Conversion funnel analysis works with semantic_action

## Documentation Validation

- [ ] ANALYTICS_QUALITY_GUIDELINES_IMPLEMENTATION.md exists
- [ ] GUIDELINES_QUICK_REFERENCE.md exists
- [ ] QUALITY_VALIDATION_CHECKLIST.md exists (this file)
- [ ] All documentation accurate and matches implementation

## Sign-Off

| Check | Status | Notes |
|-------|--------|-------|
| LLM Prompt Guidelines Added | ✅ | Lines 860-930 |
| Output Schema Enhanced | ✅ | Lines 794-843 |
| Post-Processing Validation | ✅ | Lines 1076-1218 |
| Tracker Runtime Enhanced | ✅ | Lines 3292-3508 |
| No Linter Errors | ✅ | Verified |
| Documentation Complete | ✅ | 3 docs created |
| Sensitive Data Anonymization | ⬜ | Needs runtime test |
| Deduplication Working | ⬜ | Needs runtime test |
| Semantic Enrichment Working | ⬜ | Needs runtime test |
| All Edge Cases Pass | ⬜ | Needs comprehensive test |

---

**Validation Date**: __________  
**Validated By**: __________  
**Test App Used**: __________  
**Notes**:


