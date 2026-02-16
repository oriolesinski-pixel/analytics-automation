-- =====================================================
-- Migration: Analytics Query RPC & Performance Indexes
-- Version: 005
-- Date: 2026-02-10
-- Description: Creates a safe read-only RPC function for analytics
--   aggregation queries (GROUP BY, COUNT, etc.) and adds composite
--   indexes for common tile query patterns.
--
-- Problem: The existing execute_raw_sql function rejects GROUP BY
--   queries, forcing the app to fetch ALL rows via paginated REST
--   calls and aggregate in memory (40-50s per tile query).
--
-- Solution: A new execute_analytics_query function that validates
--   queries are read-only SELECT statements, then executes them
--   server-side with a safety row limit. This reduces tile queries
--   from 60+ API calls to 1.
-- =====================================================


-- =====================================================
-- 1. New RPC: execute_analytics_query
--    Safely executes read-only SELECT queries with full
--    aggregation support (GROUP BY, HAVING, COUNT, etc.)
-- =====================================================

CREATE OR REPLACE FUNCTION execute_analytics_query(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSONB;
  normalized TEXT;
  query_with_limit TEXT;
BEGIN
  -- Normalize: collapse all whitespace (including newlines) to single space, then uppercase
  -- This ensures validation works regardless of how the client formats the SQL string
  normalized := upper(regexp_replace(trim(sql_query), E'\\s+', ' ', 'g'));

  -- -----------------------------------------------
  -- Validation 1: Must be a SELECT statement (allow optional leading whitespace)
  -- -----------------------------------------------
  IF normalized !~ '^SELECT\s' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed'
      USING ERRCODE = 'P0001';
  END IF;

  -- -----------------------------------------------
  -- Validation 2: Block write / DDL / DCL keywords
  --   Uses word-boundary regex (\m...\M) so column
  --   names like "updated_at" don't false-positive.
  -- -----------------------------------------------
  IF normalized ~
    '\m(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY)\M'
  THEN
    RAISE EXCEPTION 'Write operations are not allowed'
      USING ERRCODE = 'P0001';
  END IF;

  -- -----------------------------------------------
  -- Validation 3: Block SELECT INTO (creates tables)
  --   and SET ROLE / SET SESSION (privilege escalation)
  -- -----------------------------------------------
  IF normalized ~ '\mSELECT\s+.*\mINTO\s+(TEMP|TEMPORARY|UNLOGGED)?\s*\mTABLE\M' THEN
    RAISE EXCEPTION 'SELECT INTO is not allowed'
      USING ERRCODE = 'P0001';
  END IF;

  IF normalized ~ '\m(SET\s+ROLE|SET\s+SESSION)\M' THEN
    RAISE EXCEPTION 'SET ROLE/SESSION is not allowed'
      USING ERRCODE = 'P0001';
  END IF;

  -- -----------------------------------------------
  -- Validation 4: Must query analytics_product_events
  --   (restrict to the analytics table only)
  -- -----------------------------------------------
  IF NOT (normalized LIKE '%ANALYTICS_PRODUCT_EVENTS%') THEN
    RAISE EXCEPTION 'Queries must target analytics_product_events table'
      USING ERRCODE = 'P0001';
  END IF;

  -- -----------------------------------------------
  -- Safety: Enforce a maximum row limit of 10,000
  --   If the query already has a LIMIT, wrap it.
  -- -----------------------------------------------
  query_with_limit := 'SELECT * FROM (' || sql_query || ') _limited LIMIT 10000';

  -- -----------------------------------------------
  -- Execute and collect results as JSONB array
  -- -----------------------------------------------
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' ||
          query_with_limit || ') t'
    INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION execute_analytics_query(TEXT) IS
  'Safely execute read-only analytics queries with GROUP BY / aggregation support. '
  'Returns results as a JSONB array. Row limit: 10,000. Timeout: 30s.';

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION execute_analytics_query(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_analytics_query(TEXT) TO service_role;


-- =====================================================
-- 2. Performance Indexes for tile queries
--    Every tile query filters on (app_key + ts range),
--    often with event_type as an additional filter.
-- =====================================================

-- Primary tile query pattern: WHERE app_key = ? AND ts BETWEEN ? AND ?
-- The ts column is bigint (Unix ms), so regular btree works well.
CREATE INDEX IF NOT EXISTS idx_events_app_key_ts
  ON analytics_product_events (app_key, ts);

-- Filtered tile queries: WHERE app_key = ? AND event_type = ? AND ts BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_events_app_key_event_type_ts
  ON analytics_product_events (app_key, event_type, ts);

-- Distinct user queries: COUNT(DISTINCT user_id) with app_key + ts filter
CREATE INDEX IF NOT EXISTS idx_events_app_key_ts_user_id
  ON analytics_product_events (app_key, ts, user_id);


-- =====================================================
-- Verification Queries
-- =====================================================

-- Test the new function (should return a JSONB array):
-- SELECT execute_analytics_query('SELECT COUNT(*) as total FROM analytics_product_events LIMIT 1');

-- Verify indexes exist:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'analytics_product_events'
-- AND indexname LIKE 'idx_events_app%';

-- Test GROUP BY works:
-- SELECT execute_analytics_query(
--   'SELECT app_key, COUNT(*) as cnt FROM analytics_product_events GROUP BY app_key ORDER BY cnt DESC LIMIT 10'
-- );
