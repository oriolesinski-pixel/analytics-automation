# Quick Start: Testing the Refactored Generator

## 🚀 Test in 5 Minutes

### Step 1: Generate Analytics

```bash
cd analytics-automation/packages/analytics-generator
npm run generate -- --repo=../../../demo-test-apps/saas-test-app
```

**Watch console output for:**
```
🔍 Validating schema quality...
⚠️ Schema quality warnings (if any - note them for prompt improvements)
✅ Schema validation passed
```

---

### Step 2: Check Schema Quality

```bash
# Find the generated output directory
OUTPUT_DIR=$(find src/utils/generated-outputs -type d -name "2025-*" | head -1)

# Check if components have semantic enrichment
cat $OUTPUT_DIR/events-schema.json | jq '.ai_components[] | {
  name,
  type,
  semantic_action: .semantic_enrichment.semantic_action,
  conversion_relevance: .semantic_enrichment.conversion_relevance,
  journey_stage: .semantic_enrichment.journey_stage
}' | head -20
```

**Expected output:**
```json
{
  "name": "CheckoutButton",
  "type": "button",
  "semantic_action": "initiate_purchase",
  "conversion_relevance": "high",
  "journey_stage": "monetization"
}
```

**If semantic_action is null for many components:**
→ LLM prompt needs more examples (check validation warnings)

---

### Step 3: Verify Sensitive Field Marking

```bash
# Check if payment fields are marked as anonymize: true
cat $OUTPUT_DIR/events-schema.json | jq '.ai_components[] | 
  select(.context_collection.fields) | 
  .context_collection.fields[] | 
  select(.field_name | test("card|cvv|password"; "i")) |
  {field_name, anonymize, field_purpose}'
```

**Expected output:**
```json
{
  "field_name": "card_number",
  "anonymize": true,
  "field_purpose": "pci_protected"
}
{
  "field_name": "cvv",
  "anonymize": true,
  "field_purpose": "pci_protected"
}
```

**If anonymize is false or missing:**
→ CRITICAL ERROR - should have been caught by validation

---

### Step 4: Check Tracker Simplicity

```bash
# Count lines (should be ~500)
wc -l $OUTPUT_DIR/tracker.js

# Verify no inference methods (should be 0)
grep -c "enrichEventData\|anonymizeSensitiveData\|checkDuplicateEvent" $OUTPUT_DIR/tracker.js

# Verify has component map (should be 2)
grep -c "buildComponentMap\|getComponentMetadata" $OUTPUT_DIR/tracker.js
```

**Expected:**
```
     487 tracker.js          ✅ ~500 lines
       0                     ✅ No inference methods
       2                     ✅ Has component map
```

---

### Step 5: Check Pattern Simplification

```bash
# Check for comma-separated pattern_type (should find none)
cat $OUTPUT_DIR/events-schema.json | jq '.ai_components[] | select(.pattern_type | contains(","))'
```

**Expected:** Empty output (no comma-separated patterns)

**If you see comma-separated patterns:**
→ Check validation warnings - prompt needs improvement

---

## 📊 Quick Quality Scorecard

Run this script to get overall quality metrics:

```bash
cd analytics-automation/packages/analytics-generator

# Create quick test script
cat > test-quality.sh << 'EOF'
#!/bin/bash

OUTPUT_DIR=$(find src/utils/generated-outputs -type d -name "2025-*" | head -1)

if [ -z "$OUTPUT_DIR" ]; then
  echo "❌ No generated output found. Run npm run generate first."
  exit 1
fi

echo "📊 Quality Report for: $OUTPUT_DIR"
echo ""

# Count components
TOTAL_COMPONENTS=$(jq '.ai_components | length' $OUTPUT_DIR/events-schema.json)
echo "Total components: $TOTAL_COMPONENTS"

# Check semantic enrichment
WITH_SEMANTIC=$(jq '[.ai_components[] | select(.semantic_enrichment.semantic_action)] | length' $OUTPUT_DIR/events-schema.json)
echo "With semantic_action: $WITH_SEMANTIC / $TOTAL_COMPONENTS"

# Check sensitive fields
SENSITIVE_FIELDS=$(jq '[.ai_components[] | .context_collection.fields[]? | select(.field_name | test("card|cvv|password|ssn"; "i"))] | length' $OUTPUT_DIR/events-schema.json)
MARKED_SENSITIVE=$(jq '[.ai_components[] | .context_collection.fields[]? | select(.field_name | test("card|cvv|password|ssn"; "i")) | select(.anonymize == true)] | length' $OUTPUT_DIR/events-schema.json)
echo "Sensitive fields marked: $MARKED_SENSITIVE / $SENSITIVE_FIELDS"

# Check pattern simplification
COMMA_PATTERNS=$(jq '[.ai_components[] | select(.pattern_type | contains(","))] | length' $OUTPUT_DIR/events-schema.json)
echo "Comma-separated patterns: $COMMA_PATTERNS (should be 0)"

# Check tracker size
TRACKER_LINES=$(wc -l < $OUTPUT_DIR/tracker.js)
echo "Tracker size: $TRACKER_LINES lines (target: ~500)"

# Check for inference methods
INFERENCE_COUNT=$(grep -c "enrichEventData\|checkDuplicateEvent" $OUTPUT_DIR/tracker.js || true)
echo "Inference methods: $INFERENCE_COUNT (should be 0)"

echo ""
echo "✅ = Good | ⚠️ = Needs improvement | ❌ = Critical issue"
echo ""

# Score
SCORE=0
[ $WITH_SEMANTIC -gt $((TOTAL_COMPONENTS * 7 / 10)) ] && { echo "✅ Semantic enrichment: >70%"; SCORE=$((SCORE+1)); } || echo "⚠️ Semantic enrichment: <70%"
[ $MARKED_SENSITIVE -eq $SENSITIVE_FIELDS ] && [ $SENSITIVE_FIELDS -gt 0 ] && { echo "✅ All sensitive fields marked"; SCORE=$((SCORE+1)); } || echo "❌ Some sensitive fields not marked"
[ $COMMA_PATTERNS -eq 0 ] && { echo "✅ No comma-separated patterns"; SCORE=$((SCORE+1)); } || echo "⚠️ Some patterns have commas"
[ $TRACKER_LINES -lt 700 ] && { echo "✅ Tracker size reasonable"; SCORE=$((SCORE+1)); } || echo "⚠️ Tracker larger than expected"
[ $INFERENCE_COUNT -eq 0 ] && { echo "✅ No inference methods in tracker"; SCORE=$((SCORE+1)); } || echo "❌ Tracker still has inference logic"

echo ""
echo "Overall Score: $SCORE / 5"
EOF

chmod +x test-quality.sh
./test-quality.sh
```

**Expected output:**
```
📊 Quality Report for: src/utils/generated-outputs/.../2025-10-15...
Total components: 45
With semantic_action: 38 / 45
Sensitive fields marked: 5 / 5
Comma-separated patterns: 0 (should be 0)
Tracker size: 487 lines (target: ~500)
Inference methods: 0 (should be 0)

✅ Semantic enrichment: >70%
✅ All sensitive fields marked
✅ No comma-separated patterns
✅ Tracker size reasonable
✅ No inference methods in tracker

Overall Score: 5 / 5
```

---

## 🔧 Troubleshooting

### Issue: Many warnings about missing semantic_action

**Solution:** Improve LLM prompt with more examples

```typescript
// In analytics-intelligence-generator.ts around line 866
// Add more examples in SEMANTIC INFERENCE section:

**Example:**
- element_id="complete-order-btn" → semantic_action: "initiate_purchase"
- element_id="subscribe-now" → semantic_action: "subscribe"
- element_id="create-project" → semantic_action: "create_content"
```

### Issue: Sensitive fields not marked

**Solution:** Should fail validation. If it doesn't, check validation logic.

```bash
# Verify validation is running
grep -A 10 "validateSchemaQuality" src/lib/analytics-intelligence-generator.ts
```

### Issue: Tracker still has inference methods

**Solution:** Check if you're looking at old generated file

```bash
# Make sure you're checking latest output
ls -lt src/utils/generated-outputs/unified/tmp/*/2025-*
```

### Issue: Comma-separated patterns still present

**Solution:** Validation should warn. Check LLM prompt emphasizes single value.

---

## ✅ Success Criteria

Generation is working correctly if:

- ✅ Score: 4-5 / 5
- ✅ No critical errors during validation
- ✅ Tracker < 700 lines
- ✅ Sensitive fields all marked
- ✅ Most components have semantic_action

**If score < 4:**
→ Review validation warnings
→ Improve LLM prompt based on warnings
→ Regenerate and test again

---

## 📞 Next Steps

1. **Run the quality scorecard** above
2. **If score >= 4:** Deploy tracker to test app and verify in browser
3. **If score < 4:** Note warnings, improve prompt, regenerate
4. **Deploy to test environment** and verify events have semantic metadata
5. **Implement server-side deduplication** (see ARCHITECTURE docs)

---

## Browser Testing (Optional)

If you deploy tracker to test app:

```javascript
// In browser console
// Interact with app, then check events
fetch('https://your-analytics-endpoint.com/events')
  .then(r => r.json())
  .then(events => {
    console.log('Sample event:', events[0]);
    
    // Verify semantic enrichment
    const hasSemantics = events.filter(e => 
      e.data.semantic_action && e.data.conversion_relevance
    ).length;
    
    console.log(`${hasSemantics} / ${events.length} events have semantic enrichment`);
    
    // Verify no PCI data
    const hasPCI = events.some(e => 
      e.data.card_number || e.data.cvv || e.data.password
    );
    
    console.log(hasPCI ? '❌ PCI data leaked!' : '✅ No PCI data in events');
  });
```

---

**Quick Start Version:** 1.0  
**Date:** October 16, 2025  
**Estimated Time:** 5-10 minutes

