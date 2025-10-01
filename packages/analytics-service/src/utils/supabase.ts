import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface AnalyticsEvent {
  id: string;
  event_type: string;
  app_key: string;
  user_id: string;
  session_id: string;
  ts: number; // milliseconds
  data: Record<string, any>;
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

export async function insertEvents(events: AnalyticsEvent[]): Promise<{ success: boolean; inserted: number; errors: any[] }> {
  const client = getSupabaseClient();
  const errors: any[] = [];

  try {
    const { data, error } = await client
      .from('analytics_product_events')
      .insert(events)
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      errors.push({
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return { success: false, inserted: 0, errors };
    }

    return { success: true, inserted: data?.length || 0, errors: [] };
  } catch (err: any) {
    console.error('Failed to insert events:', err);
    errors.push({
      message: err.message || 'Unknown error',
      type: 'exception',
    });
    return { success: false, inserted: 0, errors };
  }
}

