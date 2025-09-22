#!/bin/bash

echo "Sending test events for test-app-rich..."

for i in {1..10}; do
  TIMESTAMP=$(date +%s000)
  USER_ID=$((10000000 + RANDOM % 90000000))
  SESSION_ID="session-$(date +%s)-$i"
  
  curl -X POST http://localhost:8082/ingest/analytics \
    -H "Content-Type: application/json" \
    -d "{
      \"app_key\": \"test-app-rich\",
      \"session_id\": \"$SESSION_ID\",
      \"events\": [{
        \"id\": \"evt-$TIMESTAMP-$i\",
        \"ts\": $TIMESTAMP,
        \"event_type\": \"PAGE_VIEW\",
        \"user_id\": \"$USER_ID\",
        \"data\": {
          \"url\": \"/page-$i\",
          \"title\": \"Page $i\"
        }
      }]
    }" 2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo "✓ Sent event $i"
  else
    echo "✗ Failed to send event $i"
  fi
  
  sleep 0.5
done

echo "Done! Checking data..."
curl -s "http://localhost:8082/analytics/overview?app_key=test-app-rich" | python3 -m json.tool
