# Quick Action Guide - Get New Tracker with component_name

## 🎯 What You'll Get After Re-generating

### Current Events (Old Tracker)
```json
{
  "element_text": "Sign in",
  "element_id": null,              // ❌ Useless
  "cta_category": "engagement",    // ❌ Always same
  "is_primary_cta": false,         // ❌ Not meaningful
  "surface": "unknown",
  "pattern_type": "form_submission"
}
```

### New Events (After Re-generation)
```json
{
  "element_text": "Sign in",
  "component_name": "LoginButton",  // ✅ Links to AI metadata
  "element_type": "button",
  "surface": "main",
  "page_path": "/login",
  "location": "/login",
  "pattern_type": "form_submission",
  "context": {
    "page_type": "login"
  }
}
```

---

## 🚀 Steps to Get New Tracker

### 1. Clear Browser Storage
Open browser console (F12) and run:
```javascript
sessionStorage.clear()
localStorage.clear()
```

### 2. Restart Analytics Platform
```bash
# Stop the platform server (Ctrl+C)
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-platform
npm run dev
```

### 3. Re-analyze Your App
1. Go to `localhost:3002/onboarding`
2. Connect GitHub
3. Select `demo-test-apps/saas-test-app`
4. Click "Analyze Code"
5. Wait for completion

You should see in logs:
```
✅ Discovered 25 components
⚠️  Auto-fixed sensitive field "cardholder_name" 
✅ Schema validation passed
✅ BUTTON_CLICK: 15 unique components
✅ FORM_INTERACTION: 5 unique components
✅ MODAL_INTERACTION: 4 unique components
```

### 4. Deploy New Tracker
The generated Pull Request will include:
- `public/tracker.js` with `component_name` field
- `src/components/AnalyticsProvider.tsx`
- Modified `src/app/layout.tsx`

### 5. Test New Events
After deploying, interact with your app and check events - you should see:
- ✅ `component_name: "CheckoutPlanSelector"`
- ✅ `component_name: "ApproveRequestButton"`
- ✅ No more `element_id`, `cta_category`, `is_primary_cta`

---

## ✅ Verification Checklist

After re-generation:

**In UI:**
- [ ] BUTTON_CLICK shows "15 component variants" (not "0 fields tracked")
- [ ] FORM_INTERACTION shows "5 component variants"
- [ ] Expanding shows component names and locations
- [ ] Schema has `component_name` in data_structure

**After Deployment:**
- [ ] New events have `component_name` field
- [ ] No duplicate PAGE_VIEW events (deduplication working)
- [ ] No `element_id`, `cta_category`, `is_primary_cta` fields
- [ ] Events have rich `context` objects

**In Analytics Dashboard:**
- [ ] Can group by component_name
- [ ] Can join with ai_components for semantic actions
- [ ] Can analyze by journey_stage and conversion_relevance

---

## 🎓 What component_name Unlocks

### Query Example 1: Top Components by Clicks
```sql
SELECT 
  data->>'component_name' as component,
  COUNT(*) as clicks
FROM analytics_product_events
WHERE event_type = 'BUTTON_CLICK'
GROUP BY component
ORDER BY clicks DESC
LIMIT 10
```

### Query Example 2: High-Value Conversion Actions
```sql
SELECT 
  e.data->>'component_name' as component,
  ai.semantic_action,
  ai.conversion_relevance,
  COUNT(*) as clicks
FROM analytics_product_events e
JOIN ai_components ai ON e.data->>'component_name' = ai.name
WHERE e.event_type = 'BUTTON_CLICK'
  AND ai.conversion_relevance = 'high'
GROUP BY component, semantic_action, conversion_relevance
ORDER BY clicks DESC
```

### Query Example 3: Journey Stage Analysis
```sql
SELECT 
  ai.journey_stage,
  COUNT(DISTINCT e.user_id) as unique_users,
  COUNT(*) as total_interactions
FROM analytics_product_events e
JOIN ai_components ai ON e.data->>'component_name' = ai.name
WHERE e.event_type = 'BUTTON_CLICK'
GROUP BY ai.journey_stage
ORDER BY unique_users DESC
```

---

## 📊 Value Comparison

| Field | Old Value | New Value | Analysis Value |
|-------|-----------|-----------|----------------|
| `element_id` | ❌ Always null | ✅ Removed | N/A |
| `cta_category` | ❌ Always "engagement" | ✅ Removed | N/A |
| `is_primary_cta` | ❌ Random false/true | ✅ Removed | N/A |
| `component_name` | ❌ Not present | ✅ "ApproveRequestButton" | ⭐⭐⭐⭐⭐ |
| + AI metadata join | ❌ Not possible | ✅ semantic_action, etc. | ⭐⭐⭐⭐⭐ |

---

## ⚡ Quick Start

```bash
# 1. Clear storage (in browser console)
sessionStorage.clear(); localStorage.clear();

# 2. Re-analyze
Go to localhost:3002/onboarding → Analyze saas-test-app

# 3. Deploy new tracker (via PR)
Merge the generated PR

# 4. Test
Interact with app → Check events → See component_name field
```

---

**Status:** ✅ ALL FIXES APPLIED  
**Action:** Re-generate to get new tracker with component_name  
**Expected:** 15 button variants, 5 form variants, 4 modal variants, no duplicates  

