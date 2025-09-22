#!/bin/bash

echo "Populating test-app-rich with varied events..."

# Send different event types
for i in {1..30}; do
  TIMESTAMP=$(($(date +%s)000 - RANDOM % 86400000))
  USER_ID=$((10000000 + RANDOM % 90000000))
  SESSION_ID="session-$(date +%s)-$i"
  
  # Vary the event types
  EVENT_TYPES=("PAGE_VIEW" "BUTTON_CLICK" "USER_LOGIN" "USER_REGISTER" "FORM_INTERACTION")
  EVENT_TYPE=${EVENT_TYPES[$RANDOM % ${#EVENT_TYPES[@]}]}
  
  curl -X POST http://localhost:8082/ingest/analytics \
    -H "Content-Type: application/json" \
    -d "{
      \"app_key\": \"test-app-rich\",
      \"session_id\": \"$SESSION_ID\",
      \"events\": [{
        \"id\": \"evt-$TIMESTAMP-$i\",
        \"ts\": $TIMESTAMP,
        \"event_type\": \"$EVENT_TYPE\",
        \"user_id\": \"$USER_ID\",
        \"data\": {
          \"url\": \"/page-$i\",
          \"title\": \"Page $i\",
          \"value\": $((RANDOM % 1000))
        }
      }]
    }" 2>/dev/null && echo -n "."
  
  # Add some scroll events
  if [ $((i % 3)) -eq 0 ]; then
    curl -X POST http://localhost:8082/ingest/analytics \
      -H "Content-Type: application/json" \
      -d "{
        \"app_key\": \"test-app-rich\",
        \"session_id\": \"$SESSION_ID\",
        \"events\": [{
          \"id\": \"evt-scroll-$TIMESTAMP-$i\",
          \"ts\": $TIMESTAMP,
          \"event_type\": \"SCROLL_DEPTH\",
          \"user_id\": \"$USER_ID\",
          \"data\": {
            \"depth\": $((RANDOM % 100)),
            \"page\": \"/page-$i\"
          }
        }]
      }" 2>/dev/null
  fi
done

echo -e "\n✅ Done! Sent varied events"

# Check the data
echo -e "\nChecking data for test-app-rich:"
curl -s "http://localhost:8082/analytics/overview?app_key=test-app-rich" | python3 -m json.tool | head -20
