#!/bin/bash

# Analytics Generator Quality Test Script
# Validates generated output meets quality standards

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "📊 Analytics Generator Quality Test"
echo "===================================="
echo ""

# Find latest generated output
OUTPUT_DIR=$(find src/utils/generated-outputs -type d -name "2025-*" 2>/dev/null | head -1)

if [ -z "$OUTPUT_DIR" ]; then
  echo -e "${RED}❌ No generated output found${NC}"
  echo "   Run: npm run generate -- --repo=path/to/app"
  exit 1
fi

echo -e "📁 Testing: ${OUTPUT_DIR}"
echo ""

# Check required files exist
echo "🔍 Checking required files..."
REQUIRED_FILES=("events-schema.json" "tracker.js" "ui-graph.json" "metadata.json")
MISSING_FILES=0

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$OUTPUT_DIR/$file" ]; then
    echo -e "   ${GREEN}✓${NC} $file"
  else
    echo -e "   ${RED}✗${NC} $file (missing)"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done

if [ $MISSING_FILES -gt 0 ]; then
  echo -e "${RED}❌ $MISSING_FILES required files missing${NC}"
  exit 1
fi

echo ""

# Test 1: Component count
echo "1️⃣  Component Discovery..."
TOTAL_COMPONENTS=$(jq '.ai_components | length' "$OUTPUT_DIR/events-schema.json")
echo "   Total components: $TOTAL_COMPONENTS"

if [ "$TOTAL_COMPONENTS" -lt 5 ]; then
  echo -e "   ${YELLOW}⚠️  Low component count - app may be too simple or analysis failed${NC}"
fi

# Test 2: Semantic enrichment
echo ""
echo "2️⃣  Semantic Enrichment..."
WITH_SEMANTIC=$(jq '[.ai_components[] | select(.semantic_enrichment.semantic_action != null)] | length' "$OUTPUT_DIR/events-schema.json")
INTERACTIVE=$(jq '[.ai_components[] | select(.type == "button" or .type == "link" or .type == "form")] | length' "$OUTPUT_DIR/events-schema.json")

if [ "$INTERACTIVE" -gt 0 ]; then
  SEMANTIC_PCT=$((100 * WITH_SEMANTIC / INTERACTIVE))
  echo "   ${WITH_SEMANTIC}/${INTERACTIVE} interactive elements have semantic_action"
  
  if [ $SEMANTIC_PCT -ge 80 ]; then
    echo -e "   ${GREEN}✅ Excellent${NC} (${SEMANTIC_PCT}%)"
  elif [ $SEMANTIC_PCT -ge 60 ]; then
    echo -e "   ${YELLOW}⚠️  Good${NC} (${SEMANTIC_PCT}%) - could be better"
  else
    echo -e "   ${RED}❌ Poor${NC} (${SEMANTIC_PCT}%) - improve LLM prompt"
  fi
else
  echo "   No interactive elements found"
fi

# Test 3: Sensitive field handling
echo ""
echo "3️⃣  Sensitive Data Protection..."
SENSITIVE_FIELDS=$(jq '[.ai_components[].context_collection.fields[]? | select(.field_name | test("card|cvv|password|ssn|pin"; "i"))] | length' "$OUTPUT_DIR/events-schema.json" 2>/dev/null || echo "0")
MARKED_SENSITIVE=$(jq '[.ai_components[].context_collection.fields[]? | select(.field_name | test("card|cvv|password|ssn|pin"; "i")) | select(.anonymize == true)] | length' "$OUTPUT_DIR/events-schema.json" 2>/dev/null || echo "0")

if [ "$SENSITIVE_FIELDS" -eq 0 ]; then
  echo "   No sensitive fields detected"
else
  echo "   ${MARKED_SENSITIVE}/${SENSITIVE_FIELDS} sensitive fields marked with anonymize: true"
  
  if [ "$MARKED_SENSITIVE" -eq "$SENSITIVE_FIELDS" ]; then
    echo -e "   ${GREEN}✅ All sensitive fields protected${NC}"
  else
    echo -e "   ${RED}❌ CRITICAL: Some sensitive fields not marked!${NC}"
    echo "   This is a security/compliance issue - MUST fix LLM prompt"
    exit 1
  fi
fi

# Test 4: Pattern simplification
echo ""
echo "4️⃣  Pattern Simplification..."
COMMA_PATTERNS=$(jq '[.ai_components[] | select(.pattern_type | contains(","))] | length' "$OUTPUT_DIR/events-schema.json" 2>/dev/null || echo "0")

if [ "$COMMA_PATTERNS" -eq 0 ]; then
  echo -e "   ${GREEN}✅ No comma-separated patterns${NC}"
else
  echo -e "   ${YELLOW}⚠️  $COMMA_PATTERNS components with comma-separated patterns${NC}"
  echo "   LLM should produce single pattern_type value"
fi

# Test 5: Tracker simplicity
echo ""
echo "5️⃣  Tracker Simplicity..."
TRACKER_LINES=$(wc -l < "$OUTPUT_DIR/tracker.js")
echo "   Tracker size: $TRACKER_LINES lines"

if [ $TRACKER_LINES -lt 700 ]; then
  echo -e "   ${GREEN}✅ Tracker is simple and lightweight${NC}"
elif [ $TRACKER_LINES -lt 1000 ]; then
  echo -e "   ${YELLOW}⚠️  Tracker larger than expected${NC}"
else
  echo -e "   ${RED}❌ Tracker too large${NC} (target: ~500 lines)"
fi

# Test 6: No inference methods
INFERENCE_COUNT=$(grep -c "enrichEventData\|anonymizeSensitiveData\|checkDuplicateEvent" "$OUTPUT_DIR/tracker.js" 2>/dev/null || echo "0")
echo "   Inference methods: $INFERENCE_COUNT"

if [ $INFERENCE_COUNT -eq 0 ]; then
  echo -e "   ${GREEN}✅ No runtime inference logic${NC}"
else
  echo -e "   ${RED}❌ Tracker still has ${INFERENCE_COUNT} inference methods${NC}"
  echo "   Old tracker version or refactoring incomplete"
  exit 1
fi

# Test 7: Component map exists
HAS_COMPONENT_MAP=$(grep -c "buildComponentMap\|getComponentMetadata" "$OUTPUT_DIR/tracker.js" 2>/dev/null || echo "0")

if [ $HAS_COMPONENT_MAP -ge 2 ]; then
  echo -e "   ${GREEN}✅ Component map pattern implemented${NC}"
else
  echo -e "   ${YELLOW}⚠️  Component map methods not found${NC}"
fi

# Calculate overall score
echo ""
echo "======================================"
echo "📊 Overall Quality Assessment"
echo "======================================"

SCORE=0
MAX_SCORE=5

# Scoring
if [ "$TOTAL_COMPONENTS" -ge 5 ]; then SCORE=$((SCORE + 1)); fi
if [ "$INTERACTIVE" -gt 0 ] && [ $SEMANTIC_PCT -ge 70 ]; then SCORE=$((SCORE + 1)); fi
if [ "$SENSITIVE_FIELDS" -eq 0 ] || [ "$MARKED_SENSITIVE" -eq "$SENSITIVE_FIELDS" ]; then SCORE=$((SCORE + 1)); fi
if [ "$COMMA_PATTERNS" -eq 0 ]; then SCORE=$((SCORE + 1)); fi
if [ $TRACKER_LINES -lt 700 ] && [ $INFERENCE_COUNT -eq 0 ]; then SCORE=$((SCORE + 1)); fi

echo "Score: $SCORE/$MAX_SCORE"
echo ""

if [ $SCORE -eq $MAX_SCORE ]; then
  echo -e "${GREEN}✅ EXCELLENT${NC} - Production ready!"
elif [ $SCORE -ge 4 ]; then
  echo -e "${GREEN}✅ GOOD${NC} - Minor improvements possible"
elif [ $SCORE -ge 3 ]; then
  echo -e "${YELLOW}⚠️  ACCEPTABLE${NC} - Consider improvements before production"
else
  echo -e "${RED}❌ NEEDS WORK${NC} - Improve LLM prompt and regenerate"
  exit 1
fi

echo ""
echo "For detailed analysis, inspect:"
echo "  - Schema: $OUTPUT_DIR/events-schema.json"
echo "  - Tracker: $OUTPUT_DIR/tracker.js"
echo "  - Metadata: $OUTPUT_DIR/metadata.json"

