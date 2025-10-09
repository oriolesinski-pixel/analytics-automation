# SQL Sandbox Setup Guide

The SQL Sandbox is an advanced SQL editor interface built into the Analytics Platform that allows you to query your analytics data using full PostgreSQL syntax.

## Features

✨ **Advanced SQL Editor**
- Monaco Editor (same as VS Code) with full SQL syntax highlighting
- Intelligent autocomplete with schema awareness
- Keyboard shortcuts (Cmd/Ctrl + Enter to run query)

🔒 **Security**
- Read-only queries (SELECT only)
- Query timeout protection (30 seconds)
- Dangerous keyword blocking
- App-key scoped data access

📊 **Results & Visualization**
- Interactive results table with scrolling
- CSV export functionality
- Query execution time tracking
- Row count display

📝 **Query Management**
- Query history (last 50 queries saved locally)
- Example query templates
- Success/failure tracking
- Query restoration from history

## Setup Instructions

### 1. Database Function Setup

The SQL Sandbox requires a PostgreSQL function to execute raw SQL queries safely. Run the following SQL in your Supabase SQL Editor:

```sql
-- Navigate to: Supabase Dashboard > SQL Editor > New Query
-- Copy and paste the contents of:
-- analytics-automation/packages/analytics-service/sql/execute_raw_sql.sql

CREATE OR REPLACE FUNCTION execute_raw_sql(sql_query TEXT)
RETURNS TABLE (result JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_upper TEXT;
BEGIN
  -- Security: Convert to uppercase for checking
  query_upper := UPPER(TRIM(sql_query));
  
  -- Security: Only allow SELECT statements
  IF NOT query_upper LIKE 'SELECT%' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Security: Block dangerous keywords
  IF query_upper ~ 'DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;
  
  -- Execute the query and return results as JSON
  RETURN QUERY EXECUTE format('SELECT to_jsonb(t.*) FROM (%s) t', sql_query);
END;
$$;
```

### 2. Verify Installation

1. Start your services:
   ```bash
   cd analytics-automation/packages/analytics-platform
   npm run dev
   ```

2. Navigate to: `http://localhost:3002/events`

3. Click the **SQL Sandbox** tab

4. You should see the SQL editor with example queries

### 3. Test Query

Try running this simple query:

```sql
SELECT 
  event_type,
  COUNT(*) as event_count
FROM analytics_product_events
WHERE app_key = 'your-app-key'
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
GROUP BY event_type
ORDER BY event_count DESC
LIMIT 10;
```

## Database Schema

### Main Table: `analytics_product_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique event identifier |
| `event_type` | TEXT | Type of event (e.g., page_view, click) |
| `app_key` | TEXT | Application key |
| `user_id` | TEXT | User identifier (nullable) |
| `session_id` | TEXT | Session identifier |
| `ts` | BIGINT | Timestamp in milliseconds (Unix epoch) |
| `data` | JSONB | Event payload data |
| `created_at` | TIMESTAMPTZ | Record creation time |

## Query Examples

### 1. Event Count by Type
```sql
SELECT 
  event_type,
  COUNT(*) as event_count
FROM analytics_product_events
WHERE app_key = 'your-app-key'
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
GROUP BY event_type
ORDER BY event_count DESC
LIMIT 10;
```

### 2. Daily Active Users
```sql
SELECT 
  TO_CHAR(TO_TIMESTAMP(ts / 1000), 'YYYY-MM-DD') as date,
  COUNT(DISTINCT user_id) as daily_active_users
FROM analytics_product_events
WHERE app_key = 'your-app-key'
  AND user_id IS NOT NULL
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days') * 1000
GROUP BY date
ORDER BY date DESC;
```

### 3. Session Analysis
```sql
SELECT 
  session_id,
  COUNT(*) as events_per_session,
  MIN(TO_TIMESTAMP(ts / 1000)) as session_start,
  MAX(TO_TIMESTAMP(ts / 1000)) as session_end
FROM analytics_product_events
WHERE app_key = 'your-app-key'
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '1 day') * 1000
GROUP BY session_id
ORDER BY events_per_session DESC
LIMIT 10;
```

### 4. Query JSON Data
```sql
SELECT 
  event_type,
  data->>'button_text' as button_text,
  COUNT(*) as click_count
FROM analytics_product_events
WHERE app_key = 'your-app-key'
  AND event_type = 'button_click'
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
GROUP BY event_type, button_text
ORDER BY click_count DESC;
```

### 5. Top Event Properties
```sql
SELECT 
  event_type,
  jsonb_object_keys(data) as property_key,
  COUNT(*) as usage_count
FROM analytics_product_events
WHERE app_key = 'your-app-key'
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
GROUP BY event_type, property_key
ORDER BY usage_count DESC
LIMIT 20;
```

## Useful PostgreSQL Functions

### Time Functions
- `NOW()` - Current timestamp
- `CURRENT_DATE` - Current date
- `TO_TIMESTAMP(ts / 1000)` - Convert Unix timestamp to timestamp
- `EXTRACT(EPOCH FROM timestamp)` - Convert timestamp to Unix timestamp
- `DATE_TRUNC('day', timestamp)` - Truncate to day/hour/month
- `TO_CHAR(timestamp, 'YYYY-MM-DD')` - Format timestamp as string

### JSON Functions
- `data->>'key'` - Extract JSON field as text
- `data->'key'` - Extract JSON field as JSON
- `jsonb_object_keys(data)` - Get all keys in JSON object
- `data @> '{"key": "value"}'` - Check if JSON contains value

### Aggregate Functions
- `COUNT(*)` - Count all rows
- `COUNT(DISTINCT column)` - Count distinct values
- `SUM(column)` - Sum of values
- `AVG(column)` - Average of values
- `MIN(column)` - Minimum value
- `MAX(column)` - Maximum value

## Keyboard Shortcuts

- `Cmd/Ctrl + Enter` - Run query
- `Cmd/Ctrl + /` - Toggle comment
- `Cmd/Ctrl + F` - Find in editor
- `Cmd/Ctrl + H` - Find and replace

## Troubleshooting

### Query Timeout
If your query times out, try:
- Adding more specific filters (e.g., date range)
- Reducing the data range
- Using LIMIT to restrict results
- Adding indexes on commonly queried columns

### Function Not Found Error
If you see "execute_raw_sql function not found":
1. Verify the function was created in Supabase
2. Check you ran the SQL in the correct database
3. Ensure your service role key has execute permissions

### No Results
If queries return no results:
- Verify your app_key is correct
- Check the date range (ts is in milliseconds)
- Ensure events exist for your app

## API Endpoint

The SQL Sandbox uses the following API endpoint:

**POST** `/query/sql`

```json
{
  "query": "SELECT * FROM analytics_product_events LIMIT 10",
  "app_key": "your-app-key",
  "timeout": 30000
}
```

**Response:**
```json
{
  "ok": true,
  "data": [...],
  "metadata": {
    "total_rows": 10,
    "query_time_ms": 123
  }
}
```

## Security Considerations

1. **Read-Only**: Only SELECT queries are allowed
2. **Keyword Blocking**: Dangerous SQL keywords are blocked
3. **Timeout Protection**: Queries timeout after 30 seconds
4. **Result Limits**: Consider adding LIMIT clauses to large queries
5. **App Key Scoping**: Always filter by app_key to see only your data

## Future Enhancements

- [ ] Query sharing via URLs
- [ ] Saved queries library
- [ ] Query visualization integration
- [ ] Auto-format SQL
- [ ] Query performance hints
- [ ] Collaborative query editing
- [ ] Query scheduling
- [ ] Result caching

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify the analytics-service is running
3. Check Supabase function is created correctly
4. Review query history for past errors

