/**
 * Supabase Client Configuration
 * 
 * This module provides two types of Supabase clients:
 * 
 * 1. supabaseAdmin - Uses service role key, BYPASSES RLS
 *    - Use for backend operations that need cross-workspace access
 *    - Use for event ingestion after validating app_key
 *    - Use with caution and ALWAYS add workspace_id filters
 * 
 * 2. createUserSupabaseClient() - Uses anon key + user token, RESPECTS RLS
 *    - Use for user-facing queries
 *    - RLS policies automatically filter by workspace
 *    - Safer but requires user auth token
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Verify required environment variables
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;

/**
 * Admin Supabase Client (Service Role)
 * 
 * ⚠️  WARNING: This client BYPASSES Row-Level Security policies!
 * 
 * Only use this when:
 * - You need to perform admin operations
 * - You're validating data before insertion (e.g., event ingestion)
 * - You're implementing your own workspace filtering logic
 * 
 * ALWAYS explicitly filter by workspace_id when using this client!
 * 
 * @example
 * // ✅ GOOD: Explicit workspace filter
 * const { data } = await supabaseAdmin
 *   .from('apps')
 *   .select('*')
 *   .eq('workspace_id', user.workspace_id);
 * 
 * @example
 * // ❌ BAD: No workspace filter - exposes all data!
 * const { data } = await supabaseAdmin
 *   .from('apps')
 *   .select('*');
 */
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

/**
 * Create User-Scoped Supabase Client
 * 
 * ✅ This client RESPECTS Row-Level Security policies
 * 
 * Use this for user-facing operations where RLS should enforce workspace isolation.
 * The RLS policies will automatically filter data to only the user's workspace.
 * 
 * @param userToken - JWT access token from user's session
 * @returns Supabase client that respects RLS
 * 
 * @example
 * // In a protected route:
 * const authHeader = request.headers.authorization;
 * const token = authHeader?.replace('Bearer ', '');
 * const userClient = createUserSupabaseClient(token!);
 * 
 * // This query is automatically filtered by RLS
 * const { data: apps } = await userClient
 *   .from('apps')
 *   .select('*');
 * // Only returns apps from user's workspace
 */
export function createUserSupabaseClient(userToken: string): SupabaseClient {
  if (!userToken || userToken.length < 20) {
    throw new Error('Invalid user token provided');
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY, // Use anon key so RLS is enforced
    {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    }
  );
}

/**
 * Test Supabase connection
 * 
 * Call this during server startup to verify configuration
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Supabase connection test failed:', error.message);
      return false;
    }

    console.log('✅ Supabase connection successful');
    return true;
  } catch (error: any) {
    console.error('❌ Supabase connection error:', error.message);
    return false;
  }
}

/**
 * Helper: Validate workspace access
 * 
 * Check if a user has access to a specific workspace
 * 
 * @param userId - User ID to check
 * @param workspaceId - Workspace ID to validate access to
 * @returns true if user has access, false otherwise
 */
export async function hasWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('id')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single();

  return !error && !!data;
}

/**
 * Helper: Get workspace for app_key
 * 
 * Lookup which workspace owns an app_key.
 * Used in event ingestion to tag events with correct workspace_id.
 * 
 * @param appKey - Application key to lookup
 * @returns workspace_id or null if not found
 */
export async function getWorkspaceForAppKey(
  appKey: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('apps')
    .select('workspace_id')
    .eq('app_key', appKey)
    .single();

  if (error || !data) {
    return null;
  }

  return data.workspace_id;
}

/**
 * Database Types
 * 
 * Add type definitions for common database operations
 */
export interface WorkspaceRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: string;
}

export interface AppRow {
  id: string;
  app_key: string;
  name: string;
  domain: string;
  repo_id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export interface RepoRow {
  id: string;
  provider: string;
  owner: string;
  name: string;
  default_branch: string;
  installation_id: string | null;
  workspace_id: string;
  created_at: string;
}

export interface AnalyticsEventRow {
  id: string;
  app_key: string;
  workspace_id: string;
  repo_id: string;
  event_name: string;
  properties: Record<string, any>;
  user_id: string | null;
  session_id: string | null;
  timestamp: string;
}

