#!/bin/bash

# Test script for Analytics Tile Builder
# This script tests the /query/tile endpoint with various scenarios

API_URL="${API_URL:-http://localhost:8082}"
APP_KEY="${APP_KEY:-test-app-rich}"

echo "🧪 Testing Analytics Tile Builder"
echo "================================="
echo "API URL: $API_URL"
echo "App Key: $APP_KEY"
echo ""

# Test 1: Simple event count by day
echo "Test 1: Event Count by Day"
echo "---------------------------"
curl -X POST "$API_URL/query/tile" \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "'$APP_KEY'",
    "measure": {
      "aggregation": "count"
    },
    "dimensions": [
      {
        "field": "ts",
        "bucket": "day",
        "type": "temporal"
      }
    ],
    "filters": [],
    "date_range": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-12-31T23:59:59.999Z"
    }
  }' | jq '.'

echo -e "\n\n"

# Test 2: Unique users by event type
echo "Test 2: Unique Users by Event Type"
echo "-----------------------------------"
curl -X POST "$API_URL/query/tile" \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "'$APP_KEY'",
    "measure": {
      "aggregation": "count_distinct",
      "field": "user_id"
    },
    "dimensions": [
      {
        "field": "event_type",
        "type": "categorical"
      }
    ],
    "filters": [],
    "date_range": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-12-31T23:59:59.999Z"
    }
  }' | jq '.'

echo -e "\n\n"

# Test 3: Page views by path with filter
echo "Test 3: Page Views by Path (filtered)"
echo "--------------------------------------"
curl -X POST "$API_URL/query/tile" \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "'$APP_KEY'",
    "event_type": "PAGE_VIEW",
    "measure": {
      "aggregation": "count"
    },
    "dimensions": [
      {
        "field": "data->path",
        "type": "categorical"
      }
    ],
    "filters": [
      {
        "field": "data->path",
        "operator": "contains",
        "value": "/products"
      }
    ],
    "date_range": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-12-31T23:59:59.999Z"
    }
  }' | jq '.'

echo -e "\n\n"

# Test 4: Button clicks by CTA category
echo "Test 4: Button Clicks by CTA Category"
echo "--------------------------------------"
curl -X POST "$API_URL/query/tile" \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "'$APP_KEY'",
    "event_type": "BUTTON_CLICK",
    "measure": {
      "aggregation": "count"
    },
    "dimensions": [
      {
        "field": "data->cta_category",
        "type": "categorical"
      }
    ],
    "filters": [],
    "date_range": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-12-31T23:59:59.999Z"
    }
  }' | jq '.'

echo -e "\n\n"

# Test 5: Simple count (no dimensions)
echo "Test 5: Total Event Count (no dimensions)"
echo "------------------------------------------"
curl -X POST "$API_URL/query/tile" \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "'$APP_KEY'",
    "measure": {
      "aggregation": "count"
    },
    "dimensions": [],
    "filters": [],
    "date_range": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-12-31T23:59:59.999Z"
    }
  }' | jq '.'

echo -e "\n\n"

# Test 6: Multi-dimension (Element Type + Surface)
echo "Test 6: Button Clicks by Element Type and Surface"
echo "--------------------------------------------------"
curl -X POST "$API_URL/query/tile" \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "'$APP_KEY'",
    "event_type": "BUTTON_CLICK",
    "measure": {
      "aggregation": "count"
    },
    "dimensions": [
      {
        "field": "data->element_type",
        "type": "categorical"
      },
      {
        "field": "data->surface",
        "type": "categorical"
      }
    ],
    "filters": [],
    "date_range": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-12-31T23:59:59.999Z"
    }
  }' | jq '.'

echo -e "\n\n"
echo "✅ All tests completed!"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3002/dashboard in your browser"
echo "2. Select your app from the dropdown"
echo "3. Try building tiles with different configurations"
echo "4. Export data to CSV"
echo ""

