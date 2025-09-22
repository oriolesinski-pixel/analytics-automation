#!/bin/bash

echo "Recreating analytics_product_events table..."

# Create SQL script
cat > recreate_table.sql << 'SQL'
-- Backup existing data first (optional)
CREATE TABLE IF NOT EXISTS analytics_product_events_backup AS 
SELECT * FROM analytics_product_events;

-- Drop existing table
DROP TABLE IF EXISTS analytics_product_events;

-- Create new table with proper structure
CREATE TABLE analytics_product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT DEFAULT 'tracker',
  repo_id UUID REFERENCES repos(id),
  commit_sha TEXT,
  actor TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verb TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  category TEXT DEFAULT 'interaction',
  user_id TEXT NOT NULL,
  event_ts TIMESTAMPTZ DEFAULT NOW(),
  type TEXT,
  route TEXT,
  session_id TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  edge_id TEXT,
  node_id TEXT,
  app_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_analytics_product_events_app_key ON analytics_product_events(app_key);
CREATE INDEX idx_analytics_product_events_user_id ON analytics_product_events(user_id);
CREATE INDEX idx_analytics_product_events_session_id ON analytics_product_events(session_id);
CREATE INDEX idx_analytics_product_events_ts ON analytics_product_events(ts);
CREATE INDEX idx_analytics_product_events_verb ON analytics_product_events(verb);
CREATE INDEX idx_analytics_product_events_metadata_app_key ON analytics_product_events((metadata->>'app_key'));

-- Grant permissions
GRANT ALL ON analytics_product_events TO authenticated;
GRANT ALL ON analytics_product_events TO service_role;

-- Verify structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'analytics_product_events'
ORDER BY ordinal_position;
SQL

# Execute in Supabase
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://hptxgbufowarzlfmzzph.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '${SUPABASE_SERVICE_ROLE_KEY}'
);

(async () => {
  const sql = fs.readFileSync('recreate_table.sql', 'utf8');
  
  console.log('Executing SQL...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Table recreated successfully');
  }
})();
"

echo "Done!"
