#!/usr/bin/env node
/**
 * One-off: deploy execute_analytics_query RPC to Supabase via Management API.
 * Requires: SUPABASE_ACCESS_TOKEN env var (or we read from keychain / use sbp_* from env).
 * Usage: node scripts/deploy-rpc.js
 */
const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '../migrations/005_analytics_query_rpc_and_indexes.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

// Extract only the CREATE OR REPLACE FUNCTION ... $$; part (single statement)
const match = sql.match(/CREATE OR REPLACE FUNCTION execute_analytics_query[\s\S]*?\n\$\$;/);
if (!match) {
  console.error('Could not find function in migration file');
  process.exit(1);
}
const createFunctionSQL = match[0];

const token = process.env.SUPABASE_ACCESS_TOKEN || (() => {
  try {
    return require('child_process').execSync('security find-generic-password -s "supabase" -w 2>/dev/null', { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
})();

if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN or have supabase token in keychain');
  process.exit(1);
}

const projectRef = 'hptxgbufowarzlfmzzph';
const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token.startsWith('sbp_') ? token : Buffer.from(token, 'base64').toString()}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: createFunctionSQL }),
})
  .then(res => res.json())
  .then(data => {
    if (data.code || data.message) {
      console.error('Error:', data);
      process.exit(1);
    }
    console.log('RPC deployed successfully');
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
