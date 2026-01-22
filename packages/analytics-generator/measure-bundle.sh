#!/bin/bash
# Bundle size measurement script
# Measures actual tracker.js size (not estimates)

set -e

echo "📦 Measuring Tracker Bundle Size..."
echo ""

# Find most recent generated tracker
TRACKER_FILE=$(find src/utils/generated-outputs -name "tracker.js" -type f | head -1)

if [ -z "$TRACKER_FILE" ]; then
  echo "❌ No tracker.js found."
  echo "   Run generation first:"
  echo "   npm run generate -- --repo=path/to/app"
  exit 1
fi

echo "📄 File: $TRACKER_FILE"
echo ""

# 1. Uncompressed size
UNCOMPRESSED=$(wc -c < "$TRACKER_FILE")
UNCOMPRESSED_KB=$(echo "scale=2; $UNCOMPRESSED / 1024" | bc)
echo "Uncompressed: ${UNCOMPRESSED_KB} KB (${UNCOMPRESSED} bytes)"

# 2. Line count
LINE_COUNT=$(wc -l < "$TRACKER_FILE")
echo "Lines:        ${LINE_COUNT}"

# 3. Minified size (if terser available)
if command -v terser &> /dev/null; then
  terser "$TRACKER_FILE" -o /tmp/tracker.min.js --compress --mangle 2>/dev/null
  MINIFIED=$(wc -c < /tmp/tracker.min.js)
  MINIFIED_KB=$(echo "scale=2; $MINIFIED / 1024" | bc)
  echo "Minified:     ${MINIFIED_KB} KB (${MINIFIED} bytes)"
  rm -f /tmp/tracker.min.js
elif command -v uglifyjs &> /dev/null; then
  uglifyjs "$TRACKER_FILE" -o /tmp/tracker.min.js --compress --mangle 2>/dev/null
  MINIFIED=$(wc -c < /tmp/tracker.min.js)
  MINIFIED_KB=$(echo "scale=2; $MINIFIED / 1024" | bc)
  echo "Minified:     ${MINIFIED_KB} KB (${MINIFIED} bytes)"
  rm -f /tmp/tracker.min.js
else
  echo "Minified:     (install terser or uglify-js to measure)"
  MINIFIED=$UNCOMPRESSED
  MINIFIED_KB=$UNCOMPRESSED_KB
fi

# 4. Gzipped size (network transfer)
GZIPPED=$(gzip -c "$TRACKER_FILE" | wc -c)
GZIPPED_KB=$(echo "scale=2; $GZIPPED / 1024" | bc)
echo "Gzipped:      ${GZIPPED_KB} KB (${GZIPPED} bytes)"

echo ""
echo "📊 Size Benchmarks:"
echo ""

# Gzipped benchmarks
if (( $(echo "$GZIPPED_KB < 10" | bc -l) )); then
  echo "  ✅ Excellent: Gzipped size under 10 KB"
elif (( $(echo "$GZIPPED_KB < 20" | bc -l) )); then
  echo "  ✅ Good: Gzipped size under 20 KB"
elif (( $(echo "$GZIPPED_KB < 50" | bc -l) )); then
  echo "  ⚠️  Acceptable: Gzipped size under 50 KB"
else
  echo "  ❌ Too large: Gzipped size over 50 KB"
  echo "     Consider removing unused code or features"
fi

echo ""
echo "📈 Comparison:"
echo "  - Google Analytics: ~17 KB gzipped"
echo "  - Segment: ~20 KB gzipped"
echo "  - Mixpanel: ~25 KB gzipped"

echo ""
echo "💡 Tips:"
echo "  - Minification reduces size by ~60-70%"
echo "  - Gzip reduces size by another ~60-70%"
echo "  - Final transfer size is what matters (gzipped)"

# Check for unnecessary dependencies
echo ""
echo "🔍 Checking for large dependencies..."
if grep -q "Papa.parse" "$TRACKER_FILE"; then
  echo "  ⚠️  Found: Papa Parse (CSV parser) - consider removing if unused"
fi
if grep -q "moment\|dayjs\|date-fns" "$TRACKER_FILE"; then
  echo "  ⚠️  Found: Date library - use native Date if possible"
fi
if grep -q "lodash\|underscore" "$TRACKER_FILE"; then
  echo "  ⚠️  Found: Utility library - use native methods if possible"
fi

echo ""
echo "✅ Measurement complete"

