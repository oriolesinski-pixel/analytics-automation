-- Migration: Saved Tiles & Dashboards
-- Description: Add support for saving tiles and composing dashboards

-- Saved Tiles (user's tile library)
CREATE TABLE IF NOT EXISTS saved_tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default-user', -- Future: reference users table
  app_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL, -- TileConfig from tile-types.ts
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_tiles_user ON saved_tiles(user_id);
CREATE INDEX idx_saved_tiles_app ON saved_tiles(app_key);
CREATE INDEX idx_saved_tiles_created ON saved_tiles(created_at DESC);

-- Dashboards (collections of tiles)
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default-user',
  app_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  layout JSONB NOT NULL DEFAULT '{"breakpoints": {"lg": 1200, "md": 996, "sm": 768, "xs": 480}, "cols": {"lg": 12, "md": 10, "sm": 6, "xs": 4}, "layouts": {"lg": [], "md": [], "sm": [], "xs": []}}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dashboards_user ON dashboards(user_id);
CREATE INDEX idx_dashboards_app ON dashboards(app_key);
CREATE INDEX idx_dashboards_created ON dashboards(created_at DESC);

-- Dashboard Tiles (many-to-many relationship)
CREATE TABLE IF NOT EXISTS dashboard_tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  tile_id UUID NOT NULL REFERENCES saved_tiles(id) ON DELETE CASCADE,
  layout_config JSONB NOT NULL, -- { x, y, w, h, minW, minH } for initial placement
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dashboard_id, tile_id) -- Prevent duplicate tiles in same dashboard
);

CREATE INDEX idx_dashboard_tiles_dashboard ON dashboard_tiles(dashboard_id);
CREATE INDEX idx_dashboard_tiles_tile ON dashboard_tiles(tile_id);

-- Update trigger for saved_tiles
CREATE OR REPLACE FUNCTION update_saved_tiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saved_tiles_updated_at
  BEFORE UPDATE ON saved_tiles
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_tiles_timestamp();

-- Update trigger for dashboards
CREATE OR REPLACE FUNCTION update_dashboards_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dashboards_updated_at
  BEFORE UPDATE ON dashboards
  FOR EACH ROW
  EXECUTE FUNCTION update_dashboards_timestamp();

-- Example saved_tile config:
-- {
--   "eventType": "PAGE_VIEW",
--   "measure": {"id": "total_events", "label": "Total Events", "aggregation": "count"},
--   "dimensions": [{"id": "day", "label": "Day", "field": "ts", "type": "temporal"}],
--   "filters": [],
--   "dateRange": {"start": "2024-01-01T00:00:00.000Z", "end": "2024-12-31T23:59:59.999Z"},
--   "chartType": "line"
-- }

-- Example dashboard layout:
-- {
--   "breakpoints": {"lg": 1200, "md": 996, "sm": 768, "xs": 480},
--   "cols": {"lg": 12, "md": 10, "sm": 6, "xs": 4},
--   "layouts": {
--     "lg": [
--       {"i": "tile-uuid-1", "x": 0, "y": 0, "w": 6, "h": 4, "minW": 3, "minH": 3},
--       {"i": "tile-uuid-2", "x": 6, "y": 0, "w": 6, "h": 4, "minW": 3, "minH": 3}
--     ],
--     "md": [...],
--     "sm": [...],
--     "xs": [...]
--   }
-- }

