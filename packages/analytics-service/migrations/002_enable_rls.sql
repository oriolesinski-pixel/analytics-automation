-- =====================================================
-- Migration: Enable Row-Level Security (RLS)
-- Version: 002
-- Date: 2025-11-19
-- Description: Implements RLS policies for workspace isolation
-- WARNING: Run this AFTER migration 001 and backfill script!
-- =====================================================

-- =====================================================
-- Enable RLS on all workspace-scoped tables
-- =====================================================

ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_product_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyzer_runs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Drop existing policies if any (idempotent migration)
-- =====================================================

DROP POLICY IF EXISTS "workspace_apps_isolation" ON apps;
DROP POLICY IF EXISTS "workspace_repos_isolation" ON repos;
DROP POLICY IF EXISTS "workspace_events_isolation" ON analytics_product_events;
DROP POLICY IF EXISTS "workspace_analyzer_runs_isolation" ON analyzer_runs;

-- =====================================================
-- Policy 1: Apps - Workspace Isolation
-- Users can only access apps in their workspace
-- =====================================================

CREATE POLICY "workspace_apps_isolation" ON apps
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "workspace_apps_isolation" ON apps IS 
  'Restricts app access to members of the same workspace';

-- =====================================================
-- Policy 2: Repos - Workspace Isolation
-- Users can only access repos in their workspace
-- =====================================================

CREATE POLICY "workspace_repos_isolation" ON repos
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "workspace_repos_isolation" ON repos IS 
  'Restricts repo access to members of the same workspace';

-- =====================================================
-- Policy 3: Events - Workspace Isolation
-- Users can only access events in their workspace
-- =====================================================

CREATE POLICY "workspace_events_isolation" ON analytics_product_events
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "workspace_events_isolation" ON analytics_product_events IS 
  'Restricts event access to members of the same workspace';

-- =====================================================
-- Policy 4: Analyzer Runs - Workspace Isolation
-- Users can only access analyzer runs in their workspace
-- =====================================================

CREATE POLICY "workspace_analyzer_runs_isolation" ON analyzer_runs
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "workspace_analyzer_runs_isolation" ON analyzer_runs IS 
  'Restricts analyzer run access to members of the same workspace';

-- =====================================================
-- IMPORTANT: Service Role Key Behavior
-- =====================================================
-- Queries using SUPABASE_SERVICE_ROLE_KEY will BYPASS these RLS policies.
-- This is intentional for:
--   1. Backend operations that need cross-workspace access
--   2. Event ingestion (validates workspace_id from app_key)
--   3. Admin operations
--
-- For user-facing queries, use SUPABASE_ANON_KEY with auth token
-- to enforce RLS policies.
-- =====================================================

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check that RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('apps', 'repos', 'analytics_product_events', 'analyzer_runs');

-- Check that policies exist:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies 
-- WHERE schemaname = 'public'
-- AND tablename IN ('apps', 'repos', 'analytics_product_events', 'analyzer_runs');

-- Test policy (run as authenticated user):
-- SELECT * FROM apps; -- Should only show workspace's apps

