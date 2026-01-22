// Load environment variables FIRST - import this before anything else
import dotenv from 'dotenv';
import path from 'path';

// Get directory of this file and find .env relative to it
const envPath = path.resolve(__dirname, '..', '.env');

console.log(`[env] Loading from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('[env] Error loading .env:', result.error.message);
} else {
  console.log(`[env] Loaded ${Object.keys(result.parsed || {}).length} env vars`);
}

