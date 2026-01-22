/**
 * Authenticated API Client for Analytics Platform
 * 
 * This module provides type-safe, authenticated API calls to the backend services.
 * All requests automatically include the user's auth token from Supabase session.
 * 
 * Usage:
 *   import { fetchApps, fetchEvents, registerApp } from '@/lib/api-client';
 *   
 *   const { apps } = await fetchApps();
 *   const { events } = await fetchEvents('app-key-123');
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for auth
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// API base URLs from environment
const ANALYTICS_SERVICE_URL = process.env.NEXT_PUBLIC_ANALYTICS_SERVICE_URL || 'http://localhost:8082';
const GENERATOR_SERVICE_URL = process.env.NEXT_PUBLIC_GENERATOR_SERVICE_URL || 'http://localhost:8081';

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Generic authenticated API request function
 * 
 * Automatically includes auth token and handles common error cases
 * 
 * @param endpoint - API endpoint (e.g., '/apps/list')
 * @param options - Fetch options
 * @param baseUrl - Base URL (defaults to analytics service)
 * @returns Parsed JSON response
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  baseUrl: string = ANALYTICS_SERVICE_URL
): Promise<T> {
  try {
    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw new APIError(401, 'Failed to get session', { error: sessionError.message });
    }

    if (!session?.access_token) {
      throw new APIError(401, 'Not authenticated. Please login.');
    }

    // Make authenticated request
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`, // ✅ Include auth token
        ...options.headers,
      },
    });

    // Parse response
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new APIError(
        response.status,
        data.message || data.error || `Request failed with status ${response.status}`,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(500, (error as Error).message);
  }
}

// ============================================
// APPS API
// ============================================

export interface App {
  id: string;
  app_key: string;
  name: string;
  domain: string;
  repo_id: string;
  workspace_id: string;
  setup_status?: string;
  pr_url?: string;
  pr_number?: number;
  created_at: string;
  updated_at: string;
  repos?: {
    owner: string;
    name: string;
    id: string;
  };
}

export async function fetchApps(): Promise<{ apps: App[]; count: number }> {
  return apiRequest('/apps/list');
}

export async function fetchApp(appKey: string): Promise<{ app: App }> {
  return apiRequest(`/apps/${appKey}`);
}

export async function registerApp(data: {
  repo_id: string;
  name: string;
  domain?: string;
  app_key?: string;
}): Promise<{ app: App; action: 'created' | 'updated' }> {
  return apiRequest('/apps/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateApp(
  appKey: string,
  updates: Partial<App>
): Promise<{ app: App }> {
  return apiRequest(`/apps/${appKey}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function updateAppStatus(
  appKey: string,
  status: string
): Promise<{ app: App }> {
  return apiRequest(`/apps/${appKey}/status`, {
    method: 'POST',
    body: JSON.stringify({ setup_status: status }),
  });
}

export async function deleteApp(appKey: string): Promise<{ message: string }> {
  return apiRequest(`/apps/${appKey}`, {
    method: 'DELETE',
  });
}

export async function fetchAppAnalytics(
  appKey: string,
  params?: { start_date?: string; end_date?: string }
): Promise<{
  app: App;
  analytics: {
    totalEvents: number;
    uniqueSessions: number;
    recentEvents: any[];
  };
}> {
  const query = params
    ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
    : '';
  return apiRequest(`/apps/${appKey}/analytics${query}`);
}

// ============================================
// EVENTS API
// ============================================

export interface AnalyticsEvent {
  id: string;
  app_key: string;
  workspace_id: string;
  event_type: string;
  data: Record<string, any>;
  user_id?: string;
  session_id?: string;
  timestamp: string;
}

export async function fetchEvents(params?: {
  app_key?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: AnalyticsEvent[]; count: number; total?: number }> {
  const query = params
    ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
    : '';
  return apiRequest(`/analytics/events${query}`);
}

export async function fetchEventSummary(params?: {
  app_key?: string;
  start_date?: string;
  end_date?: string;
  group_by?: 'event_type' | 'day' | 'hour';
}): Promise<{
  summary: {
    total_events: number;
    unique_users: number;
    unique_sessions: number;
    event_types: Record<string, number>;
    timeline?: Record<string, number>;
  };
}> {
  const query = params
    ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
    : '';
  return apiRequest(`/analytics/summary${query}`);
}

export async function fetchFunnelAnalysis(data: {
  app_key: string;
  steps: Array<{ event_type: string; filters?: Record<string, any> }>;
  start_date?: string;
  end_date?: string;
}): Promise<{
  funnel: Array<{
    step: number;
    event_type: string;
    users: number;
    events: number;
    conversion_rate: number;
  }>;
}> {
  return apiRequest('/analytics/funnel', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchRealtimeMetrics(params?: {
  app_key?: string;
  minutes?: number;
}): Promise<{
  metrics: {
    time_window_minutes: number;
    total_events: number;
    active_users: number;
    active_sessions: number;
    events_per_minute: number;
    recent_events: any[];
  };
}> {
  const query = params
    ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
    : '';
  return apiRequest(`/analytics/realtime${query}`);
}

export async function fetchUserJourney(
  userId: string,
  appKey: string,
  limit?: number
): Promise<{ journey: AnalyticsEvent[] }> {
  const query = `?app_key=${appKey}${limit ? `&limit=${limit}` : ''}`;
  return apiRequest(`/analytics/journey/${userId}${query}`);
}

// ============================================
// REPOS API
// ============================================

export interface Repo {
  id: string;
  provider: string;
  owner: string;
  name: string;
  default_branch: string;
  installation_id?: string;
  workspace_id: string;
  created_at: string;
  apps?: Array<{
    id: string;
    app_key: string;
    name: string;
  }>;
}

export async function fetchRepos(installationId?: string): Promise<{
  repos: Repo[];
  count: number;
}> {
  const query = installationId ? `?installation_id=${installationId}` : '';
  return apiRequest(`/repos/list${query}`, {}, GENERATOR_SERVICE_URL);
}

export async function fetchRepo(repoId: string): Promise<{ repo: Repo }> {
  return apiRequest(`/repos/${repoId}`, {}, GENERATOR_SERVICE_URL);
}

export async function addRepo(data: {
  provider: 'github' | 'gitlab';
  owner: string;
  name: string;
  default_branch?: string;
  installation_id?: string;
}): Promise<{ repo: Repo }> {
  return apiRequest(
    '/repos/add',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    GENERATOR_SERVICE_URL
  );
}

export async function updateRepo(
  repoId: string,
  updates: Partial<Repo>
): Promise<{ repo: Repo }> {
  return apiRequest(
    `/repos/${repoId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    },
    GENERATOR_SERVICE_URL
  );
}

export async function deleteRepo(repoId: string): Promise<{ message: string }> {
  return apiRequest(
    `/repos/${repoId}`,
    {
      method: 'DELETE',
    },
    GENERATOR_SERVICE_URL
  );
}

export async function fetchRepoRuns(
  repoId: string,
  params?: { status?: string; limit?: number }
): Promise<{ runs: any[]; count: number }> {
  const query = params
    ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
    : '';
  return apiRequest(`/repos/${repoId}/runs${query}`, {}, GENERATOR_SERVICE_URL);
}

// ============================================
// AUTHENTICATION HELPERS
// ============================================

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new APIError(401, error.message);
  return user;
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new APIError(500, error.message);
}

