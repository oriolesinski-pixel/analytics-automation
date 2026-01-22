-- Migration: Dashboard Filters & Markdown Tiles
-- Description: Add global filters and markdown tile support

-- Add global filters to dashboards
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS global_filters JSONB DEFAULT '[]';

-- Add tile type to support different tile types (chart, markdown, metric)
ALTER TABLE saved_tiles ADD COLUMN IF NOT EXISTS tile_type TEXT DEFAULT 'chart';

-- Add option for tiles to ignore global filters
ALTER TABLE dashboard_tiles ADD COLUMN IF NOT EXISTS ignore_global_filters BOOLEAN DEFAULT false;

-- Create index for tile type
CREATE INDEX IF NOT EXISTS idx_saved_tiles_type ON saved_tiles(tile_type);

-- Example global_filters:
-- [
--   {"field": "data->country", "operator": "equals", "value": "US"},
--   {"field": "user_id", "operator": "not_equals", "value": "test-user"}
-- ]

-- Example markdown tile config:
-- {
--   "type": "markdown",
--   "content": "# Dashboard Overview\n\nThis dashboard shows...",
--   "backgroundColor": "#f9fafb",
--   "textColor": "#111827"
-- }
