-- =====================================================
-- Migration: Add Workspace Isolation to All Tables
-- Version: 001
-- Date: 2025-11-19
-- Description: Adds workspace_id columns and indexes for multi-tenant isolation
-- =====================================================

-- Add workspace_id to core tables
-- Using CASCADE to automatically remove related data when workspace is deleted

ALTER TABLE apps 
ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE repos 
ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- For events table, use a default UUID for backfill, then we'll update it
ALTER TABLE analytics_product_events 
ADD COLUMN workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE analyzer_runs 
ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Create performance indexes for workspace-scoped queries
-- These dramatically improve query performance when filtering by workspace
CREATE INDEX idx_apps_workspace_id ON apps(workspace_id);
CREATE INDEX idx_repos_workspace_id ON repos(workspace_id);
CREATE INDEX idx_events_workspace_id ON analytics_product_events(workspace_id);
CREATE INDEX idx_events_workspace_app ON analytics_product_events(workspace_id, app_key);
CREATE INDEX idx_analyzer_runs_workspace_id ON analyzer_runs(workspace_id);

-- Composite index for common query patterns
CREATE INDEX idx_apps_workspace_repo ON apps(workspace_id, repo_id);

-- =====================================================
-- IMPORTANT: Run backfill script BEFORE uncommenting these!
-- =====================================================

-- After running the backfill script (packages/analytics-service/scripts/backfill-workspace-ids.ts)
-- uncomment these lines to enforce NOT NULL constraints:

-- ALTER TABLE apps ALTER COLUMN workspace_id SET NOT NULL;
-- ALTER TABLE repos ALTER COLUMN workspace_id SET NOT NULL;
-- ALTER TABLE analyzer_runs ALTER COLUMN workspace_id SET NOT NULL;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check that all tables have workspace_id column:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE column_name = 'workspace_id' 
-- AND table_schema = 'public';

-- Check that indexes were created:
-- SELECT tablename, indexname 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND indexname LIKE '%workspace%';

