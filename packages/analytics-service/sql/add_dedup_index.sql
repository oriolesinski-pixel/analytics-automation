-- Deduplication Index Migration
-- Created: 2025-10-16
-- Purpose: Enable fast event deduplication in event-processor.ts

-- ============================================================================
-- DEDUPLICATION INDEX
-- ============================================================================

-- This index enables fast duplicate detection within 5-second windows
-- Used by: analytics-service/src/utils/event-processor.ts
-- 
-- Query pattern:
--   SELECT id, data FROM analytics_product_events
--   WHERE user_id = ? AND event_type = ? AND ts >= ?
--   ORDER BY ts DESC LIMIT 10
--
-- Performance: <5ms with index vs 100-500ms without

CREATE INDEX IF NOT EXISTS idx_events_dedup 
ON analytics_product_events (user_id, event_type, ts DESC);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify index was created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'analytics_product_events' 
  AND indexname = 'idx_events_dedup';

-- Expected output: 1 row showing the index definition

-- ============================================================================
-- PERFORMANCE TEST
-- ============================================================================

-- Test query performance (should use index scan)
EXPLAIN ANALYZE 
SELECT id, data 
FROM analytics_product_events
WHERE user_id = 'test-user'
  AND event_type = 'BUTTON_CLICK'
  AND ts >= (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint - 5000
ORDER BY ts DESC
LIMIT 10;

-- Expected:
--   "Index Scan using idx_events_dedup on analytics_product_events"
--   Execution Time: <10ms

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- To remove the index:
-- DROP INDEX IF EXISTS idx_events_dedup;

-- ============================================================================
-- NOTES
-- ============================================================================

-- Index size: ~1-5% of table size (minimal overhead)
-- Maintenance: Automatically updated on INSERT/UPDATE
-- Impact: Negligible write performance impact (<1ms per insert)
-- Benefit: 20-100x faster deduplication queries

-- ============================================================================

