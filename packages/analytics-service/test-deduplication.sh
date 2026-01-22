#!/bin/bash
# Test server-side deduplication
# Sends 5 identical events rapidly to verify only 1 is stored

set -e

echo "🧪 Testing Server-Side Deduplication"
echo ""

# Configuration
API_URL="${ANALYTICS_SERVICE_URL:-http://localhost:3001}/ingest/analytics"
USER_ID="test-dedup-$(date +%s)"
TIMESTAMP=$(date +%s)000

echo "Configuration:"
echo "  API URL: $API_URL"
echo "  User ID: $USER_ID"
echo ""

# Create test event template
create_event() {
  local event_id=$1
  cat <<JSON
{
  "app_key": "test-app",
  "events": [{
    "id": "dedup-test-${event_id}",
    "event_type": "BUTTON_CLICK",
    "app_key": "test-app",
    "user_id": "$USER_ID",
    "session_id": "test-session-dedup",
    "ts": $TIMESTAMP,
    "data": {
      "element_id": "test-button-dedup",
      "element_text": "Test Dedup Button",
      "page_path": "/test"
    }
  }]
}
JSON
}

echo "📤 Sending 5 identical events rapidly..."
echo ""

# Send 5 identical events
for i in {1..5}; do
  echo "Event $i:"
  RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "$(create_event $i)")
  
  # Parse response
  STORED=$(echo "$RESPONSE" | jq -r '.stored // 0')
  DEDUPED=$(echo "$RESPONSE" | jq -r '.deduplicated // 0')
  
  echo "  Response: stored=$STORED, deduplicated=$DEDUPED"
  echo "  Full: $RESPONSE"
  
  # Small delay between events
  sleep 0.1
done

echo ""
echo "✅ Test complete!"
echo ""
echo "Expected results:"
echo "  Event 1: stored=1, deduplicated=0 (new event)"
echo "  Event 2: stored=0, deduplicated=1 (duplicate)"
echo "  Event 3: stored=0, deduplicated=1 (duplicate)"
echo "  Event 4: stored=0, deduplicated=1 (duplicate)"
echo "  Event 5: stored=0, deduplicated=1 (duplicate)"
echo ""
echo "🔍 To verify in database, run:"
echo "  SELECT data->>'field_correction_count' FROM analytics_product_events"
echo "  WHERE user_id = '$USER_ID';"
echo ""
echo "  Expected: field_correction_count = 4"

